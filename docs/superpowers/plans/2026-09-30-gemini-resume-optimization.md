# Gemini Resume Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task after approval.

**Goal:** Let authenticated active Pro users generate a fact-bound, editable `ResumeDraft` from the extracted resume and career context using Gemini server-side.

**Architecture:** Add one authenticated Next.js Route Handler and a server-only Gemini adapter under `features/resume/`. Reuse Supabase SSR/session, `isProActive`, the existing extracted-text limit/redactor and in-memory resume context; validate a structured provider DTO and convert it to the existing `ResumeDraft` contract before returning it.

**Tech Stack:** Next.js App Router, TypeScript, Zod already installed, official `@google/genai` SDK, Gemini `models.generateContent`, Supabase SSR session, React memory context.

**Spec:** `docs/superpowers/specs/2026-09-30-gemini-resume-optimization-design.md`

## Global Constraints

- No database, browser persistence, new cookies, query-string resume data, PDF generation changes, Mercado Pago changes, OpenAI call, or deployment.
- Only authenticated active Pro profiles may invoke Gemini; re-check with `isProActive` on each server request.
- `GEMINI_API_KEY` and `GEMINI_MODEL` are server-only; no secret in client bundle or logs.
- Accept only `{ extractedText, area, role }`; maximum 200,000 characters and at least 100 non-whitespace characters.
- Require `x-resume-gemini-consent: true` for the separately disclosed user action; it does not authorize access or substitute for the Pro check.
- Redact direct identifiers before Gemini; derive `personalInfo` locally and set desired role from validated input.
- Final response is the existing `ResumeDraft` shape; server creates IDs; unsupported, malformed or evidence-invalid model output fails as a whole.
- Require separate explicit disclosure/consent for Gemini. Paid Service project is mandatory before real resume processing; no automated tests call Google.
- Keep `analysisProvider` and diagnosis behavior unchanged; this is a separate resume-generation provider.

## Review Focus

- Prompt injection embedded in extracted text: prove it cannot change instructions or request secrets/tools.
- Names, dates, technologies, companies and metrics hallucinated outside source: reject/omit unsupported facts.
- Project/personal/academic work recast as employment: keep it in the project section or omit.
- Pro expires after page load: API rechecks the current profile and returns 403 before provider invocation.
- Free-plan CTA, missing/invalid consent, malformed provider response or timeout: no draft navigation or partial field application.

---

### Task 1: Shared optimization contracts and evidence validation

**Files:**
- Create `features/resume/optimization-contract.ts`
- Modify `features/resume/transfer.ts` only to expose a pure conservative `personalInfo` extraction helper if needed
- Test `tests/resume-optimization.test.mjs`

**Interfaces:**
- `OptimizeResumeInputSchema` accepts exactly `extractedText`, `area`, `role`.
- `GeminiResumeCandidateSchema` is based on actual `ResumeDraft` field names and `RESUME_FIELD_LIMITS`; omits generated IDs, direct personal info and desired role; includes literal source evidence for generated factual text/items.
- `validateGeminiResumeCandidate(candidate, redactedSource)` returns either a fully checked candidate or a generic validation failure.
- `buildOptimizedResumeDraft(candidate, source, role)` returns a complete `ResumeDraft`, adding locally extracted personal information, validated role, and server-generated item IDs.

