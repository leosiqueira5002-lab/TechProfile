# Decisões, auditoria e aprovações

Registre escolhas e questões em aberto. As linhas da auditoria mostram o estado em que cada decisão foi tomada; serviços e credenciais só estão configurados quando explicitamente registrado. Classificação: **OK** = coerente/documentado; **ATENÇÃO** = viável com condição ou risco mitigável; **BLOQUEADOR** = não iniciar a funcionalidade afetada até resolver o ponto.

## Auditoria técnica

| Item | Status | Análise e correção simples |
|---|---|---|
| Coerência geral da stack | OK | Next.js/TypeScript em monólito, Supabase e poucos serviços cobrem um SaaS inicial. Manter módulos simples; reavaliar somente quando houver volume ou limites comprovados. |
| Tecnologia desnecessária | ATENÇÃO | Sentry pode ser adiado até haver ambiente de produção; é útil, mas não necessário para landing e primeira validação. Evitar ORM, Redis, filas e kit visual grande por enquanto. |
| Upload PDF/DOCX | ATENÇÃO | Fluxo suporta ambos; encaminhar arquivo por Vercel Function falharia acima do body limit de 4,5 MB. Correção: upload direto autenticado ao Storage privado com política RLS e limites. |
| Extração de texto | ATENÇÃO | `pdf-parse` e `mammoth` cobrem documento textual comum; scans, PDFs complexos e DOCX malicioso exigem falhas explícitas, limites e parser isolado. OCR fica fora até avaliação. |
| Diagnóstico e otimização por IA | OK | API server-side e schema estruturado suportam os fluxos. Schema não prova factualidade; exigir vínculo com evidências e revisão humana. |
| PDF final para MVP | OK | Impressão nativa do HTML da prévia, apenas no navegador, com folha A4 e CSS de impressão. Não envia dados nem adiciona runtime/dependência. Playwright/Chromium server-side fica fora do MVP e só deve ser reconsiderado com requisito específico aprovado. |
| Autenticação | OK | Supabase Auth por e-mail/senha foi implementado com autorização server-side por `getClaims()`. Segundo o responsável, RLS/grants de profiles/payments foram aplicados e validados no Supabase remoto em 2026-09-29; não foram reconsultados nesta etapa. |
| Armazenamento privado | ATENÇÃO | Bucket privado/RLS é adequado. Não usar service key em operações comuns; exclusão deve chamar API Storage e limpar os dados relacionados, pois excluir metadata isoladamente não remove o objeto. |
| Retenção e exclusão | ATENÇÃO | “Original após 30 dias” não define texto, resultados, versões, logs, backups nem exclusão imediata. Definir prazos por categoria e procedimento antes de receber documentos reais. |
| Pagamentos Mercado Pago | ATENÇÃO | Checkout Pro avulso de R$ 19,90/30 dias foi implementado localmente com webhook HMAC e confirmação server-side. Ainda requer configuração sandbox, aplicação aprovada da migration e decisão sobre reembolso/chargeback, impostos e termos antes do lançamento. |
| LinkedIn futuro | OK | Arquitetura aceita texto fornecido pela pessoa sem scraping; obter conteúdo por entrada manual/autorizada e reutilizar regras de evidência e privacidade. |
| Análise futura de vagas | OK | Texto da vaga é entrada não confiável; pode ser comparado com evidências dos materiais quando persistência e retenção forem definidos. |
| Não invenção | OK | Regras estão em AI_RULES e caminho da arquitetura exige schema, evidências e revisão. Reforçar validação factual como teste de aceitação; Structured Outputs, sozinho, não impede alucinação. |
| Dados enviados à IA | ATENÇÃO | Texto pode conter identificadores desnecessários. Remover contatos/identificadores antes da chamada, enviar só trechos necessários, informar fornecedor e verificar política OpenAI: logs de abuso podem reter conteúdo até 30 dias por padrão. |
| Arquivos maliciosos/tamanho/MIME | ATENÇÃO | Validar MIME/extensão é insuficiente. Adicionar magic bytes, limites de arquivo/páginas/ZIP expansion/tempo/memória, rejeição de criptografados e parser isolado sem rede/credenciais; avaliar antivírus antes de produção. |
| Modelo `gpt-4.1-mini` | ATENÇÃO | Mantido como candidato; esta auditoria não executou benchmark e não recomenda troca automática. Antes de produção, comparar qualidade factual/português, preço real por tarefa, latência e recusa em conjunto anonimizado contra uma alternativa atual de custo menor e outra de qualidade maior; escolher pelo resultado. |
| Custo e viabilidade | ATENÇÃO | Custos variáveis mais relevantes: tokens de currículo e resposta, retries, Chromium/functions, armazenamento, observabilidade, taxas de pagamento, impostos e plano mínimo de provedores. Limitar tamanho/tokens, uma chamada estruturada por etapa quando possível, cotas por conta e alertas. Paywall recorrente aumenta taxa fixa/complexidade; cobrar por documento pode ser modelo inicial mais simples. Fazer planilha unit economics antes de definir preço. |

