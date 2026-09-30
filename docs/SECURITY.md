# Segurança e privacidade

Este documento descreve controles existentes e pendências. A geração Gemini foi implementada localmente para profile Pro ativo. Em 2026-09-30, um probe isolado local com “Responda OK” (sem currículo) recebeu HTTP 503; nenhum currículo real foi enviado e não houve deployment.

## Dados e minimização

Currículos podem conter nome, e-mail, telefone, endereço, foto, histórico profissional e outros dados pessoais. Para diagnóstico, a IA geralmente precisa das experiências, competências e formação, não dos contatos diretos. A implementação deve remover ou substituir nome, e-mail, telefone, endereço, foto e identificadores desnecessários antes de enviar texto ao provedor; preservar contexto factual útil. Não enviar o binário original ao modelo. Informar claramente o processamento por fornecedor antes do envio e evitar envio até a ação/consentimento aplicável.

O responsável confirmou que o projeto Gemini usa Paid Services. Nesse nível, prompts/respostas não são usados para melhoria de produtos, mas podem ser retidos por período limitado para segurança/abuso e processados em países onde Google ou agentes operam. Não prometer retenção zero; informar antes do envio e revisar termos/aviso de privacidade. Gemini é usado somente para otimização nesta fase; o diagnóstico segue no provider demo selecionado.

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
- Checkout/webhook estão implementados server-side. O webhook valida HMAC oficial, consulta o pagamento com Access Token server-side, valida ID/valor/moeda/status/referência assinada e chama RPC com `service_role` somente no servidor. `MERCADO_PAGO_MODE` deve estar configurado como `test` ou `production` e as credenciais server-side devem corresponder ao ambiente escolhido; `payment.live_mode` da resposta não é usado como gate, pois a documentação consultada não define essa igualdade como requisito do Checkout Pro Preferences. Nenhuma tabela tem escrita pelo cliente.
- O prazo Pro só avança na primeira transição validada para `approved`. Uma notificação duplicada não estende novamente; o redirect de sucesso não é prova de pagamento nem concede acesso.

## IA e regras factuais

- Currículo, vaga e perfil são entrada não confiável, não instruções. Defesas contra prompt injection precisam separar instruções e dados, mas não são garantia isolada.
- Enviar somente trechos necessários e desidentificados. Nunca enviar arquivo bruto, chaves ou contexto de outros usuários.
- Restringir saída a schema; cada afirmação substantiva deve apontar para evidência localizada na fonte. Schema válido não prova verdade: realizar validação de evidência e permitir revisão humana antes da exportação.
- Ausência documental significa “não encontrado no material”, nunca falta de competência. Sem inferência de fatos; perguntar, omitir ou marcar para confirmação.
- Não registrar prompt, resposta, texto extraído ou identificadores diretos no Sentry nem nos logs. Desativar captura de bodies/headers sensíveis e aplicar allowlist de metadados técnicos.

### Geração Gemini implementada localmente

- `POST /api/resumes/optimize` revalida claims e `profiles.plan/pro_expires_at` em cada chamada com Supabase SSR, usando `isProActive`; profile ausente/vencido e Free recebem 403. Não consulta `payments` nem usa service role.
- A geração requer confirmação explícita separada na UI e cabeçalho `x-resume-gemini-consent: true`. Ele não substitui a autorização Pro e não é persistido. O corpo aceita somente texto extraído, área e cargo.
- Antes do envio, o servidor remove nome reconhecido em primeira linha ou label, e-mail, telefone, links, identificador pessoal e linhas rotuladas de endereço/localização. Não envia arquivo, diagnóstico, dados pessoais ou draft completo.
- A resposta cumpre JSON Schema, limites do editor e evidências literais; empresas, cargos, datas, tecnologias, instituição, idioma, certificação e links são verificados contra a evidência. Schema/evidência literal não provam equivalência semântica: a proposta exige revisão humana; anchors factuais sem suporte rejeitam toda a resposta.
- `GEMINI_API_KEY` e `GEMINI_MODEL` são usados somente server-side. As variáveis ainda precisam ser configuradas na Vercel Production; deploy não realizado. Antes de produção, confirmar duração efetiva da Function e limites/cotas Gemini e definir rate limit/orçamento para chamadas pagas.

