# Supabase Profiles & Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a base aditiva e segura de profiles/payments no Supabase e uma função local para validar validade temporal do plano Pro.

**Architecture:** Uma migration cria duas tabelas, RLS restritivo, policies somente de leitura própria, grants mínimos, trigger de profile e backfill idempotente. Um helper TypeScript puro calcula acesso Pro sem consultar banco; pgTAP descreve as garantias SQL, sem executar contra Supabase remoto.

**Tech Stack:** PostgreSQL/Supabase migrations, pgTAP, TypeScript, Node `node:test`, scripts existentes de Next.js.

**Spec:** `docs/superpowers/specs/2026-09-29-supabase-profiles-payments-design.md`

## Global Constraints

- Migration aditiva, sem `DROP`, `TRUNCATE`, alteração ou remoção de dados/tabelas existentes.
- Usuário comum pode somente ler suas próprias linhas de `profiles` e `payments`.
- Nenhuma escrita de plano, validade ou pagamento concedida a `anon` ou `authenticated`.
- Nunca inserir senha, chave, token, credencial real ou valor real de pagamento nos testes.
- Trigger usa `SECURITY DEFINER` somente para inserir profile, `search_path` explícito e seguro, nomes qualificados e operação idempotente.
- Sem Mercado Pago Checkout, webhook, pagamento, grant de Pro ou alteração de acesso em runtime.
- Não aplicar migration ao banco remoto nem executar operação destrutiva.
- Nenhuma dependência npm nova. pgTAP SQL pode ser adicionado, embora não seja executável neste ambiente sem Supabase CLI/PostgreSQL local.

## Review Focus

- Backfill reexecutado preserva profiles existentes e não duplica linhas.
- Trigger não confia em `raw_user_meta_data` para atribuir plano ou validade.
- Usuário autenticado não lê linha de outra pessoa e não pode escrever nenhuma das tabelas.
- Pro expirado no limite temporal exato não é considerado ativo.
- Constraint de idempotência é composta por provedor e ID externo, não só por ID externo.

---

### Task 1: Regra pura de acesso Pro

**Files:**
- Create: `features/billing/access.ts`
- Create: `tests/billing-access.test.mjs`

**Interface:** `isProActive(profile, now): boolean`; `profile` aceita somente `plan` e `pro_expires_at` ou `null`; `now` é `Date` explícito para manter a função determinística.

- [x] **Step 1: Escrever testes primeiro** para Free, Pro futuro, Pro exatamente no limite, Pro expirado, validade ausente e validade inválida.
- [x] **Step 2: Rodar teste** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/billing-access.test.mjs`; confirmar falha por módulo/função ausente.
- [x] **Step 3: Implementar helper mínimo** em `features/billing/access.ts`, sem dependências, acesso a ambiente, banco, sessão ou clock global.
- [x] **Step 4: Reexecutar os testes** e confirmar que somente Pro com data estritamente futura retorna `true`.

### Task 2: Migration de profiles, payments e controles SQL

**Files:**
- Create: `supabase/migrations/20260929000000_profiles_payments.sql`
- Create: `supabase/tests/database/20260929000000_profiles_payments.test.sql`

**Interfaces:** tabelas e funções descritas na especificação; sem interface HTTP ou camada de pagamento.

- [x] **Step 1: Escrever pgTAP** com fixture de dois usuários fictícios e pagamentos sintéticos; cobrir valores/defaults, trigger, backfill idempotente, grants/policies/RLS, leitura própria/cruzada, bloqueio de escrita e duplicidade.
- [x] **Step 2: Revisar o teste SQL** para garantir `BEGIN`/rollback e ausência de chaves, tokens e acesso a serviço externo. `supabase test db` não pode ser executado sem Supabase CLI local; não aplicá-lo ao remoto.
- [x] **Step 3: Criar migration aditiva** com FKs `ON DELETE CASCADE`, defaults/checks, constraint UNIQUE composta, grants mínimos, policies SELECT own, helper `updated_at`, trigger de signup `SECURITY DEFINER` com `SET search_path = ''`, objetos qualificados e `ON CONFLICT DO NOTHING`.
- [x] **Step 4: Incluir backfill** de `auth.users` sem profile usando `INSERT ... SELECT ... ON CONFLICT (user_id) DO NOTHING`; não atualizar registros existentes.
- [x] **Step 5: Fazer revisão estática**: confirmar nenhuma instrução destrutiva, nenhum dado real e correspondência entre constraints/policies e testes. Executar pgTAP somente se um banco Supabase local descartável já estiver disponível; não instalar CLI nem apontar ao remoto.

### Task 3: Documentar estado e decisões

**Files:**
- Modify: `PLANS.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/DECISIONS.md`

- [x] **Step 1: Atualizar arquitetura** com modelo das tabelas, grants/RLS, trigger/backfill e helper temporal; deixar Checkout/webhook como futuro.
- [x] **Step 2: Atualizar segurança** com limites de escrita, privilégio do trigger, idempotência e proibição de aplicar migration remota automaticamente.
- [x] **Step 3: Registrar Mercado Pago** como provedor escolhido para futuro Checkout Pro, sem declarar integração implementada; preservar pendências de preço, estados/reembolso e política comercial.
- [x] **Step 4: Atualizar PLANS.md** com arquivos, critérios, validação executada/não executável, limitações e próximo marco sem iniciar Checkout.

### Task 4: Validação final

- [x] Executar `npm run lint`.
- [x] Executar `npm run typecheck`.
- [x] Executar `npm run build`.
- [x] Executar `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/*.test.mjs` (79/79 testes passaram com o servidor local ativo).
- [x] Executar `git diff --check` e revisar lista/diff dos arquivos.
- [x] Reportar pgTAP não executado: Supabase CLI e PostgreSQL local não estão disponíveis; confirmar que nenhuma migration foi aplicada ao remoto.

## Fora do escopo

Checkout Mercado Pago; webhooks; APIs backend que alterem pagamentos ou planos; bloqueio de recursos Pro; telas de pagamento; definição de preço/recorrência; alteração de Auth; serviço de perfil; Supabase remoto; alterações destrutivas; aplicação automática da migration.
