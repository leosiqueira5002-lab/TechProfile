# Mercado Pago Checkout Pro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a one-time TechProfile Pro payment of R$ 19,90 that grants 30 days only after server verification and extends access exactly once per approved Mercado Pago payment.

**Architecture:** Authenticated Next.js Route Handler creates a server-priced Checkout Pro preference through the existing Preferences API. A signed HTTPS webhook re-fetches the payment from Mercado Pago, validates all authoritative fields, and calls a locked-down Postgres RPC that atomically records the payment and extends `profiles`; static return pages never grant access.

**Tech Stack:** Next.js App Router/TypeScript Node Route Handlers, native `fetch` and `node:crypto`, existing `@supabase/ssr`/`@supabase/supabase-js`, PostgreSQL additive migration and pgTAP, Node tests with mocked provider/database.

**Spec:** `docs/superpowers/specs/2026-09-29-mercado-pago-checkout-pro-design.md`

## Global Constraints

- One-time checkout only: R$ 19,90 BRL, quantity 1, exactly 30 access days.
- The browser cannot choose price, amount, user, status, provider payment ID, or expiry.
- Access Token, Webhook Secret and Supabase service role remain server-only and are never logged.
- Use Checkout Pro Preferences API; do not migrate to Orders API or recreate the Mercado Pago app.
- Only a server-fetched, verified `approved` payment can extend a profile.
- Duplicate approved events must not grant a second 30-day period.
- `back_urls`/`notification_url` use public HTTPS URLs; never use localhost or 127.0.0.1.
- Return pages are presentation only and never authorize or mutate plan state.
- Migration changes are additive; do not automatically apply any migration remotely.
- Do not initiate real payments in automated tests; use fake fixtures and mocks.
- No recurring billing, refunds/chargebacks, Pro resource gates, AI, resume persistence, or unrelated redesign.

## Review Focus

- Authenticated identity is the only source for checkout ownership; test request bodies that try to override it in Task 2.
- Decimal/currency/status mismatches fail closed; test malformed and non-approved provider replies in Task 3.
- HMAC signs the current documented manifest, including casing rules for `data.id`; test tampering/missing parts in Task 3.
- Concurrent duplicate approvals grant at most once; exercise transactional unique-key behavior in Task 4 pgTAP.
- A live/test mismatch or loopback callback cannot create a checkout or grant Pro; test config validation in Tasks 2–3.

---

### Task 1: Server-side billing configuration and Mercado Pago client

**Files:**
- Create: `features/billing/product.ts`
- Create: `features/billing/mercado-pago.ts`
- Create: `features/billing/mercado-pago-signature.ts`
- Create: `lib/supabase/admin.ts`
- Test: `tests/mercado-pago-config.test.mjs`
- Test: `tests/mercado-pago-signature.test.mjs`
- Modify: `.env.example`
- Modify: `.gitignore` only if the existing secret-file rules do not already ignore local env files.

**Interfaces:**
- `TECHPROFILE_PRO = { title: "TechProfile Pro", amount: 19.9, currency: "BRL", quantity: 1, accessDays: 30 } as const` is the single server-side product definition.
- `createMercadoPagoPreference(input: { userId: string; appUrl: URL }): Promise<{ checkoutUrl: string }>` performs `POST /checkout/preferences` and chooses sandbox/live URL using mode.
- `getMercadoPagoPayment(paymentId: string): Promise<VerifiedPaymentPayload>` performs authenticated `GET /v1/payments/{id}` and validates response shape before returning typed provider data.
- `verifyMercadoPagoWebhookSignature(input: { signature: string; requestId: string; dataId: string; secret: string }): boolean` follows the official manifest/HMAC rules and uses constant-time comparison.
- Admin Supabase client is server-only and constructed from server env; it is not imported by client components.

- [ ] **Step 1: Add failing tests for immutable product config, mode-specific checkout URL selection, loopback URL rejection and official HMAC manifest.** Use known fake secrets/signatures only.
- [ ] **Step 2: Run focused tests and confirm the new contracts fail before implementation.**
- [ ] **Step 3: Implement configuration and provider helpers with native fetch/crypto; do not add npm dependencies.** Do not log request/response bodies or authorization headers.
- [ ] **Step 4: Add only placeholder variable names to `.env.example`: `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `MERCADO_PAGO_MODE`, `NEXT_PUBLIC_APP_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; keep secrets server-side.**
- [ ] **Step 5: Run focused tests, lint and typecheck.**

### Task 2: Authenticated checkout endpoint

**Files:**
- Create: `app/api/checkout/route.ts`
- Create: `tests/checkout-api.test.mjs`
- Modify: `docs/ARCHITECTURE.md` only if exact finalized contracts differ from this approved plan.

**Interfaces:**
- `POST /api/checkout` accepts no trusted payment fields, signs the authenticated user UUID into `external_reference` using `MERCADO_PAGO_WEBHOOK_SECRET`, and returns `{ checkoutUrl: string }`.
- Uses existing server Supabase Auth client and `auth.getClaims()` to derive `userId`.
- Calls `createMercadoPagoPreference({ userId, appUrl })` from Task 1.

- [ ] **Step 1: Test unauthenticated request returns 401 with no provider call.**
- [ ] **Step 2: Test client-supplied price/days/user/status/payment ID cannot affect the preference because request body is ignored; values stay at 19.90 BRL and 30 days, and signed external reference verifies to authenticated `userId`.**
- [ ] **Step 3: Implement route with fixed product payload, validated absolute public callback base URL, server-only token, and sanitized errors.**
- [ ] **Step 4: Test missing configuration, provider failure, sandbox link in test mode, live link in production mode, rejection of localhost URLs and no credential disclosure.**

