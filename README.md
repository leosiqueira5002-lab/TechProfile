# TechProfile AI

TechProfile AI é um produto planejado para ajudar profissionais de tecnologia a melhorar a apresentação de sua experiência em currículos e perfis profissionais, sempre preservando os fatos fornecidos pela pessoa.

## Estado do repositório

Aplicação Next.js App Router com TypeScript e interface responsiva. O fluxo inclui upload/extração temporária, análise demonstrativa, geração server-side de proposta de currículo com Gemini para Pro ativo, editor em memória, exportação por impressão, Supabase Auth e integração Mercado Pago. Currículos e rascunhos não são persistidos. A geração Gemini requer `GEMINI_API_KEY` e `GEMINI_MODEL` configurados no servidor; probes locais usaram apenas “Responda apenas OK”, sem currículo: sem structured output passou e com schema mínimo retornou HTTP 503 por alta demanda. Nenhum currículo real foi enviado e não houve deploy.

## Documentação

- `GOALS.md`: visão, fluxo principal e prioridades do MVP.
- `PLANS.md`: fases, critérios, validações, riscos, descobertas e decisões.
- `AGENTS.md`: instruções para contribuições futuras.
- `PROMPTS.md`: contratos conceituais para tarefas de IA.
- `docs/PRODUCT.md`: requisitos e limites do produto.
- `docs/ARCHITECTURE.md`: stack escolhida, arquitetura atual e integrações futuras propostas.
- `docs/AI_RULES.md`: regras de integridade e segurança para IA.
- `docs/DESIGN.md`: princípios de experiência e linguagem visual.
- `docs/SECURITY.md`: requisitos de segurança e privacidade implementados e pendentes.
- `docs/DECISIONS.md`: decisões pendentes e registro de decisões tomadas.

## Princípio central

A IA nunca pode inventar experiência, empresa, tecnologia, projeto, certificação, métrica, resultado, formação ou responsabilidade. Se algo não aparece no material, a conclusão é somente que a informação não foi encontrada.

## Desenvolvimento

```bash
npm install
npm run dev
```

Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no `.env.local` para habilitar cadastro, login e acesso às rotas `/analise` e `/curriculo`. O `.env.example` documenta os nomes das variáveis sem credenciais. Para callbacks de confirmação, configure no painel Supabase a Site URL e allowlist local/de produção conforme `docs/SECURITY.md`.

Para gerar uma proposta de currículo, configure `GEMINI_API_KEY` e `GEMINI_MODEL` no ambiente server-side. Use um projeto Gemini API com Paid Services ativo. A interface pede consentimento separado e remove identificadores diretos antes do envio. Revise `docs/AI_RULES.md` e `docs/SECURITY.md` antes de liberar o recurso.

Lint, typecheck e build: `npm run lint`, `npm run typecheck` e `npm run build`. Testes Node: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/*.test.mjs`.