## PDF gerado

No MVP, a exportação usa `window.print()` no navegador e CSS de impressão sobre a prévia HTML; o usuário escolhe “Salvar como PDF”. O currículo não é enviado a servidor ou serviço externo para gerar o arquivo. A prévia continua usando conteúdo React escapado como texto, sem canvas ou HTML arbitrário. Se geração server-side for aprovada futuramente, revisar isolamento, rede, credenciais, limites de páginas/tempo e limpeza de temporários antes de implementá-la.

## Segredos e operação

- Segredos somente no servidor e em configuração de ambiente protegida; nunca prefixar segredo com `NEXT_PUBLIC_`.
- Webhooks de pagamento devem validar a assinatura segundo o manifesto oficial do provedor, deduplicar operações e conceder acesso somente depois de estado confirmado no servidor.
- Para Mercado Pago, validar a assinatura oficial `x-signature` pelo manifesto documentado (`data.id`, `x-request-id`, `ts`) e HMAC-SHA256 com comparação em tempo constante; consultar `GET /v1/payments/{id}` com o Access Token server-side antes de aceitar qualquer campo. Não tratar payload do webhook ou parâmetros de retorno como dados autoritativos.
- O checkout tem preço único R$ 19,90, BRL, quantidade 1 e 30 dias fixados no servidor. Validar preço, moeda, `external_reference`, ID e status. Configure `MERCADO_PAGO_MODE` como `test`/`production` junto às credenciais correspondentes no servidor; não usar `payment.live_mode` como comparação obrigatória, pois esse vínculo não é especificado na documentação do fluxo.
- `external_reference` é `tp1:<user_uuid>:<HMAC-SHA256>` autenticada com `MERCADO_PAGO_WEBHOOK_SECRET`, usando manifesto com separação de domínio. O checkout e o webhook falham fechados enquanto a secret não existir; a referência recebida do provedor só produz `user_id` após validação constante do HMAC.
- A secret também assina referências de checkout. Sua rotação invalida referências de checkouts pendentes criados com o valor anterior; antes de rotacionar, aguardar que não haja checkout pendente ou planejar uma janela de compatibilidade.
- Rate limit e cotas por usuário para upload, extração, IA e geração de PDF; definir máximo de tentativas e orçamento para evitar abuso/custo inesperado.
- Definir política de backup, recuperação, atualização de dependências, alertas e resposta a incidentes antes de produção.

## Pendências de produção

Definir base legal, aviso de privacidade, contratos e regiões dos operadores, retenção por tipo de dado, direitos de exclusão e contingência de backups. Fazer teste de acesso cruzado entre usuários para Storage, tabelas e resultados. Registrar limites de upload e uso/custo por usuário. O responsável confirmou o uso Paid Services no projeto Gemini; configurar a chave/modelo na Vercel e revisar o texto de privacidade antes de receber currículos reais. Verificar as condições de duração da Vercel/Supabase.

Para Auth em produção, configurar domínio/Site URL, redirects permitidos por ambiente, SMTP confiável para confirmação, política de senha e proteção contra abuso/tentativas. A implementação atual não cria banco de currículo nem políticas de Storage. Antes de habilitar checkout, configurar credenciais de teste no servidor, Webhook Secret obtida no painel oficial, service role server-side, evento de pagamento e URL pública HTTPS; aplicar a migration de RPC somente após revisão do dry-run e autorização explícita.

## Referências oficiais consultadas

- [Vercel Functions Limits — payload de 4,5 MB](https://vercel.com/docs/functions/limitations)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control), [buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals), [RLS no Postgres](https://supabase.com/docs/guides/database/postgres/row-level-security) e [testes de banco](https://supabase.com/docs/guides/database/testing)
- [OpenAI API Data Controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)
