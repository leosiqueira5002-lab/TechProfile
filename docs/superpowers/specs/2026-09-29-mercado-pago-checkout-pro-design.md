# Especificação: Mercado Pago Checkout Pro avulso

**Status:** implementado localmente; migration ainda não aplicada ao Supabase remoto.

## Objetivo

Permitir que uma pessoa autenticada compre TechProfile Pro por **R$ 19,90**, em pagamento único, recebendo **30 dias** de acesso por pagamento aprovado. Cada novo pagamento aprovado acrescenta mais 30 dias, sem recorrência. A interface nunca é autoridade de preço, status ou concessão do plano.

## Contexto confirmado

- O usuário informa que a base `profiles`/`payments` foi aplicada e validada no Supabase remoto. Essa afirmação não foi reconsultada durante esta especificação.
- A migration existente define `profiles(user_id, plan, pro_expires_at, ...)` e `payments(user_id, provider, provider_payment_id, amount, currency, status, access_days, ...)`, com unicidade `(provider, provider_payment_id)` e leitura própria por RLS.
- A aplicação usa Next.js App Router, Route Handlers, Supabase Auth SSR e Supabase Postgres. O módulo `features/billing/access.ts` só calcula validade e continuará sem ser usado como autorização para conceder pagamentos.
- A aplicação Mercado Pago existente é Checkout Pro integrada pela Preferences API. A documentação oficial atual confirma que Checkout Pro usa a API de preferências; cada fluxo cria uma preferência e recebe um `init_point`. Não migrar para Orders API nem recriar a aplicação.

## Abordagem

Manter um monólito Next.js com dois Route Handlers Node server-side e `fetch` nativo para a API REST do Mercado Pago, sem SDK/dependência nova nesta fase. O endpoint autenticado cria uma preferência com os valores comerciais fixados no servidor. O webhook valida a assinatura recomendada pelo Mercado Pago, consulta o recurso de pagamento na API oficial e só então solicita uma operação atômica no Postgres.

Uma migration **aditiva** acrescentará uma função transacional privilegiada para gravar/atualizar um pagamento e conceder o prazo uma única vez na transição para `approved`. A função terá `SECURITY DEFINER`, `search_path` vazio, nomes totalmente qualificados e execução revogada de `PUBLIC`, `anon` e `authenticated`; apenas `service_role` poderá chamá-la. A chave service role ficará em módulo server-only e não será entregue ao navegador. A restrição UNIQUE existente continua sendo a barreira de concorrência para o ID externo.

O `external_reference` da preferência será uma referência assinada pelo servidor no formato `tp1:<user_uuid>:<hmac_sha256>`, usando `MERCADO_PAGO_WEBHOOK_SECRET` e o manifesto `techprofile-checkout-v1:<user_uuid>`. O UUID vem das claims Supabase no servidor; a validação constante do HMAC recupera o usuário somente se a referência não foi adulterada. Nenhum identificador de usuário fornecido pelo cliente é aceito. A assinatura da referência impede usar um pagamento cuja referência seja apenas um UUID escolhido/alterado para creditar outra conta. A rotação da secret invalida referências de checkouts já criados; fazer uma rotação somente sem checkouts pendentes ou planejar uma janela de compatibilidade antes da produção.

## Fluxos e contratos

### Criar checkout

`POST /api/checkout`:

1. Exigir sessão Supabase válida via `getClaims()`; sem sessão, responder `401`.
2. Não aceitar do cliente preço, moeda, quantidade, produto, dias, usuário, status, provider ID ou URLs de retorno. Body não é necessário e será ignorado por completo.
3. Configuração server-side única: título `TechProfile Pro`, `unit_price: 19.90`, `currency_id: BRL`, `quantity: 1`, concessão `30` dias.
4. Criar preferência via `POST https://api.mercadopago.com/checkout/preferences`, autenticando com `MERCADO_PAGO_ACCESS_TOKEN`; incluir `external_reference` assinada para o usuário validado, `back_urls` absolutas, `auto_return='approved'` e `notification_url` HTTPS para o webhook.
5. Responder somente com URL de checkout escolhida do retorno oficial (`sandbox_init_point` em modo teste, `init_point` em produção) e estado genérico. Não retornar token, credenciais ou objeto bruto.
6. Falhas de configuração/provedor retornam erro genérico seguro, sem log de token, body completo, currículo ou resposta sensível do provedor.