## Decisões tomadas

| Data | Tema | Escolha | Estado |
|---|---|---|---|
| 2026-09-23 | Stack | Next.js App Router, TypeScript, React, Route Handlers, Supabase Postgres/Auth/Storage, OpenAI API, impressão local, Vercel e Sentry propostos. | Proposta em evolução; IA, deploy e Sentry não configurados. |
| 2026-09-23 | Upload | Cliente envia diretamente ao bucket privado autenticado; evitar limite 4,5 MB da Vercel Function. | Correção documental recomendada; validar fluxo na implementação. |
| 2026-09-23 | IA | `gpt-4.1-mini` era um candidato para diagnóstico futuro; o provider diagnóstico permanece demo. A geração de currículo usa decisão separada de Gemini registrada em 2026-09-30. | OpenAI não é chamada pela otimização Gemini. |
| 2026-09-23 | Retenção | Persistência mínima prevista; prazos por categoria e exclusão completa devem ser aprovados. | Retenção de 30 dias para original era apenas proposta parcial. |
| 2026-09-23 | Factualidade | Não inventar fatos e tratar lacuna como ausência no material; evidência e revisão humana obrigatórias. | Requisito do produto. |
| 2026-09-26 | Exportação do currículo | Usar `window.print()` e `@media print`/`@page` A4 para imprimir somente a prévia HTML e permitir “Salvar como PDF”; desabilitar o botão sem conteúdo. | Aprovada para o MVP; local no navegador, sem dependências, chamadas ou persistência. |
| 2026-09-27 | Autenticação | Supabase Auth com e-mail/senha usando `@supabase/ssr`; cookies de sessão, callback PKCE e verificação server-side por `getClaims()` nas rotas de produto. | Implementada para `/entrar`, `/cadastro`, `/analise` e `/curriculo`; sem tabela de senhas ou service role no browser. |
| 2026-09-29 | Profiles e payments | Migration aditiva para perfil Free/Pro e registros Mercado Pago; RLS de leitura própria, trigger/backfill idempotentes e unicidade por pagamento externo. | Segundo o responsável, aplicada e validada no Supabase remoto. Checkout/webhook continuam fora da implementação atual. |
| 2026-09-29 | Mercado Pago Checkout Pro | Pagamento avulso R$ 19,90 BRL por 30 dias, Preferences API existente, Access Token apenas server-side, webhook assinado e RPC de concessão idempotente. | Implementado localmente em modo de teste. Migration aditiva criada; dry-run propôs somente esta migration. Sem aplicação remota ou deploy. |
| 2026-09-29 | Validação do ambiente de pagamento | O modo `test`/`production` é configuração server-side e deve acompanhar as credenciais correspondentes; não bloquear por divergência com `payment.live_mode` retornado pela consulta do pagamento, pois não foi encontrada exigência documental de igualdade no Checkout Pro Preferences e o campo divergiu em testes sandbox. Todas as demais validações do pagamento e a RPC idempotente permanecem obrigatórias. | Aplicado ao handler; sem alterações de credenciais, dados ou deploy. |
| 2026-09-29 | Referência externa do checkout | Assinar UUID do usuário no `external_reference` com HMAC-SHA256 e `MERCADO_PAGO_WEBHOOK_SECRET`, separando o manifesto por domínio; não usar UUID simples como prova de associação. | Ajuste de segurança durante implementação: teste demonstrou que UUID válido de outra conta não poderia ser distinguido sem vínculo autenticado. Sem tabela nova/credencial extra; checkout aguarda configuração da secret oficial. |
| 2026-09-30 | Geração de currículo com Gemini | Usar `@google/genai` e `GEMINI_MODEL=gemini-3.8-flash` como valor configurável; Structured Outputs com validação Zod/evidências; somente Pro ativo, sessão Supabase SSR, consentimento separado e estado em memória. O responsável confirmou Paid Services. | Implementada localmente; testes automatizados usam cliente falso. Um probe local isolado “Responda OK” recebeu HTTP 503; nenhum currículo real foi enviado e não houve deployment. Antes de Production: correlacionar novo log seguro com erro upstream, confirmar duração Vercel e estabelecer cotas/rate limiting e governança de privacidade. |

