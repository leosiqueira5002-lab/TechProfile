# Arquitetura técnica proposta

## Estado

A aplicação Next.js já implementa landing page, upload/extração temporária, análise demonstrativa, editor em memória e exportação local por impressão. Supabase Auth foi integrado para cadastro/login por e-mail e senha. Segundo o responsável, a base `profiles`/`payments` foi aplicada e validada no Supabase remoto em 2026-09-29; não foi reconsultada nesta etapa. Checkout/webhook Mercado Pago e uma RPC/migration aditiva foram implementados localmente, mas a nova migration ainda não foi aplicada ao remoto. Persistência de currículos, IA real e deploy continuam fora da implementação atual.

## Stack escolhida

| Área | Escolha | Motivo | Alternativa considerada e motivo para não usar agora |
|---|---|---|---|
| Framework e linguagem | Next.js App Router com TypeScript sobre Node.js LTS | Um projeto full-stack tipado cobre páginas, renderização no servidor e endpoints, com ampla documentação e deploy em Node. | React com Vite mais API independente adicionaria dois projetos, deploy e contratos antes de haver necessidade de separar escala/equipe. |
| Frontend | React com Server Components por padrão; componentes client apenas para interações; Tailwind CSS | A interface e a API permanecem no mesmo projeto. Tailwind permite criar uma experiência responsiva sem adotar uma biblioteca visual grande. | SPA separada e kit de componentes amplo criariam mais superfície e dependências sem requisito atual. |
| Backend/API | Route Handlers do Next.js, validação de entrada/saída com Zod e lógica de domínio em módulos server-only | Atende o fluxo inicial sem serviço separado; mantém credenciais fora do navegador e deixa clara a fronteira servidor/cliente. | NestJS/Fastify seriam razoáveis com API consumida por vários clientes ou equipe maior, mas agora duplicariam estrutura e operação. |
| Banco | PostgreSQL gerenciado pelo Supabase; SQL/migrations simples, sem ORM inicialmente | Um banco relacional atende usuários, metadados de documentos, análises e estado de acesso; Supabase reúne banco e autenticação. | MongoDB não traz vantagem para os dados relacionais; Prisma adicionaria camada e geração sem necessidade comprovada. Pode ser reconsiderado se consultas e evolução justificarem ORM. |
| Autenticação | Supabase Auth com e-mail/senha; `@supabase/ssr`, cookies e verificação de claims no servidor/proxy | Usa o projeto Supabase já previsto, mantém sessão em cookies geridos pelo SDK e evita autenticação própria. A aplicação não armazena senhas. | Magic link mudaria o fluxo solicitado; Clerk/Auth0 adicionariam fornecedor; auth própria elevaria risco e manutenção. |
| Arquivos de currículo | Bucket privado no Supabase Storage; upload direto do cliente com sessão autenticada e políticas RLS por usuário; processamento autorizado no servidor; URLs assinadas curtas somente quando necessárias | Mantém documentos fora do diretório público e evita o limite de 4,5 MB do body das Vercel Functions. | Fazer proxy de cada upload via Route Handler falha para arquivos acima de 4,5 MB; serviço S3 separado adiciona conta e políticas sem necessidade comprovada. |
| Extração PDF/DOCX | Node.js server runtime; `pdf-parse` para PDF textual e `mammoth` para DOCX; limitar tamanho/páginas e rejeitar formatos não suportados | Bibliotecas focadas mantêm processamento local no servidor e evitam enviar o original a um extrator externo. | OCR/Tesseract e serviços de parsing aumentam custo, superfície e falsos resultados; imagem/scans ficam fora do primeiro escopo e devem ser explicados ao usuário. |
| IA | OpenAI Responses API, manter `gpt-4.1-mini` como candidato configurável, saída JSON Schema e avaliação offline antes de produção | Custo/qualidade não podem ser inferidos apenas do rótulo mini; a escolha fica provisória até benchmark anonimizado, revisão factual e verificação atual de preço/retention. | Trocar por outro modelo sem comparação cria risco equivalente; modelo local e camada multi-provedor acrescentariam operação sem requisito. |
| PDF final no MVP | HTML semântico da prévia, impresso pelo navegador com CSS `@media print`/`@page` A4; a pessoa escolhe “Salvar como PDF” | Reutiliza o currículo editado, mantém texto selecionável e não envia dados nem exige dependências ou renderização server-side. | Playwright/Chromium server-side e bibliotecas PDF adicionam runtime, custo e processamento de dados no servidor; só reconsiderar se houver requisito explícito de download direto ou exportação em lote. |
| Pagamentos | Mercado Pago Checkout Pro via Preferences API, Next.js Route Handlers e RPC PostgreSQL transacional para idempotência | Preço fixo server-side de R$ 19,90 BRL por 30 dias avulsos; webhook assinado reconsulta o pagamento antes de gravar/conceder; `external_reference` inclui UUID do usuário assinado pelo servidor. | Orders API, assinatura recorrente e SDK adicional não são necessários neste fluxo. Reembolso/chargeback e autorização de conteúdo Pro permanecem decisões futuras. |
| Deploy | Vercel para aplicação Next.js; Supabase gerenciado para Postgres/Auth/Storage | Caminho direto para preview e deploy da aplicação, com responsabilidades separadas entre execução web e dados. | VPS/Docker exigiria operação de runtime e deploy desde o início; outras plataformas permanecem viáveis se limites de execução para Chromium/arquivos não forem adequados. |
| Monitoramento/logs | Sentry para erros e tracing amostrado; logs estruturados do runtime da Vercel sem conteúdo de currículo, vaga ou perfil | Captura exceções e contexto técnico sem construir observabilidade própria. | Stack OpenTelemetry + collector + Grafana exige operação maior; logs do provedor são suficientes para a primeira fase. Rever custo e retenção antes de produção. |