### Task 3: Signed Mercado Pago webhook and authoritative payment verification

**Files:**
- Create: `app/api/webhooks/mercado-pago/route.ts`
- Create: `tests/mercado-pago-webhook.test.mjs`
- Modify: `features/billing/mercado-pago.ts`
- Modify: `features/billing/mercado-pago-signature.ts`

**Interfaces:**
- `POST /api/webhooks/mercado-pago` reads `x-signature`, `x-request-id`, query `data.id`, and payment notification body.
- Validates HMAC before `GET /v1/payments/{id}`; only verified response values can reach Task 4 RPC.
- `processVerifiedPayment(payment: VerifiedPaymentPayload): Promise<"recorded" | "duplicate" | "not-approved">` is server-only orchestration.

- [ ] **Step 1: Add failing route tests for missing/invalid signatures, malformed data.id, no payment lookup before signature passes, and unsupported valid event acknowledgement.**
- [ ] **Step 2: Add fake provider lookup tests for pending/rejected, wrong amount/currency/reference, wrong mode, wrong payment ID, body/query data ID mismatch and approved correct payment.**
- [ ] **Step 3: Implement signature validation according to official `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` manifest; normalize alphanumeric data ID per official instructions; compare HMAC-SHA256 in constant time.**
- [ ] **Step 4: Fetch the actual payment with the server token; compare ID, mode, BRL, R$ 19.90, external reference UUID and status; never trust webhook fields for those values.**
- [ ] **Step 5: Invoke only the privileged RPC for fully validated payment details; map transient provider/database errors to non-2xx and safe logs.**
- [ ] **Step 6: Run focused tests and check no provider secrets/signatures/payment bodies are logged or returned.**

### Task 4: Atomic SQL processing and idempotent Pro extension

**Files:**
- Create: `supabase/migrations/20260929000100_mercado_pago_payment_processor.sql`
- Create: `supabase/tests/database/20260929000100_mercado_pago_payment_processor.test.sql`
- Create: `tests/mercado-pago-grant.test.mjs`

**Interfaces:**
- Create `public.apply_mercado_pago_payment(p_user_id uuid, p_provider_payment_id text, p_amount numeric, p_currency text, p_status text, p_access_days integer) returns text` (or an equivalent small result enum/table) as a single transaction.
- Only `service_role` may execute it; revoke from `PUBLIC`, `anon`, and `authenticated`; `SECURITY DEFINER`, `SET search_path = ''`, fully qualified object names.
- RPC validates Mercado Pago provider, `19.90`, `BRL`, allowed states, 30 days and existing profile; same provider payment ID cannot bind to another user.

- [ ] **Step 1: Add failing Node tests for free grant +30 days, active Pro extension from existing expiry, expired Pro reset from now, and duplicate approval.**
- [ ] **Step 2: Add pgTAP tests for function grants, invalid arguments, user mismatch, unique payment, status transition and duplicate approved idempotency.**
- [ ] **Step 3: Implement additive SQL function.** Use conflict-safe row locking; persist verified status; grant only on the first transition to `approved`; update profile and payment in the same database transaction; compute expiry as `greatest(transaction_timestamp(), coalesce(pro_expires_at, transaction_timestamp())) + interval '30 days'`.
- [ ] **Step 4: Ensure reprocessed approved payment returns duplicate without changing expiry, and a payment ID already bound to another user fails closed.**
- [ ] **Step 5: Run Node tests. Run pgTAP only against a disposable local Supabase/Postgres database; never run `db push`, `db reset` remote, or migration on the configured remote project.**

### Task 5: Buyer return pages

**Files:**
- Create: `app/(payment)/pagamento/sucesso/page.tsx`
- Create: `app/(payment)/pagamento/pendente/page.tsx`
- Create: `app/(payment)/pagamento/erro/page.tsx`
- Create: `tests/payment-return-pages.test.mjs`

**Interfaces:**
- Static, accessible server-rendered pages for the three configured `back_urls`.
- No query parameter is used to change `profiles`, call grant RPC, or claim confirmed entitlement.

- [ ] **Step 1: Test each return page copy/route and assert none calls payment mutation, provider, or grant services.**
- [ ] **Step 2: Implement concise states: received/awaiting server confirmation; payment pending; payment not confirmed with retry path.**
- [ ] **Step 3: Verify direct visits and arbitrary `status`/`payment_id` query values never grant Pro.**

### Task 6: Configuration/security docs and end-to-end verification

**Files:**
- Modify: `PLANS.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/DECISIONS.md`
- Modify: `.env.example`
- Test: complete `tests/*.test.mjs` suite and pgTAP on disposable local DB if available.

- [ ] **Step 1: Document required configuration, HTTPS public Mercado Pago webhook URL, payment topic, webhook secret setup, test/live separation, confirm `NEXT_PUBLIC_APP_URL` exists in the runtime without printing its value, and preserve the remote migration approval gate.** Never copy credential values.
- [ ] **Step 2: Run `npm run lint`, `npm run typecheck`, `npm run build`, every Node test and `git diff --check`; run SQL tests locally if available.**
- [ ] **Step 3: Use only Mercado Pago sandbox/test credentials and an HTTPS test callback during manual sandbox verification; verify free/active/expired/duplicate scenarios without switching production credentials.**
- [ ] **Step 4: Review Git diff and ignored files; confirm no secret, access token, real payment, or unintended migration is present.**
- [ ] **Step 5: Stop. Do not deploy, apply the new migration to remote Supabase, activate production mode, or begin another feature without separate approval.**

## Not part of this plan

No implementation before the written specification and this plan are approved. No recurring payments, subscriptions, Orders API, refunds/chargebacks, access gates, AI, resume persistence, redesign, deployment or remote migration application.
