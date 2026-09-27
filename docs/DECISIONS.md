# Decisões, auditoria e aprovações

Registre escolhas e questões em aberto. A arquitetura é proposta, não serviço configurado. Classificação da auditoria: **OK** = coerente/documentado; **ATENÇÃO** = viável com condição ou risco mitigável; **BLOQUEADOR** = não iniciar a funcionalidade afetada até resolver o ponto.

## Auditoria técnica

| Item | Status | Análise e correção simples |
|---|---|---|
| Coerência geral da stack | OK | Next.js/TypeScript em monólito, Supabase e poucos serviços cobrem um SaaS inicial. Manter módulos simples; reavaliar somente quando houver volume ou limites comprovados. |
| Tecnologia desnecessária | ATENÇÃO | Sentry pode ser adiado até haver ambiente de produção; é útil, mas não necessário para landing e primeira validação. Evitar ORM, Redis, filas e kit visual grande por enquanto. |
| Upload PDF/DOCX | ATENÇÃO | Fluxo suporta ambos; encaminhar arquivo por Vercel Function falharia acima do body limit de 4,5 MB. Correção: upload direto autenticado ao Storage privado com política RLS e limites. |
| Extração de texto | ATENÇÃO | `pdf-parse` e `mammoth` cobrem documento textual comum; scans, PDFs complexos e DOCX malicioso exigem falhas explícitas, limites e parser isolado. OCR fica fora até avaliação. |
| Diagnóstico e otimização por IA | OK | API server-side e schema estruturado suportam os fluxos. Schema não prova factualidade; exigir vínculo com evidências e revisão humana. |
| PDF final para MVP | OK | Impressão nativa do HTML da prévia, apenas no navegador, com folha A4 e CSS de impressão. Não envia dados nem adiciona runtime/dependência. Playwright/Chromium server-side fica fora do MVP e só deve ser reconsiderado com requisito específico aprovado. |
| Autenticação | OK | Supabase Auth por e-mail/senha foi implementado com autorização server-side por `getClaims()`. RLS/grants continuam necessários antes de persistir dados de produto. |
| Armazenamento privado | ATENÇÃO | Bucket privado/RLS é adequado. Não usar service key em operações comuns; exclusão deve chamar API Storage e limpar os dados relacionados, pois excluir metadata isoladamente não remove o objeto. |
| Retenção e exclusão | ATENÇÃO | “Original após 30 dias” não define texto, resultados, versões, logs, backups nem exclusão imediata. Definir prazos por categoria e procedimento antes de receber documentos reais. |
| Pagamento Stripe | ATENÇÃO | Stripe lista Brasil entre países suportados e oferece Checkout. Porém produto específico de planos de assinatura pode não estar disponível no Brasil; decidir one-time versus recorrência, meios, moeda, impostos e preço antes de implementar paywall. Não criar checkout/billing até decisão. |
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
| 2026-09-23 | Stack | Next.js App Router, TypeScript, React, Route Handlers, Supabase Postgres/Auth/Storage, OpenAI API, Playwright, Stripe Checkout, Vercel e Sentry propostos. | Proposta para aprovação; não configurada. |
| 2026-09-23 | Upload | Cliente envia diretamente ao bucket privado autenticado; evitar limite 4,5 MB da Vercel Function. | Correção documental recomendada; validar fluxo na implementação. |
| 2026-09-23 | IA | `gpt-4.1-mini` permanece como modelo candidato e configurável até benchmark. | Sem aprovação final de fornecedor/retention. |
| 2026-09-23 | Retenção | Persistência mínima prevista; prazos por categoria e exclusão completa devem ser aprovados. | Retenção de 30 dias para original era apenas proposta parcial. |
| 2026-09-23 | Factualidade | Não inventar fatos e tratar lacuna como ausência no material; evidência e revisão humana obrigatórias. | Requisito do produto. |
| 2026-09-26 | Exportação do currículo | Usar `window.print()` e `@media print`/`@page` A4 para imprimir somente a prévia HTML e permitir “Salvar como PDF”; desabilitar o botão sem conteúdo. | Aprovada para o MVP; local no navegador, sem dependências, chamadas ou persistência. |
| 2026-09-27 | Autenticação | Supabase Auth com e-mail/senha usando `@supabase/ssr`; cookies de sessão, callback PKCE e verificação server-side por `getClaims()` nas rotas de produto. | Implementada para `/entrar`, `/cadastro`, `/analise` e `/curriculo`; sem tabela de senhas, service role ou perfil persistido. |

## Aprovações necessárias antes da implementação afetada

- **BLOQUEADOR para cobrança:** confirmar se o paywall será pagamento avulso ou recorrente, preço, moeda, meios de pagamento e condições de cancelamento. Se recorrência for essencial, confirmar elegibilidade e suporte específico da Stripe no Brasil ou escolher provedor alternativo. Checkout hospedado não remove obrigações de preço, nota/impostos ou atendimento.
- **BLOQUEADOR para documentos reais/produção:** aprovar aviso de privacidade e envio mínimo à OpenAI; conferir contrato, região, retenção e controles de dados de cada operador.
- Aprovar autenticação obrigatória e persistência de extração/resultado/versão final.
- Definir prazos para original, texto extraído, diagnósticos, currículo editado, dados de vaga/LinkedIn, logs e backups, além de exclusão sob solicitação.
- Confirmar limites por arquivo e suporte inicial a PDF textual/DOCX; escolher como tratar scans e documentos criptografados.
- Aprovar fornecedores propostos (Supabase, OpenAI, Vercel, Stripe, Sentry) e orçamento mensal inicial.
- Aprovar avaliação do modelo: currículo anonimizado, rubrica de factualidade/português, volume de exemplos e orçamento de testes. Modelo inicial continua `gpt-4.1-mini` até esse resultado.
- Se surgir necessidade de PDF server-side no futuro, abrir decisão separada e validar isolamento, tamanho do runtime, sandbox, rede, memória, duração e carga; isso não é requisito nem dependência do MVP atual.
- Definir preço a partir de custo por jornada e taxa de pagamento; não lançar paywall sem unit economics.

## Fontes oficiais consultadas

- Vercel: [limite de 4,5 MB e demais limites de Functions](https://vercel.com/docs/functions/limitations), [duração](https://vercel.com/docs/functions/configuring-functions/duration).
- Supabase: [Storage privado e RLS](https://supabase.com/docs/guides/storage/buckets/fundamentals), [controle de acesso](https://supabase.com/docs/guides/storage/security/access-control), [RLS no Postgres](https://supabase.com/docs/guides/database/postgres/row-level-security).
- OpenAI: [controles de dados e retenção padrão de logs de abuso](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint), [modelos atuais](https://platform.openai.com/docs/models).
- Stripe: [disponibilidade no Brasil](https://stripe.com/br/global), [preços no Brasil](https://stripe.com/en-br/pricing), [países suportados para subscription pricing plans](https://docs.stripe.com/finance-automation/subscription-pricing).

## Registro futuro

Para cada decisão aprovada ou revisada, anotar data, responsável, contexto e consequências. Registrar resultados do benchmark de IA e prova do Playwright/Vercel antes de declarar essas escolhas validadas.