## Estrutura inicial planejada

```text
.
├── app/
│   ├── (marketing)/page.tsx
│   ├── (auth)/entrar/page.tsx
│   ├── (product)/app/page.tsx
│   ├── api/
│   │   ├── documents/route.ts
│   │   ├── analyses/route.ts
│   │   ├── exports/pdf/route.ts
│   │   ├── checkout/route.ts
│   │   └── webhooks/mercado-pago/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/          # Componentes visuais reutilizáveis
├── features/
│   ├── documents/       # Upload, validação e extração
│   ├── analysis/        # Contratos, evidências e integração de IA
│   ├── resume/          # Edição e exportação do currículo
│   └── billing/         # Helper local de validade Pro; sem autorização de recursos
├── lib/
│   ├── supabase/        # Clientes browser/server e atualização de sessão no proxy
│   ├── db/              # Cliente e consultas SQL
│   ├── storage/         # Operações privadas de arquivos
│   ├── ai/              # Cliente e schemas de saída
│   ├── env.ts           # Validação de variáveis de ambiente
│   └── observability/   # Inicialização e redação de dados sensíveis
├── supabase/
│   └── migrations/      # Schema, índices e políticas RLS versionados
├── public/
├── docs/
└── package.json
```

É uma organização inicial por feature, não obrigação de criar todos os módulos de uma vez. Não adicionar fila, Redis, microsserviços ou painel administrativo até requisito real.

## Base atual de perfis e pagamentos

A migration `supabase/migrations/20260929000000_profiles_payments.sql` cria `public.profiles` e `public.payments` de forma aditiva. Profiles recebem um plano `free` por padrão; `plan` aceita `free` ou `pro`, e `pro_expires_at` começa nulo. Payments são identificados por provedor e ID externo único, com Mercado Pago como único provedor permitido inicialmente. Um trigger cria profile Free para novos Auth users e um backfill idempotente cobre usuários existentes sem sobrescrever perfis.

