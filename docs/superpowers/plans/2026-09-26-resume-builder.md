# Resume Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/curriculo` into an empty, in-memory resume editor with a live preview.

**Architecture:** A typed `ResumeDraft` and pure model helpers live in `features/resume/`. A client builder owns ephemeral state and composes separate editor and preview components; the existing route renders it without initial data.

**Tech Stack:** Existing Next.js App Router, React, TypeScript, existing CSS and Node built-in test runner; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-26-resume-builder-design.md`

## Global Constraints

- `/curriculo` starts empty and stores the draft only in component memory.
- No connection to `/analise`, AI, PDF, database, `localStorage`, cookies, authentication, payments, or external integrations.
- Do not add dependencies or redesign global styles.
- The preview displays only user-entered, non-empty fields and must not infer facts.
- Desktop layout places the editor left and preview right; mobile stacks them without horizontal overflow.
- Types may support future initial values, but this stage does not wire them.

## Review Focus

- Empty and whitespace-only values should not leak into the preview; test the visible-content selector.
- Removing or editing one repeated item must preserve other items; test pure model operations.
- Optional malformed email and URLs must show field-level validation without blocking empty fields; test validators.
- All user-provided content must remain in memory and be rendered as text; inspect for network/storage usage and unsafe HTML rendering.
- Narrow viewports must not overflow; manually inspect mobile layout.

---

## File Map

- Create `features/resume/types.ts`: draft and repeatable-section item types, with optional initial value represented by the same draft type.
- Create `features/resume/model.ts`: empty draft, pure repeated-item operations, non-empty display selection, and field validators.
- Create `features/resume/components/resume-builder.tsx`: in-memory state and responsive editor/preview composition; accepts optional initial draft but route passes none.
- Create `features/resume/components/resume-editor.tsx`: editable sections and add/remove controls.
- Create `features/resume/components/resume-preview.tsx`: text-only, non-empty resume rendering.
- Create `features/resume/resume-builder.css`: editor-scoped styles and responsive layout.
- Modify `app/(product)/curriculo/page.tsx`: render the builder in the existing page shell and retain page metadata.
- Create `tests/resume-builder.test.mjs`: model and validator tests using the existing Node test runner.

### Task 1: Define and verify the resume draft model

**Files:**
- Create: `features/resume/types.ts`
- Create: `features/resume/model.ts`
- Test: `tests/resume-builder.test.mjs`

**Interfaces:**
- `ResumeDraft`: `personalInfo` (`fullName`, `cityState`, `email`, `phone`, `linkedinUrl`, `githubPortfolioUrl`), `desiredRole`, `summary`, and arrays `experiences`, `education`, `projects`, `skills`, `languages`, `certifications`.
- `ExperienceEntry`: `{ id, company, position, startDate, endDate, isCurrent, description }`; when `isCurrent` is true, `endDate` is cleared/disabled and the preview displays “Atual”.
- `EducationEntry`: `{ id, institution, course, startDate, completionDate, status }`; `ProjectEntry`: `{ id, name, description, technologies, link }`.
- `SkillEntry`: `{ id, name }`; `LanguageEntry`: `{ id, name, proficiency }`; `CertificationEntry`: `{ id, name, issuer, year, url }`, where `url` is optional and validated when supplied. All text fields are strings; blank strings are omitted from the preview.
- `createEmptyResumeDraft()` initializes text scalars to `""`, `isCurrent` to `false`, and every repeated section to `[]`.
- `createEmptyResumeDraft(): ResumeDraft`
- `removeResumeItem<T extends { id: string }>(items: T[], id: string): T[]`
- `updateResumeItem<T extends { id: string }>(items: T[], id: string, patch: Partial<T>): T[]`
- `hasResumeText(value: string | undefined): boolean`
- `isValidOptionalEmail(value: string): boolean` and `isValidOptionalUrl(value: string): boolean`; empty/whitespace values are valid. The URL validator applies to LinkedIn, GitHub/portfolio and optional certification links.
- `getVisibleResumeSections(draft: ResumeDraft)` returns the section entries containing at least one non-whitespace value, without changing source values.
- `RESUME_FIELD_LIMITS`: one exported constant object in `model.ts`: `fullName: 120`, `cityState: 120`, `email: 254`, `phone: 40`, URLs: `2048`, `desiredRole: 120`, `summary: 2000`, company/position/institution/course: `180` each, dates: `20`, experience/project descriptions: `4000`, project technologies: `1000`, skill/language/proficiency/status: `100` each, certification name/issuer: `180` each, certification year: `4`. Editor controls use these values through `maxLength`.

- [x] **Step 1: Add model tests** for a fully empty draft, whitespace-only content omitted from visible sections, preserving unrelated items during update/removal, empty versus malformed/valid optional email and URLs, and the centralized field-limit values.
- [x] **Step 2: Run the focused test and confirm it fails** using `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/resume-builder.test.mjs`.
- [x] **Step 3: Implement the draft types and pure model helpers** with no React, browser storage, or side effects.
- [x] **Step 4: Run the focused test and confirm it passes** with the same command.

### Task 2: Build the editor and live preview

**Files:**
- Create: `features/resume/components/resume-builder.tsx`
- Create: `features/resume/components/resume-editor.tsx`
- Create: `features/resume/components/resume-preview.tsx`
- Create: `features/resume/resume-builder.css`
- Modify: `app/(product)/curriculo/page.tsx`

**Interfaces:**
- `ResumeBuilder({ initialValue?: ResumeDraft })`: initializes local React state from an optional draft or `createEmptyResumeDraft()`; page does not pass `initialValue`.
- `ResumeEditor({ draft, onChange })`, where `onChange(nextDraft: ResumeDraft): void`: edits all specified fields, validates optional email/URLs inline, and adds/removes repeated entries.
- `ResumePreview({ draft })`: renders only non-empty fields and repeated entries as text.

- [x] **Step 1: Implement the editor controls** for personal/contact fields, desired role, summary, experiences, education, projects, skills, languages, and certifications, wiring every edit/add/remove action to immutable state updates. Experience uses Empresa, Cargo, Data inicial, Data final, Atualmente and Descrição; checking Atualmente clears and disables Data final. Education uses Instituição, Curso, Início, Conclusão prevista/conclusão and Status. Projects use Nome, Descrição, Tecnologias and Link do projeto/repositório. Certifications use Nome, Instituição/emissor, Ano and optional Link. Personal details use Nome, Cidade/Estado, E-mail, Telefone, LinkedIn and one GitHub/Portfólio field.
- [x] **Step 1a: Apply centralized text limits** from `RESUME_FIELD_LIMITS` to every relevant input/textarea using `maxLength`, with values high enough for normal professional histories and summaries.
- [x] **Step 2: Implement the preview** from the same `ResumeDraft`; omit blank fields and empty sections, and do not render invented placeholders or use raw HTML.
- [x] **Step 3: Compose the builder and connect `/curriculo`** while preserving the existing shell/header and metadata; route initializes empty and makes no request.
- [x] **Step 4: Add scoped styling** for the existing light blue visual system, desktop left-editor/right-preview layout, focus states, and mobile stacked layout.

### Task 3: Validate behavior and responsive presentation

**Files:**
- Modify: `tests/resume-builder.test.mjs` only if implementation reveals a missing model regression case.
- Verify: files from Tasks 1–2.

- [x] **Step 1: Run all project checks**: `npm run lint`, `npm run typecheck`, `npm run build`, then focused Node tests and existing tests with `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/*.test.mjs`.
- [x] **Step 2: Inspect the running app at `/curriculo`**: verify empty initial state; type into each section; add, edit, and remove repeated entries; verify preview updates and contains only entered content.
- [x] **Step 3: Inspect desktop and narrow mobile widths**; verify editor/preview order and no horizontal overflow.
- [x] **Step 4: Confirm implementation adds no network calls, browser persistence, external services, or dependencies**, and fix any issues within the stated scope.
