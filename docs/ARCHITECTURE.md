# Arquitetura técnica proposta

## Estado

O repositório começou vazio e ainda não contém aplicação nem serviços configurados. Este documento escolhe a stack para a implementação futura do MVP; não significa que qualquer conta, integração ou infraestrutura já esteja criada.

## Stack escolhida

| Área | Escolha | Motivo | Alternativa considerada e motivo para não usar agora |
|---|---|---|---|
| Framework e linguagem | Next.js App Router com TypeScript sobre Node.js LTS | Um projeto full-stack tipado cobre páginas, renderização no servidor e endpoints, com ampla documentação e deploy em Node. | React com Vite mais API independente adicionaria dois projetos, deploy e contratos antes de haver necessidade de separar escala/equipe. |
| Frontend | React com Server Components por padrão; componentes client apenas para interações; Tailwind CSS | A interface e a API permanecem no mesmo projeto. Tailwind permite criar uma experiência responsiva sem adotar uma biblioteca visual grande. | SPA separada e kit de componentes amplo criariam mais superfície e dependências sem requisito atual. |
| Backend/API | Route Handlers do Next.js, validação de entrada/saída com Zod e lógica de domínio em módulos server-only | Atende o fluxo inicial sem serviço separado; mantém credenciais fora do navegador e deixa clara a fronteira servidor/cliente. | NestJS/Fastify seriam razoáveis com API consumida por vários clientes ou equipe maior, mas agora duplicariam estrutura e operação. |
| Banco | PostgreSQL gerenciado pelo Supabase; SQL/migrations simples, sem ORM inicialmente | Um banco relacional atende usuários, metadados de documentos, análises e estado de acesso; Supabase reúne banco e autenticação. | MongoDB não traz vantagem para os dados relacionais; Prisma adicionaria camada e geração sem necessidade comprovada. Pode ser reconsiderado se consultas e evolução justificarem ORM. |
| Autenticação | Supabase Auth com magic link por e-mail no MVP; autorização no servidor e políticas RLS para tabelas privadas | Reduz código de senha e reutiliza identidade integrada ao Postgres. Magic link evita armazenar senha na aplicação. | Implementação própria de senha aumenta risco e manutenção; Clerk/Auth0 separariam outro fornecedor enquanto Supabase já está escolhido. Login social fica para depois. |
| Arquivos de currículo | Bucket privado no Supabase Storage; upload direto do cliente com sessão autenticada e políticas RLS por usuário; processamento autorizado no servidor; URLs assinadas curtas somente quando necessárias | Mantém documentos fora do diretório público e evita o limite de 4,5 MB do body das Vercel Functions. | Fazer proxy de cada upload via Route Handler falha para arquivos acima de 4,5 MB; serviço S3 separado adiciona conta e políticas sem necessidade comprovada. |
| Extração PDF/DOCX | Node.js server runtime; `pdf-parse` para PDF textual e `mammoth` para DOCX; limitar tamanho/páginas e rejeitar formatos não suportados | Bibliotecas focadas mantêm processamento local no servidor e evitam enviar o original a um extrator externo. | OCR/Tesseract e serviços de parsing aumentam custo, superfície e falsos resultados; imagem/scans ficam fora do primeiro escopo e devem ser explicados ao usuário. |
| IA | OpenAI Responses API, manter `gpt-4.1-mini` como candidato configurável, saída JSON Schema e avaliação offline antes de produção | Custo/qualidade não podem ser inferidos apenas do rótulo mini; a escolha fica provisória até benchmark anonimizado, revisão factual e verificação atual de preço/retention. | Trocar por outro modelo sem comparação cria risco equivalente; modelo local e camada multi-provedor acrescentariam operação sem requisito. |
| PDF final | HTML semântico do currículo aprovado renderizado no servidor com Playwright/Chromium em Node.js; conteúdo não passa novamente pela IA | Usa uma fonte visual para prévia/exportação e preserva a versão que a pessoa revisou. | `jsPDF`/PDF programático limita layout; serviço externo recebe dados pessoais sem benefício suficiente. Se limites serverless tornarem Chromium inviável, reavaliar runtime/gerador. |
| Pagamentos | Stripe Checkout hospedado, com webhook assinado como fonte de estado de pagamento/entitlement | Checkout reduz escopo de coleta de cartão e o webhook sincroniza acesso no servidor. | Formulário de cartão próprio aumenta escopo de segurança; pagamentos locais alternativos exigem análise de mercado, preço e disponibilidade brasileira antes da decisão final. Stripe permanece proposta sujeita à validação comercial e regional. |
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
│   │   └── webhooks/stripe/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/          # Componentes visuais reutilizáveis
├── features/
│   ├── documents/       # Upload, validação e extração
│   ├── analysis/        # Contratos, evidências e integração de IA
│   ├── resume/          # Edição e exportação do currículo
│   └── billing/         # Entitlements e integração Stripe
├── lib/
│   ├── auth/            # Sessão e autorização server-side
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