RLS está habilitado nas duas tabelas. O role `authenticated` tem somente `SELECT` e somente sobre linhas próprias; `anon` não tem grants. Não há grants ou policies de escrita para clientes. `features/billing/access.ts` contém um helper puro para validade temporal Pro, ainda desconectado de autorização de recursos. O checkout/webhook estão implementados server-side; a migration local `20260929000100_mercado_pago_payment_processor.sql` acrescenta RPC transacional executável somente por `service_role`, sem escrita de tabela direta pelo navegador. Ela permanece sem aplicação remota até autorização separada.

## Caminho dos dados

1. A pessoa autentica-se e pede autorização de upload; o servidor cria metadados pendentes e caminho aleatório no namespace do usuário.
2. O navegador envia direto ao bucket privado Supabase com sessão autorizada e política RLS; limites de tamanho e tipos também são configurados no bucket. Não passar o binário pelo body da Vercel Function (limite documentado de 4,5 MB).
3. O servidor verifica ownership, tipo real/magic bytes, tamanho, formato, páginas e limites de expansão antes de processar. PDF/DOCX são extraídos no runtime Node com timeout, memória e concorrência limitados; o texto extraído é apresentado para revisão.
4. Após confirmação, o servidor minimiza e desidentifica o texto (contatos diretos e identificadores desnecessários são removidos) e envia somente o necessário ao provedor de IA pela API server-side. Chaves nunca entram no bundle do navegador. Aviso de privacidade deve mencionar processamento externo e a política de retenção do fornecedor.
5. A saída deve obedecer a schema, ser validada e manter evidências; afirmações sem suporte são descartadas ou submetidas a esclarecimento.
6. A pessoa revisa e edita o currículo final. No MVP, o navegador imprime localmente apenas a prévia do currículo e permite “Salvar como PDF”; nenhuma rota server-side gera o documento.
7. Descrição de vaga e texto de LinkedIn só são incluídos por ação da pessoa; não usar scraping.

## Persistência e retenção propostas

Como o diagnóstico e o currículo otimizado precisam de revisão e retomada, a proposta assume conta autenticada e persistência mínima de metadados, texto extraído, resultado e versão editada. Original em bucket privado. Exclusão de documento deve remover o objeto pela API Storage e seus dados associados (texto, análises, versão editada e referências), com operação idempotente; apagar somente metadados não remove o objeto físico. A proposta anterior de 30 dias cobre apenas o original e não é uma política completa ou aprovada. Definir prazos separados para cada dado, backups e logs antes de produção; retenção indefinida é proibida.

## Segurança e limites de operação

- Auth atual: clients browser/server de `@supabase/ssr`; `proxy.ts` atualiza cookies e usa `getClaims()`, enquanto o layout `(product)` exige claims válidos. A chave publishable é pública por definição e nunca substitui autorização/RLS. Nenhuma chave `service_role` é usada.
- `/analise` e `/curriculo` exigem sessão; `/entrar` e `/cadastro` redirecionam sessões autenticadas para `/analise`. `/auth/confirm` troca o código PKCE e só usa destinos locais fixos.
- Sessão persistida pelo mecanismo de cookies do Supabase SSR. Não registrar senha, token ou conteúdo privado. Erros do SDK são mapeados para mensagens amigáveis.
- Variáveis de Auth: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; nenhum segredo deve usar prefixo `NEXT_PUBLIC_`.