- [x] Write failing tests for strict request keys, 200,000 character cap, minimum useful text, exact field lengths, evidence quote requirement, unsupported technologies/dates/companies, omission when absent, projects remaining projects, and generated IDs.
- [x] Run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/resume-optimization.test.mjs`; confirm the new assertions fail before implementation.
- [x] Implement the contract and conservative mapper using existing field limits and `redactResumeText`; require evidence quotes to be literal in redacted source and validate identifiable factual fields against that evidence/source.
- [x] Re-run the focused tests and verify that any invalid evidence rejects the entire response, with no partial draft.

### Task 2: Server-only Gemini adapter

**Files:**
- Create `features/resume/providers/gemini.ts`
- Create `features/resume/optimization-prompt.ts` or keep the fixed prompt in the provider module if that remains clearer
- Modify `package.json` and `package-lock.json` to add only official `@google/genai`
- Test `tests/gemini-resume-provider.test.mjs`

**Interfaces:**
- `optimizeWithGemini(input, options?)` takes validated text/area/role and returns a checked `ResumeDraft`.
- Optional injected client/factory in tests; production creates `GoogleGenAI` using only server environment.

- [x] Add mocked SDK tests for correct model selection, JSON MIME/schema options, redacted text only, prompt instructions, absent `GEMINI_API_KEY`/`GEMINI_MODEL`, empty/malformed/blocked response, provider error and timeout.
- [x] Run the focused tests; ensure they fail before adding the adapter.
- [x] Add the current official `@google/genai` package as a production dependency; no legacy `@google/generative-ai` package and no new schema dependency (Zod already exists).
- [x] Implement the adapter with `GoogleGenAI`, `models.generateContent`, `GEMINI_API_KEY`, required `GEMINI_MODEL`, fixed system instruction, `responseMimeType: "application/json"`, and the candidate JSON Schema; parse and validate the complete response before returning.
- [x] Re-run provider tests with mocked SDK only. Do not call Gemini from automated tests.

### Task 3: Authenticated Pro-only API route

**Files:**
- Create `app/api/resumes/optimize/route.ts`
- Test `tests/resume-optimize-api.test.mjs`

**Interfaces:**
- `POST /api/resumes/optimize` reads bounded JSON and returns `{ draft: ResumeDraft }` only after session, current profile, Pro, input, provider output and final schema checks.

- [x] Add route tests for unauthenticated 401; Free, expired, missing/invalid profile 403; Pro active success; insufficient text/bad role/bad area 400/422; oversized body 413; missing config 503; invalid provider output 502; and no provider call for rejected requests.
- [x] Confirm tests fail before route implementation.
- [x] Implement Node Route Handler using `createClient()` + `auth.getClaims()`, session-authenticated `profiles.select("plan, pro_expires_at")`, and `isProActive`; do not import admin/service-role client or query `payments`.
- [x] Read body with a byte bound derived from `MAX_EXTRACTED_CHARACTERS`, map all provider errors to safe Portuguese messages/status codes, and log only safe stage/category metadata if logging is needed.
- [x] Run the focused API tests and confirm no body, secret, user identifier or SDK raw error is returned/logged.

### Task 4: Post-analysis CTA and in-memory editor handoff

**Files:**
- Create `features/resume/components/resume-optimization-cta.tsx`
- Modify `components/resume-analysis-workspace.tsx`
- Reuse `features/resume/resume-draft-context.tsx`, `features/resume/components/resume-builder-from-context.tsx`, and `components/subscribe-pro-button.tsx` without adding persistence
- Add/adjust focused UI coverage in `tests/resume-optimization-cta.test.mjs`

- [x] Test completed analysis displays CTA; active Pro requires separate consent then sends exact input and on success writes draft to context/navigates `/curriculo`; loading prevents duplicate calls; failure leaves editor/context untouched; Free shows paywall and never calls optimize endpoint.
- [x] Implement only the necessary CTA state/copy, consent disclosure, loading and friendly errors, keeping existing visual styles and checkout control.
- [x] On successful response, pass only the server-validated `draft` to `setDraft` and use existing client navigation; `/curriculo` without in-memory context remains blank.
- [x] Verify editor can still be manually changed and preview reflects changes after generated draft handoff.

### Task 5: Privacy docs, configuration example, and full verification

**Files:**
- Modify `PLANS.md`
- Modify `docs/ARCHITECTURE.md`
- Modify `docs/SECURITY.md`
- Modify `docs/AI_RULES.md`
- Modify `docs/DECISIONS.md`
- Modify `.env.example`
- Verify `README.md` only if feature/status descriptions become stale

- [x] Add placeholders `GEMINI_API_KEY=` and `GEMINI_MODEL=gemini-3.8-flash` to `.env.example`; include no actual credential. Preserve existing variables.
- [x] Document server-only SDK/provider, Pro authorization, response validation, consent, Paid Tier privacy caveat, transient state, rate-limit/cost risk and remaining production conditions.
- [x] Record actual progress, discoveries, decision status and retrospective in `PLANS.md`; preserve deployment as unperformed and do not describe unresolved approval as complete.
- [x] Run `npm run lint`, `npm run typecheck`, `npm run build`, `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/*.test.mjs`, and `git diff --check`.
- [ ] Manually test Free, Pro active/expired, consent, loading, provider error, success to `/curriculo`, fields omitted without evidence, editor/preview, mobile layout, browser console, no horizontal overflow, and no secret/text in logs. If no paid-tier credentials are available, use mocks and report live Gemini check as not run.

## Approval gates before execution

- Written specification approval.
- Written plan approval and selected execution method.
- Confirmation that the configured Google project uses Paid Services (active Cloud Billing) before any real resume is sent.
- Confirm the consent wording and Vercel function duration/cost constraints before any production deploy.
