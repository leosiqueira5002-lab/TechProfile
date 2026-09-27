# Instruções para agentes

## Contexto

Este repositório contém a aplicação TechProfile AI em Next.js App Router/TypeScript e sua documentação. A stack está registrada em `docs/ARCHITECTURE.md`; o escopo ativo deve ser conferido em `PLANS.md`.

## Regras de trabalho

- Antes de implementar, leia `README.md`, `GOALS.md`, `PLANS.md` e os documentos relevantes em `docs/`.
- Trabalhe somente no escopo da fase ativa descrita em `PLANS.md`.
- Prefira a solução mais simples que atenda aos requisitos. Não introduza serviços, abstrações ou dependências sem necessidade demonstrada.
- Não instale dependências, configure banco, pagamentos, APIs externas ou deploy sem uma decisão registrada e autorização explícita para a fase correspondente.
- Não altere código de aplicação durante tarefas limitadas à documentação.
- Atualize `PLANS.md` quando o progresso, riscos, descobertas ou decisões mudarem.
- Preserve dados enviados por usuários e nunca transforme ausência de informação em afirmação sobre a pessoa.
- A IA não pode inventar experiência, empresas, tecnologias, projetos, certificações, métricas, resultados, formação ou responsabilidades. Toda afirmação profissional gerada deve ser rastreável ao conteúdo fornecido pelo usuário.
- Antes de concluir uma alteração, revise o diff e execute as validações pertinentes à tarefa. Não declare validações que não foram executadas.

## Estado atual

Estado conhecido: Next.js App Router com TypeScript, React, Tailwind e ESLint; autenticação Supabase (e-mail/senha) via `@supabase/ssr`; upload e análise demo em fases anteriores; currículo editável em memória e exportação local para PDF/impressão. Não há persistência de currículo, pagamentos ou IA real. Consulte `package.json`, `docs/ARCHITECTURE.md` e `PLANS.md` antes de mudar esses limites.
