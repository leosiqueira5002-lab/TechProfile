# Segurança e privacidade

Esta auditoria é documental. Nenhum serviço ou controle está configurado e as medidas abaixo ainda precisam ser implementadas e verificadas antes de produção.

## Dados e minimização

Currículos podem conter nome, e-mail, telefone, endereço, foto, histórico profissional e outros dados pessoais. Para diagnóstico, a IA geralmente precisa das experiências, competências e formação, não dos contatos diretos. A implementação deve remover ou substituir nome, e-mail, telefone, endereço, foto e identificadores desnecessários antes de enviar texto ao provedor; preservar contexto factual útil. Não enviar o binário original ao modelo. Informar claramente o processamento por fornecedor antes do envio e evitar envio até a ação/consentimento aplicável.

O uso da API OpenAI não significa, por si só, ausência de retenção: a documentação atual descreve logs de monitoramento de abuso que podem conter prompts e respostas e, por padrão, serem retidos por até 30 dias. Verificar controles e contrato da conta antes de produção; não prometer retenção zero sem confirmação elegível. Não persistir estado de resposta do provedor desnecessariamente.

## Upload e processamento de arquivos

- Não encaminhar o binário pelo body de uma Vercel Function: o limite documentado é 4,5 MB. Fazer upload direto e autenticado ao bucket privado Supabase, com política Storage/RLS restrita ao usuário e limite de tamanho definido no bucket e na aplicação.
- Para cada upload, validar tamanho antes e durante o fluxo, extensão permitida, MIME declarado e assinatura real do formato; nenhum desses sinais isoladamente basta. Gerar nome interno aleatório, rejeitar arquivos criptografados, corrompidos, com conteúdo ativo inesperado ou que excedam limites de páginas, expansão/recursos e tempo.
- PDF e DOCX são contêineres complexos. Tratar parser como superfície de ataque: manter dependências atualizadas, executar em processo/runtime isolado sem acesso a credenciais desnecessárias e sem saída de rede, aplicar timeout e limite de memória/concorrência, e remover temporários ao terminar. Evitar extrair HTML renderizável diretamente do DOCX.
- DOCX é ZIP: impor limite de tamanho comprimido e descomprimido/razão de expansão e número de entradas para reduzir risco de zip bomb. PDF deve ter limites de páginas e de recursos, além de rejeitar criptografia no MVP.
- Scans e imagens ficam fora do primeiro escopo; explicar isso à pessoa em vez de apresentar texto vazio como extração correta. OCR exige decisão separada por custo, qualidade e privacidade.
- Para produção, avaliar varredura antimalware (ex.: ClamAV isolado) se arquivos serão retidos ou processados além da janela síncrona. O MVP pode reduzir exposição aceitando somente formatos necessários, processando logo após upload e excluindo o original conforme a política.

## Autorização, armazenamento e exclusão

### Supabase Auth implementado

- Cadastro e login usam Supabase Auth por e-mail/senha; a aplicação não persiste senhas nem possui tabela própria de credenciais.
- Clientes usam `@supabase/ssr`: client-side para ações interativas e server-side com cookies para páginas. `proxy.ts` atualiza cookies e chama `getClaims()`; páginas de produto verificam claims no servidor. Não confiar somente em estado de sessão obtido no cliente.
- A chave publishable pode aparecer no bundle e não concede acesso por si só. Não usar `service_role` no navegador. Toda futura operação de dados exige autorização no servidor e políticas RLS apropriadas.
- Callback de confirmação aceita código PKCE e redireciona apenas para destinos locais fixos. Configurar no painel Supabase Site URL e allowlist de Redirect URLs por ambiente; não aceitar redirect arbitrário.
- Não registrar senha, access/refresh token, cookies ou objetos brutos de erro Supabase. A interface apresenta mensagens mapeadas para texto amigável.
- Logout encerra a sessão pelo SDK e redireciona para `/entrar`; páginas protegidas continuam exigindo claims válidos.

- Bucket deve ser privado; não criar caminho de acesso público. Políticas RLS no Storage devem conferir `auth.uid()` contra o primeiro segmento da chave para INSERT/SELECT/DELETE, e políticas equivalentes precisam restringir tabelas expostas. RLS é camada adicional; verificar também grants e autorização server-side.
- Chave `service_role` contorna RLS; mantê-la somente no servidor e preferir operação com JWT do usuário quando possível. Se ação administrativa exigir chave privilegiada, validar dono do objeto novamente no servidor.
- Links assinados são credenciais portadoras: curta validade, finalidade específica, não inserir em logs/telemetria nem expor por longos períodos.
- A exclusão de arquivo deve usar API de Storage. Remover só a linha de metadados não apaga o objeto físico. O fluxo de exclusão da conta/documento precisa apagar objetos, texto extraído, análises, currículo editado e referências; lidar com falhas de forma idempotente e verificável.
- A proposta de 30 dias para arquivo original ainda não é política aprovada. Definir explicitamente prazos para originais, extrações, análises, currículo editado, vagas/LinkedIn, logs e backups, incluindo exclusão sob solicitação e limite de propagação em backup.

### Perfis e pagamentos preparatórios