O modo será explícito em `MERCADO_PAGO_MODE=test|production`; teste exige URL de checkout sandbox e produção exige URL live. O modo também valida `live_mode` do pagamento notificado. Nunca usar `localhost`/`127.0.0.1` em `back_urls` ou `notification_url` enviados ao Mercado Pago.

### Validar e processar webhook

`POST /api/webhooks/mercado-pago` em runtime Node:

1. Exigir `x-signature`, `x-request-id`, query `data.id`, `MERCADO_PAGO_WEBHOOK_SECRET` e corpo JSON válido. Notificação sem assinatura válida falha fechada (`401`); configuração ausente falha sem processar (`503`).
2. Validar assinatura HMAC-SHA256 conforme manifesto oficial `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, extraindo `ts`/`v1` de `x-signature` e comparando em tempo constante. Para IDs alfanuméricos, aplicar a normalização para minúsculas especificada pela documentação. Rejeitar campos/headers ausentes ou malformados.
3. Processar apenas notificações do tópico `payment`; outros tópicos válidos podem receber `200` sem processamento para evitar retries inúteis. Se o body trouxer `data.id`, ele precisa corresponder ao `data.id` assinado na query.
4. Buscar `GET https://api.mercadopago.com/v1/payments/{data.id}` server-side com Access Token. Ignorar body/status/ID do browser ou do webhook como fonte do pagamento.
5. Confirmar ID consultado, `live_mode` compatível com `MERCADO_PAGO_MODE`, `currency_id === BRL`, `transaction_amount === 19.90`, HMAC de `external_reference` válido e status retornado pelo Mercado Pago; a referência assinada determina o UUID do usuário.
6. Pagamentos `pending`, `rejected` ou outros status oficiais não concedem Pro; os status validados podem ser registrados/atualizados em `payments`. Somente status `approved` com todas as verificações pode avançar para a função SQL. Valores, usuário ou moeda divergentes não alteram tabela alguma.
7. Chamar RPC privilegiada com os campos verificados e valores de produto/dias definidos pelo servidor. Gravação do pagamento e alteração do profile acontecem na mesma transação.
8. Em evento duplicado, a função lê/insere sob a constraint única e só estende o acesso se o registro passar de qualquer estado não aprovado para aprovado. Se já estava aprovado, retorna idempotentemente sem novo prazo. Conflito do mesmo ID com outro usuário ou valor inconsistente falha sem concessão.
9. Responder `200` após evento válido e processado/ignorado; falha temporária de API/banco retorna erro não-2xx para permitir retry do Mercado Pago. Não registrar segredo, token, assinatura inteira ou objeto completo de pagamento.

### Operação transacional do banco

Migration nova e aditiva, por exemplo `20260929000100_mercado_pago_payment_processor.sql`, cria RPC `public.apply_mercado_pago_payment(...)` (assinatura final detalhada no plano). A função:

- aceita somente `provider='mercado_pago'`, `currency='BRL'`, valor `19.90`, `access_days=30` e status permitido;
- trava/insere o registro por `(provider, provider_payment_id)`; mesma ID pertencente a outro usuário não pode ser reaproveitada;
- grava status verificado, inclusive `pending`/`rejected`, sem conceder acesso;
- em primeira transição para `approved`, define `plan='pro'`; se o profile já for Pro ativo, acrescenta 30 dias à expiração atual, caso contrário define `now() + 30 days`;
- na repetição de status `approved`, não altera a expiração;
- uma notificação posterior não aprovada ou fora de ordem não pode regredir um registro já aprovado; estorno/chargeback e revogação continuam fora do escopo;
- exige profile existente; falha transacional, sem pagamento parcial, se faltar;
- não recebe/obedece valor arbitrário do cliente; valida constantes de produto dentro da função além das validações da rota.