## Aprovações necessárias antes da implementação afetada

- **Migration de pagamentos:** implementação local concluída e dry-run revisado; aplicar `20260929000100_mercado_pago_payment_processor.sql` ao remoto requer autorização explícita separada.
- **BLOQUEADOR para documentos reais/produção:** aprovar aviso de privacidade e envio mínimo à OpenAI; conferir contrato, região, retenção e controles de dados de cada operador.
- Aprovar autenticação obrigatória e persistência de extração/resultado/versão final.
- Definir prazos para original, texto extraído, diagnósticos, currículo editado, dados de vaga/LinkedIn, logs e backups, além de exclusão sob solicitação.
- Confirmar limites por arquivo e suporte inicial a PDF textual/DOCX; escolher como tratar scans e documentos criptografados.
- Mercado Pago Checkout Pro foi escolhido e implementado em modo de teste; revisar termos, orçamento, reembolsos e operação de credenciais antes do lançamento.
- Aprovar avaliação do modelo: currículo anonimizado, rubrica de factualidade/português, volume de exemplos e orçamento de testes. Modelo inicial continua `gpt-4.1-mini` até esse resultado.
- Se surgir necessidade de PDF server-side no futuro, abrir decisão separada e validar isolamento, tamanho do runtime, sandbox, rede, memória, duração e carga; isso não é requisito nem dependência do MVP atual.
- Definir preço a partir de custo por jornada e taxa de pagamento; não lançar paywall sem unit economics.

## Fontes oficiais consultadas

- Vercel: [limite de 4,5 MB e demais limites de Functions](https://vercel.com/docs/functions/limitations), [duração](https://vercel.com/docs/functions/configuring-functions/duration).
- Supabase: [Storage privado e RLS](https://supabase.com/docs/guides/storage/buckets/fundamentals), [controle de acesso](https://supabase.com/docs/guides/storage/security/access-control), [RLS no Postgres](https://supabase.com/docs/guides/database/postgres/row-level-security).
- OpenAI: [controles de dados e retenção padrão de logs de abuso](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint), [modelos atuais](https://platform.openai.com/docs/models).
- Supabase: [testes de banco com pgTAP](https://supabase.com/docs/guides/database/testing).
- Mercado Pago: [Checkout Pro Preferences API](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/overview), [criar preferência](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/create-payment-preference), [back URLs](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/configure-back-urls), [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks?scope=prod) e [obter pagamento](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/get-payment/get). Consultadas em 2026-09-29.

## Registro futuro

Para cada decisão aprovada ou revisada, anotar data, responsável, contexto e consequências. Registrar resultados do benchmark de IA e prova do Playwright/Vercel antes de declarar essas escolhas validadas.