- A migration `supabase/migrations/20260929000000_profiles_payments.sql` cria `profiles` e `payments`; segundo o responsável, ela foi aplicada e validada no Supabase remoto em 2026-09-29 (não reconsultado nesta etapa).
- As duas tabelas habilitam RLS. `authenticated` recebe somente `SELECT`, limitado por `auth.uid() = user_id`; `anon` não recebe grants. Clientes não podem inserir, atualizar ou excluir profiles/pagamentos, incluindo `plan` e `pro_expires_at`.
- O trigger de criação de profile é `SECURITY DEFINER` apenas para a inserção mínima, usa `SET search_path = ''`, nomes qualificados e `ON CONFLICT DO NOTHING`; não confia em metadados de cadastro. O backfill só insere profiles ausentes e é idempotente.
- `payments` tem unicidade composta `(provider, provider_payment_id)`; a migration local nova usa essa chave em uma RPC transacional idempotente. A migration de processamento ainda não foi aplicada ao banco remoto.
- Checkout/webhook estão implementados server-side. O webhook valida HMAC oficial, consulta o pagamento com Access Token server-side, valida ID/modo/valor/moeda/status/referência assinada e chama RPC com `service_role` somente no servidor. Nenhuma tabela tem escrita pelo cliente.
- O prazo Pro só avança na primeira transição validada para `approved`. Uma notificação duplicada não estende novamente; o redirect de sucesso não é prova de pagamento nem concede acesso.

## IA e regras factuais

- Currículo, vaga e perfil são entrada não confiável, não instruções. Defesas contra prompt injection precisam separar instruções e dados, mas não são garantia isolada.
- Enviar somente trechos necessários e desidentificados. Nunca enviar arquivo bruto, chaves ou contexto de outros usuários.
- Restringir saída a schema; cada afirmação substantiva deve apontar para evidência localizada na fonte. Schema válido não prova verdade: realizar validação de evidência e permitir revisão humana antes da exportação.
- Ausência documental significa “não encontrado no material”, nunca falta de competência. Sem inferência de fatos; perguntar, omitir ou marcar para confirmação.
- Não registrar prompt, resposta, texto extraído ou identificadores diretos no Sentry nem nos logs. Desativar captura de bodies/headers sensíveis e aplicar allowlist de metadados técnicos.

## PDF gerado

No MVP, a exportação usa `window.print()` no navegador e CSS de impressão sobre a prévia HTML; o usuário escolhe “Salvar como PDF”. O currículo não é enviado a servidor ou serviço externo para gerar o arquivo. A prévia continua usando conteúdo React escapado como texto, sem canvas ou HTML arbitrário. Se geração server-side for aprovada futuramente, revisar isolamento, rede, credenciais, limites de páginas/tempo e limpeza de temporários antes de implementá-la.

## Segredos e operação

- Segredos somente no servidor e em configuração de ambiente protegida; nunca prefixar segredo com `NEXT_PUBLIC_`.
- Webhooks de pagamento devem validar a assinatura segundo o manifesto oficial do provedor, deduplicar operações e conceder acesso somente depois de estado confirmado no servidor.
- Para Mercado Pago, validar a assinatura oficial `x-signature` pelo manifesto documentado (`data.id`, `x-request-id`, `ts`) e HMAC-SHA256 com comparação em tempo constante; consultar `GET /v1/payments/{id}` com o Access Token server-side antes de aceitar qualquer campo. Não tratar payload do webhook ou parâmetros de retorno como dados autoritativos.
- O checkout tem preço único R$ 19,90, BRL, quantidade 1 e 30 dias fixados no servidor. Validar preço, moeda, `external_reference`, ID, status e modo `test`/`production`; recusar modos divergentes.
- `external_reference` é `tp1:<user_uuid>:<HMAC-SHA256>` autenticada com `MERCADO_PAGO_WEBHOOK_SECRET`, usando manifesto com separação de domínio. O checkout e o webhook falham fechados enquanto a secret não existir; a referência recebida do provedor só produz `user_id` após validação constante do HMAC.
- A secret também assina referências de checkout. Sua rotação invalida referências de checkouts pendentes criados com o valor anterior; antes de rotacionar, aguardar que não haja checkout pendente ou planejar uma janela de compatibilidade.
- Rate limit e cotas por usuário para upload, extração, IA e geração de PDF; definir máximo de tentativas e orçamento para evitar abuso/custo inesperado.
- Definir política de backup, recuperação, atualização de dependências, alertas e resposta a incidentes antes de produção.

## Pendências de produção

Decidir mercado/base legal, aviso de privacidade, contratos e regiões dos operadores, retenção por tipo de dado, direitos de exclusão e contingência de backups. Fazer teste de acesso cruzado entre usuários para Storage, tabelas e resultados. Registrar limites de upload e uso/custo por usuário. O responsável deve aprovar o fluxo de dados para OpenAI e as condições da Vercel/Supabase antes de receber currículos reais.

Para Auth em produção, configurar domínio/Site URL, redirects permitidos por ambiente, SMTP confiável para confirmação, política de senha e proteção contra abuso/tentativas. A implementação atual não cria banco de currículo nem políticas de Storage. Antes de habilitar checkout, configurar credenciais de teste no servidor, Webhook Secret obtida no painel oficial, service role server-side, evento de pagamento e URL pública HTTPS; aplicar a migration de RPC somente após revisão do dry-run e autorização explícita.

## Referências oficiais consultadas

- [Vercel Functions Limits — payload de 4,5 MB](https://vercel.com/docs/functions/limitations)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control), [buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals), [RLS no Postgres](https://supabase.com/docs/guides/database/postgres/row-level-security) e [testes de banco](https://supabase.com/docs/guides/database/testing)
- [OpenAI API Data Controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)