- Aplicação Node runtime para extração e Chromium; endpoints com limites explícitos de arquivo, páginas, tempo, concorrência e payload. Upload direto ao Supabase por causa do limite de request body de 4,5 MB da Vercel Functions.
- Nunca confiar em MIME/extensão; conferir magic bytes e parser, nomes aleatórios, PDF/DOCX permitidos e rejeitar documentos criptografados/corrompidos. DOCX exige limite de expansão ZIP/entradas; parsers isolados, sem rede/segredos, com timeout e memória limitados.
- Sem upload público. Autorização por usuário em toda leitura/escrita; RLS como proteção adicional para dados relacionais.
- Storage path imprevisível/namespaceado; bucket privado; links assinados com validade curta e sem registrá-los em logs.
- Não registrar conteúdo, tokens, URLs assinadas ou prompts com dados pessoais. Redigir dados diretos antes de IA; validar evidência além do schema. A política OpenAI atual descreve monitoramento de abuso que pode reter conteúdo por até 30 dias por padrão; confirmar controles/contrato e informar processamento antes de produção.
- RLS, validação no servidor e checagem de assinatura de webhook; segredos disponíveis apenas no servidor.
- Scraping do LinkedIn, OCR de scans, compartilhamento público e publicação automática não fazem parte do desenho inicial.
- Para Chromium, renderizar só HTML de template controlado e dados escapados; bloquear rede/URLs externas, sem credenciais disponíveis, timeout e concorrência limitados. Deploy Vercel permanece viável em princípio, mas o bundle do Chromium, memória, tempo e custo precisam de build e prova de carga reais antes de assumir a escolha para produção; mover geração para worker Node dedicado se os limites falharem.
- Limitar chamadas de IA, uploads e PDFs por usuário e aplicar orçamento/alertas de consumo.

## Variáveis de ambiente previstas

| Nome | Uso | Exposição |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | URL pública para links e callbacks | Pública; sem segredo |
| `NEXT_PUBLIC_SUPABASE_URL` | Endpoint Supabase para SDK autorizado | Pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública do SDK Supabase; autorização e RLS continuam obrigatórias | Pública; não é secret key |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações privilegiadas restritas a servidor, se realmente necessárias | Segredo; evitar uso em rotas comuns |
| `OPENAI_API_KEY` | Responses API | Segredo |
| `OPENAI_MODEL` | Modelo selecionado/configurável | Servidor |
| `MERCADO_PAGO_ACCESS_TOKEN` | Criar preferência e consultar pagamento na API Mercado Pago | Segredo server-side |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Validar HMAC `x-signature` da aplicação MP | Segredo server-side; deve ser gerado no painel de Webhooks |
| `MERCADO_PAGO_MODE` | Selecionar URL sandbox/live; usar credenciais de teste ou produção correspondentes no servidor | Server-side: `test` ou `production`; não comparar com `payment.live_mode` da resposta |
| `NEXT_PUBLIC_APP_URL` | Formar `back_urls` e `notification_url` públicos | Origem pública HTTPS fora de desenvolvimento local |
| `SUPABASE_SERVICE_ROLE_KEY` | Chamar RPC de processamento privilegiado | Segredo server-side; nunca importar em Client Components |
| `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` | Não necessária no checkout hospedado via redirecionamento | Pode permanecer configurada, mas não define valores nem valida pagamentos |
| `SENTRY_DSN` | Reportar exceções; DSN web pode ser público, usar filtro de dados | Configuração |
| `SENTRY_AUTH_TOKEN` | Upload de source maps no build, se ativado | Segredo de CI |

Segredos de deploy (por exemplo, a chave de conexão do Supabase e credenciais de CI) são configurados no ambiente de execução, nunca commitados. Usar `.env.example` apenas com nomes e valores fictícios quando a implementação iniciar.

## Fontes oficiais consultadas

- Next.js App Router e Route Handlers: [documentação](https://nextjs.org/docs/app), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) e [deploy](https://nextjs.org/docs/app/getting-started/deploying).
- Limites de payload e execução das Vercel Functions: [limites](https://vercel.com/docs/functions/limitations), [duração](https://vercel.com/docs/functions/configuring-functions/duration).
- Supabase Auth e Storage privado/URLs assinadas: [Auth](https://supabase.com/docs/guides/auth), [downloads de Storage](https://supabase.com/docs/guides/storage/serving/downloads).
- Políticas de acesso a objetos: [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control); exclusão via API é necessária para remover o objeto de fato.
- OpenAI Structured Outputs e modelos: [Responses/saída estruturada](https://platform.openai.com/docs/api-reference/responses) e [modelos](https://platform.openai.com/docs/models).