O helper `isProActive` continua uma consulta temporal pura. A autorização de páginas/recursos Pro não entra nesta fase, pois o escopo é checkout, registro e estado de plano.

## Páginas de retorno

- `/pagamento/sucesso`: informa que o retorno foi recebido e que o acesso só aparece após confirmação do Mercado Pago pelo servidor/webhook. Não lê query params para conceder plano.
- `/pagamento/pendente`: orienta aguardar confirmação, sem concessão.
- `/pagamento/erro`: informa que o pagamento não foi confirmado e permite tentar novamente pelo fluxo autenticado.

As páginas não atualizam Supabase, não chamam endpoint de grant, não confiam em `payment_id`, `status`, `external_reference` ou outros query params de retorno. A autoridade é o webhook verificado e a consulta server-side.

## Variáveis de ambiente

| Nome | Escopo | Regra |
|---|---|---|
| `MERCADO_PAGO_ACCESS_TOKEN` | servidor | obrigatório; token de teste em staging e credencial live separada em produção; nunca `NEXT_PUBLIC_` nem logado |
| `MERCADO_PAGO_WEBHOOK_SECRET` | servidor | obrigatório; segredo gerado em Webhooks > Configurar notificações na aplicação MP; não inventar nem versionar |
| `MERCADO_PAGO_MODE` | servidor | obrigatório: `test` ou `production`; seleciona link retornado e valida `live_mode` |
| `NEXT_PUBLIC_APP_URL` | URL pública | origem absoluta usada para back URLs e webhook; HTTPS e hostname público fora de desenvolvimento |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor | necessário somente para chamar a RPC privilegiada; proteger como segredo e não importar em módulos/client components |
| `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` | navegador, opcional | não necessária no Checkout Pro redirecionado; não usar para definir nem verificar cobranças |

Os valores já existentes não devem ser impressos nem copiados. `MERCADO_PAGO_WEBHOOK_SECRET` é a nova credencial do Mercado Pago; além de validar webhooks, ela assina a referência do checkout. Assim, iniciar cobrança também falha de forma segura até a secret oficial ser configurada. Modo explícito e service role são configurações server-side necessárias para operar com segurança conforme a arquitetura proposta. A configuração `NEXT_PUBLIC_APP_URL` fornecida pelo usuário deve apontar para host HTTPS publicamente acessível para callbacks; local não é uma URL válida para o Mercado Pago.

**Configuração após implementação:** `NEXT_PUBLIC_APP_URL` foi confirmada presente em `.env.local` e usa a URL pública aprovada. `MERCADO_PAGO_MODE=test` também está definido. Webhook Secret oficial e service role permanecem pendentes de configuração local/server-side; seus valores não foram lidos ou exibidos. Sem a Secret, o endpoint de checkout responde com falha segura antes de chamar o Mercado Pago.

## Segurança e privacidade

- Seguir regras de `docs/SECURITY.md`; sem dados do currículo na jornada de pagamento.
- Autenticar checkout pelo Supabase no servidor e vincular usuário às claims, nunca ao corpo recebido.
- Mercado Pago Access Token e Webhook Secret apenas em ambiente server-side; `SUPABASE_SERVICE_ROLE_KEY` apenas no módulo server-only.
- Não expor payment ID como fonte de autorização; não confiar em redirect ou payload webhook.
- Aplicar HMAC oficial em tempo constante antes da consulta ao provedor; limitar body e validar tipos/formatos.
- Consultar API oficial antes de qualquer persistência/concessão; falhar fechado em configuração, assinatura, preço, moeda, modo, usuário ou status inesperado.
- Inserção/atualização e extensão atômicas; UNIQUE existente e condição de transição para `approved` previnem dupla concessão.
- Não logar credenciais, headers assinados, payload completo nem dados pessoais; registrar apenas categoria do evento, resultado e IDs técnicos minimizados se necessários para diagnóstico.
- Nunca aplicar migration remota automaticamente; a nova migration aditiva deve ser revisada/aplicada em etapa separada autorizada.
- Esta fase não cobre reembolso/chargeback/revogação, contestação, recorrência, autorização de recursos premium ou política fiscal/comercial.

