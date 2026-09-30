# Agent Skills — Project Usage Guide

> Upstream skill definitions live in `.agents/skills/<name>/SKILL.md` (and `skills-lock.json` for pinned hashes).
> This file documents **when and how to apply each skill to this specific codebase**.
> Load only the skills relevant to the current task — do not load all of them upfront.

---

## How skills are loaded

Skills are installed via `npx skills add` from `vercel-labs/agent-skills` and `vercel-labs/vgpu`.
Hashes are pinned in `skills-lock.json`. Do not re-install or modify individual skill files.

```
npx skills update              # update all to latest
npx skills experimental_install  # restore from skills-lock.json
```

The per-skill `SKILL.md` is the trigger definition and entry point.
The per-skill `AGENTS.md` (where it exists) is the full compiled reference — read it for detailed rules and examples.

---

## Skill Index

### `vercel-react-best-practices`
**Load when:** writing, reviewing, or refactoring any React component or Next.js page.

Project-specific context:
- This project uses React 19 and Next.js 16 App Router. Rules in the `async-` and `server-` categories are the highest-value — most pages are Server Components and the primary risk is fetch waterfalls.
- `bundle-barrel-imports`: several component directories use index barrels. Flag them during refactors.
- `rerender-*` rules apply only to Client Components (`'use client'`). Do not apply them to Server Components.
- `client-swr-dedup` does not apply — this project uses TanStack Query, not SWR.

Entry: `.agents/skills/vercel-react-best-practices/SKILL.md`
Full rules: `.agents/skills/vercel-react-best-practices/AGENTS.md`

---

### `vercel-composition-patterns`
**Load when:** designing a new component API, refactoring a component with boolean-prop proliferation, or building anything with shared state across sub-components.

Project-specific context:
- The `architecture-avoid-boolean-props` rule is the most commonly violated pattern here — prefer explicit variant components.
- `react19-no-forwardref`: this project is on React 19, so `forwardRef` is deprecated. Use ref as a plain prop instead.
- Provider-based state patterns apply to the Cart and Wishlist Zustand stores.

Entry: `.agents/skills/vercel-composition-patterns/SKILL.md`
Full rules: `.agents/skills/vercel-composition-patterns/AGENTS.md`

---

### `web-design-guidelines`
**Load when:** asked to review UI, audit accessibility, or check a component against design best practices.