## Caminho dos dados

1. A pessoa autentica-se e pede autorização de upload; o servidor cria metadados pendentes e caminho aleatório no namespace do usuário.
2. O navegador envia direto ao bucket privado Supabase com sessão autorizada e política RLS; limites de tamanho e tipos também são configurados no bucket. Não passar o binário pelo body da Vercel Function (limite documentado de 4,5 MB).
3. O servidor verifica ownership, tipo real/magic bytes, tamanho, formato, páginas e limites de expansão antes de processar. PDF/DOCX são extraídos no runtime Node com timeout, memória e concorrência limitados; o texto extraído é apresentado para revisão.
4. Após confirmação, o servidor minimiza e desidentifica o texto (contatos diretos e identificadores desnecessários são removidos) e envia somente o necessário ao provedor de IA pela API server-side. Chaves nunca entram no bundle do navegador. Aviso de privacidade deve mencionar processamento externo e a política de retenção do fornecedor.
5. A saída deve obedecer a schema, ser validada e manter evidências; afirmações sem suporte são descartadas ou submetidas a esclarecimento.
6. A pessoa revisa e edita o currículo final. PDF é renderizado dessa versão aprovada.
7. Descrição de vaga e texto de LinkedIn só são incluídos por ação da pessoa; não usar scraping.

## Persistência e retenção propostas

Como o diagnóstico e o currículo otimizado precisam de revisão e retomada, a proposta assume conta autenticada e persistência mínima de metadados, texto extraído, resultado e versão editada. Original em bucket privado. Exclusão de documento deve remover o objeto pela API Storage e seus dados associados (texto, análises, versão editada e referências), com operação idempotente; apagar somente metadados não remove o objeto físico. A proposta anterior de 30 dias cobre apenas o original e não é uma política completa ou aprovada. Definir prazos separados para cada dado, backups e logs antes de produção; retenção indefinida é proibida.

## Segurança e limites de operação

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
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública sujeita a RLS | Pública; não substitui autorização |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações privilegiadas restritas a servidor, se realmente necessárias | Segredo; evitar uso em rotas comuns |
| `OPENAI_API_KEY` | Responses API | Segredo |
| `OPENAI_MODEL` | Modelo selecionado/configurável | Servidor |
| `STRIPE_SECRET_KEY` | Criar Checkout Session e consultar Stripe | Segredo |
| `STRIPE_WEBHOOK_SECRET` | Validar assinatura de webhook | Segredo |
| `STRIPE_PRICE_ID` | Preço aprovado associado ao paywall | Configuração server-side |
| `SENTRY_DSN` | Reportar exceções; DSN web pode ser público, usar filtro de dados | Configuração |
| `SENTRY_AUTH_TOKEN` | Upload de source maps no build, se ativado | Segredo de CI |

Segredos de deploy (por exemplo, a chave de conexão do Supabase e credenciais de CI) são configurados no ambiente de execução, nunca commitados. Usar `.env.example` apenas com nomes e valores fictícios quando a implementação iniciar.

## Fontes oficiais consultadas

- Next.js App Router e Route Handlers: [documentação](https://nextjs.org/docs/app), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) e [deploy](https://nextjs.org/docs/app/getting-started/deploying).
- Limites de payload e execução das Vercel Functions: [limites](https://vercel.com/docs/functions/limitations), [duração](https://vercel.com/docs/functions/configuring-functions/duration).
- Supabase Auth e Storage privado/URLs assinadas: [Auth](https://supabase.com/docs/guides/auth), [downloads de Storage](https://supabase.com/docs/guides/storage/serving/downloads).
- Políticas de acesso a objetos: [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control); exclusão via API é necessária para remover o objeto de fato.
- OpenAI Structured Outputs e modelos: [Responses/saída estruturada](https://platform.openai.com/docs/api-reference/responses) e [modelos](https://platform.openai.com/docs/models).
- Stripe Checkout: [quickstart](https://docs.stripe.com/payments/checkout/quickstarts) e [API Checkout Sessions](https://docs.stripe.com/api/checkout/sessions).