## Testes requeridos

Automatizados com fixtures fictícias, `fetch` e clientes Supabase/RPC mockados; nenhum pagamento real ou credencial real:

1. usuário anônimo recebe 401 e não chama Mercado Pago;
2. body tentando definir preço é ignorado/rejeitado e a preferência continua em R$ 19,90;
3. body tentando definir `access_days` é ignorado/rejeitado e a concessão permanece em 30;
4. referência externa usa o usuário validado no servidor;
5. assinatura ausente ou inválida não consulta pagamento nem concede Pro;
6. pagamento `pending` não concede Pro;
7. pagamento `rejected` não concede Pro;
8. pagamento `approved` correto invoca uma transação de concessão;
9. amount divergente não grava nem concede;
10. currency divergente não grava nem concede;
11. external_reference ausente, malformada ou com HMAC adulterado não grava nem concede;
12. webhook duplicado não duplica `payments`;
13. webhook duplicado aprovado não estende prazo novamente;
14. profile Free recebe 30 dias;
15. Pro ativo recebe 30 dias após a expiração vigente;
16. Pro expirado recebe 30 dias a partir do instante atual.

Cobrir também falhas da API/banco com resposta retryable, modo sandbox/live incompatível, falta de secret, erro de URL pública, evento válido não-payment ignorado e páginas de retorno que não alteram plano. pgTAP deve verificar grants/RLS da nova função, constraints, transição e idempotência em banco descartável; não apontar testes para projeto remoto.

## Critérios de aceite

- Preferências Pro criadas exclusivamente no servidor por `19.90 BRL`, quantidade 1 e 30 dias de acesso.
- Somente sessão autenticada inicia checkout; usuário recebe URL oficial sandbox/live escolhida segundo o modo.
- Webhook usa HTTPS público, HMAC oficial validado, consulta server-side e confirma status/preço/moeda/referência/modo antes de persistir.
- Pagamento aprovado altera perfil em transação única e duplicata não adiciona dias.
- Redirect de sucesso nunca concede acesso.
- Nenhum segredo ou serviço de pagamento fica acessível no client; nenhum pagamento real é disparado por testes.
- Testes Node, pgTAP (quando houver banco local), lint, typecheck, build e `git diff --check` passam.
- Migration é aditiva e sua aplicação remota ocorre somente com autorização separada.

## Fora de escopo

Assinatura recorrente; Orders API; recriar aplicação MP; frontend decidir preço/dias/status; IA; currículo/Storage; pagamentos reais em automação; cartão no site; criação de produto/planos no banco; conceder Pro via redirect; reembolso/chargeback e revogação; admin; autorização de conteúdo premium; deploy ou aplicação remota automática da migration.

## Referências oficiais consultadas em 2026-09-29

- [Checkout Pro usa Preferences API e oferece `init_point`](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/overview)
- [Criar preferência no backend](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/create-payment-preference)
- [Configurar back URLs e não usar localhost](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/configure-back-urls)
- [Webhook: HMAC, cabeçalhos, consulta do pagamento e retries](https://www.mercadopago.com.br/developers/pt/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks?scope=prod)
- [Configurar notificações opcionais do Checkout Pro e validar manifesto HMAC](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-settings/optional-notifications)
- [Obter pagamento por ID](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/get-payment/get)