Project-specific context:
- The skill fetches live guidelines from `vercel-labs/web-interface-guidelines`. Internet access required.
- Pair with WCAG contrast checks: `--primary-ink` (#1e3a8a) on white passes AA; raw lime (#D1FF00) on white fails — do not use it for text.
- The a11y regression gate (`e2e/a11y.spec.ts`) uses `@axe-core/playwright` over 12 public routes. `/admin` is excluded — the auth-gated surfaces have no seeded session, so the editor and the CRM have no automated a11y coverage at all. New public routes should be added to that suite.

Entry: `.agents/skills/web-design-guidelines/SKILL.md`

---

### `vercel-react-view-transitions`
**Load when:** adding page transitions, route animations, shared element morphs, or any `<ViewTransition>` work.

Project-specific context:
- The project is on Next.js 16 App Router — do **not** install `react@canary`; React canary is already bundled internally.
- Enable via `experimental.viewTransition: true` in `next.config.ts` before implementing.
- Use `motion` (the `motion` npm package already installed) for complex imperative animations; use `<ViewTransition>` for route/state transitions.
- Directional slides (`nav-forward` / `nav-back` types) are appropriate for page-to-page navigation. Do not use them for tab switches or modal open/close.
- Always add reduced-motion CSS from the skill's `references/css-recipes.md` to `src/app/globals.css`.

Entry: `.agents/skills/vercel-react-view-transitions/SKILL.md`
Full rules: `.agents/skills/vercel-react-view-transitions/AGENTS.md`

---

### `deploy-to-vercel`
**Load when:** deploying the app or creating a preview deployment.

Project-specific context:
- The project is linked — `.vercel/project.json` exists. Skip the link step.
- Production branch is `main`. Always deploy as **preview** unless explicitly asked for production.
- Git push is the preferred method (triggers CI gates before Vercel builds).
- Do not push directly to `main` — use a branch and PR.
- Vercel free-tier conservation applies: see the Conservation Mode section in `AGENTS.md`.

Entry: `.agents/skills/deploy-to-vercel/SKILL.md`

---

### `vercel-cli-with-tokens`
**Load when:** running Vercel CLI in CI, automating deployments, or managing environment variables via CLI.

Project-specific context:
- `VERCEL_TOKEN` should be in GitHub Secrets only — never in `.env.local` or committed files.
- `VERCEL_PROJECT_ID` and `VERCEL_ORG_ID` are in `.vercel/project.json`.
- There is no `daily-compat.yml`; the file is `.github/workflows/ci.yml`, and its CLI `deploy-vercel` job was **removed on purpose** (spare previews, doubled upload consumption, the free tier's `api-upload-free` rate limit). Do not re-add it. Token-based CLI usage belongs in `secret-audit.yml`, which holds `VERCEL_TOKEN` and `SUPABASE_ACCESS_TOKEN`.

Entry: `.agents/skills/vercel-cli-with-tokens/SKILL.md`

---

### `vercel-optimize`
**Load when:** investigating Vercel bill increases, slow routes, high Function Invocations, or Core Web Vitals regressions.

Project-specific context:
- The project is on the **free tier** with a shared 4hr/30-day Fluid Active CPU pool. Cost sensitivity is high.
- All catalog/content routes use `cacheLife: "hours"` deliberately — do not flag these as optimization opportunities unless moving to Pro.
- Middleware is scoped to `/account`, `/admin`, `/login` only. Do not widen scope.
- Requires Vercel CLI v53+ and a linked directory. Run from the repo root.
- Observability Plus is not enabled on the free tier — the skill will surface this and offer a limited code-only audit path.

Entry: `.agents/skills/vercel-optimize/SKILL.md`

---

### `writing-guidelines`
**Load when:** reviewing or writing documentation, README updates, in-app copy, or email templates.

Project-specific context:
- The skill fetches live guidelines from `vercel-labs/writing-guidelines`. Internet access required.
- Apply to: `README.md`, `AGENTS.md`, `SKILLS.md`, content in `src/app/` static pages, email templates (`email_templates_v2.json`).
- Do not apply to code comments or type definitions.

Entry: `.agents/skills/writing-guidelines/SKILL.md`

---

### `vgpu`
**Load when:** working with WebGPU rendering, shaders, or the `vgpu` package (installed as a production dependency).

Project-specific context:
- `vgpu` v0.4.0 is installed. The skill was generated against v0.3.1 — minor version gap, API is stable.
- Installed in `.agents/skills/vgpu/`, same root as all other skills.
- Use `npx -y vgpu docs cat <symbol>` to load specific API docs on demand. Do not read the full skill upfront.
- Entry point for this project: `vgpu/client` for browser-side canvas rendering.

Entry: `.agents/skills/vgpu/SKILL.md`

---

### `vercel-react-native-skills`
**Not applicable.** This is a web-only project. The skill is installed for reference but should never be loaded.

---

### `cms-editor-and-crm`
**Load when:** touching `src/components/admin/content/`, `src/components/admin/crm/`, `src/lib/blocks/`, `src/lib/actions/content.ts`, `src/lib/actions/crm.ts`, `src/lib/sanitize.ts`, `src/lib/trusted-links.ts`, `src/lib/own-media.ts`, the broadcast Edge Function, or a coverage threshold in `vitest.config.ts`.

**Project-specific, not vendored.** Unlike the skills above, this one is written
for this codebase and is not pinned in `skills-lock.json` — so it *can* be edited,
and it should be when an invariant changes.

It exists because the failure modes here are invisible to review and to unit
tests:

- A new block type that serializes to markup `sanitizeWPContent` strips looks
  perfect in the editor and vanishes on publish.
- Autosave that hardcodes a publish state quietly takes a live page offline.
- `storage.remove()` without a reference check is a data-loss event.
- A `CHECK` constraint that disagrees with the code is invisible to any test that
  mocks the Supabase client. `crm_broadcasts.status` omitted `'queued'`, so
  **no broadcast had ever been sent**, and unit tests were green throughout.
- A test run that emails the chapter admins from a system they are not operating.
- A **narrowing guard written as a conjunction over two nullable columns** looks
  unconditional and is not: `test_only === true && typeof test_recipient === 'string'`
  evaluated false for a `test_only` row whose address was never written, and the
  sender then mailed every opted-in contact.
- A **limit enforced by counting** cannot tell "this is all of them" from "this is
  all I was allowed to look at". The recipient ceiling compared against a pager
  that could return at most exactly the ceiling, so the refusal was dead code and
  a 12,000-person audience went out as 5,000.
- A **duplicated allowlist** drifts silently. The trusted-domain rule was three
  copies; the editor's was eleven domains narrower than the sanitizer's, and it
  told authors their links would be removed when they would not have been.
- A **file outside the coverage `include` list** cannot fail a gate. `crm.ts` was
  in no threshold at all, which is how both of the two above shipped.

Entry: `.agents/skills/cms-editor-and-crm/SKILL.md`
Full context: [`docs/content-editor.md`](./docs/content-editor.md), [`docs/crm-operations.md`](./docs/crm-operations.md)

---

## Quick trigger reference

| Task | Load |
|---|---|
| Write/refactor a React component | `vercel-react-best-practices`, `vercel-composition-patterns` |
| **Content editor, CRM, or anything that can send email** | **`cms-editor-and-crm`** |
| Add page/route animation | `vercel-react-view-transitions` |
| UI or a11y audit | `web-design-guidelines` |
| Deploy or preview | `deploy-to-vercel` |
| CI / token-based CLI | `vercel-cli-with-tokens` |
| Vercel cost/perf investigation | `vercel-optimize` |
| Docs or copy review | `writing-guidelines` |
| WebGPU / shader work | `vgpu` |
