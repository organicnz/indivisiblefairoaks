# Agent Skills — Project Usage Guide

> Upstream skill definitions live in `agent/skills/<name>/SKILL.md` (and `skills-lock.json` for pinned hashes).
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

Entry: `agent/skills/vercel-react-best-practices/SKILL.md`
Full rules: `agent/skills/vercel-react-best-practices/AGENTS.md`

---

### `vercel-composition-patterns`
**Load when:** designing a new component API, refactoring a component with boolean-prop proliferation, or building anything with shared state across sub-components.

Project-specific context:
- The `architecture-avoid-boolean-props` rule is the most commonly violated pattern here — prefer explicit variant components.
- `react19-no-forwardref`: this project is on React 19, so `forwardRef` is deprecated. Use ref as a plain prop instead.
- Provider-based state patterns apply to the Cart and Wishlist Zustand stores.

Entry: `agent/skills/vercel-composition-patterns/SKILL.md`
Full rules: `agent/skills/vercel-composition-patterns/AGENTS.md`

---

### `web-design-guidelines`
**Load when:** asked to review UI, audit accessibility, or check a component against design best practices.

Project-specific context:
- The skill fetches live guidelines from `vercel-labs/web-interface-guidelines`. Internet access required.
- Pair with WCAG contrast checks: `--primary-ink` (#1e3a8a) on white passes AA; raw lime (#D1FF00) on white fails — do not use it for text.
- The a11y regression gate (`e2e/a11y.spec.ts`) uses `@axe-core/playwright` over 8 public routes. New routes should be added to that suite.

Entry: `agent/skills/web-design-guidelines/SKILL.md`

---

### `vercel-react-view-transitions`
**Load when:** adding page transitions, route animations, shared element morphs, or any `<ViewTransition>` work.

Project-specific context:
- The project is on Next.js 16 App Router — do **not** install `react@canary`; React canary is already bundled internally.
- Enable via `experimental.viewTransition: true` in `next.config.ts` before implementing.
- Use `motion` (the `motion` npm package already installed) for complex imperative animations; use `<ViewTransition>` for route/state transitions.
- Directional slides (`nav-forward` / `nav-back` types) are appropriate for page-to-page navigation. Do not use them for tab switches or modal open/close.
- Always add reduced-motion CSS from the skill's `references/css-recipes.md` to `src/app/globals.css`.

Entry: `agent/skills/vercel-react-view-transitions/SKILL.md`
Full rules: `agent/skills/vercel-react-view-transitions/AGENTS.md`

---

### `deploy-to-vercel`
**Load when:** deploying the app or creating a preview deployment.

Project-specific context:
- The project is linked — `.vercel/project.json` exists. Skip the link step.
- Production branch is `main`. Always deploy as **preview** unless explicitly asked for production.
- Git push is the preferred method (triggers CI gates before Vercel builds).
- Do not push directly to `main` — use a branch and PR.
- Vercel free-tier conservation applies: see the Conservation Mode section in `AGENTS.md`.

Entry: `agent/skills/deploy-to-vercel/SKILL.md`

---

### `vercel-cli-with-tokens`
**Load when:** running Vercel CLI in CI, automating deployments, or managing environment variables via CLI.

Project-specific context:
- `VERCEL_TOKEN` should be in GitHub Secrets only — never in `.env.local` or committed files.
- `VERCEL_PROJECT_ID` and `VERCEL_ORG_ID` are in `.vercel/project.json`.
- The CI workflow (`daily-compat.yml`) already handles token-based CLI usage — check it before adding new automation.

Entry: `agent/skills/vercel-cli-with-tokens/SKILL.md`

---

### `vercel-optimize`
**Load when:** investigating Vercel bill increases, slow routes, high Function Invocations, or Core Web Vitals regressions.

Project-specific context:
- The project is on the **free tier** with a shared 4hr/30-day Fluid Active CPU pool. Cost sensitivity is high.
- All catalog/content routes use `cacheLife: "hours"` deliberately — do not flag these as optimization opportunities unless moving to Pro.
- Middleware is scoped to `/account`, `/admin`, `/login` only. Do not widen scope.
- Requires Vercel CLI v53+ and a linked directory. Run from the repo root.
- Observability Plus is not enabled on the free tier — the skill will surface this and offer a limited code-only audit path.

Entry: `agent/skills/vercel-optimize/SKILL.md`

---

### `writing-guidelines`
**Load when:** reviewing or writing documentation, README updates, in-app copy, or email templates.

Project-specific context:
- The skill fetches live guidelines from `vercel-labs/writing-guidelines`. Internet access required.
- Apply to: `README.md`, `AGENTS.md`, `SKILLS.md`, content in `src/app/` static pages, email templates (`email_templates_v2.json`).
- Do not apply to code comments or type definitions.

Entry: `agent/skills/writing-guidelines/SKILL.md`

---

### `vgpu`
**Load when:** working with WebGPU rendering, shaders, or the `vgpu` package (installed as a production dependency).

Project-specific context:
- `vgpu` v0.4.0 is installed. The skill was generated against v0.3.1 — minor version gap, API is stable.
- Installed in `.agents/skills/vgpu/` (separate from the Vercel skills in `agent/skills/`).
- Use `npx -y vgpu docs cat <symbol>` to load specific API docs on demand. Do not read the full skill upfront.
- Entry point for this project: `vgpu/client` for browser-side canvas rendering.

Entry: `.agents/skills/vgpu/SKILL.md`

---

### `vercel-react-native-skills`
**Not applicable.** This is a web-only project. The skill is installed for reference but should never be loaded.

---

## Quick trigger reference

| Task | Load |
|---|---|
| Write/refactor a React component | `vercel-react-best-practices`, `vercel-composition-patterns` |
| Add page/route animation | `vercel-react-view-transitions` |
| UI or a11y audit | `web-design-guidelines` |
| Deploy or preview | `deploy-to-vercel` |
| CI / token-based CLI | `vercel-cli-with-tokens` |
| Vercel cost/perf investigation | `vercel-optimize` |
| Docs or copy review | `writing-guidelines` |
| WebGPU / shader work | `vgpu` |
