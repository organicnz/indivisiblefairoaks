# Indivisible Fair Oaks-Carmichael

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-blue?logo=stripe)](https://stripe.com/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

Platform for [Indivisible Fair Oaks-Carmichael](https://indivisiblefairoaks.org) — a grassroots democracy organization in Fair Oaks & Carmichael, CA. Migrated from WordPress/Elementor to a headless Next.js 16 stack.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Bun ≥1.4 |
| Frontend | Next.js 16.3 · App Router · React 19 · TypeScript 5.9 |
| Backend | Supabase (PostgreSQL · Auth · Storage · Edge Functions) |
| Payments | Stripe Checkout + Webhooks |
| Styling | Tailwind CSS 4 (native `@theme`, no config file) |
| State | Zustand (cart/wishlist) · TanStack Query |
| Quality | Biome 2 · oxlint · Vitest · Playwright + `@axe-core/playwright` |
| Deploy | Vercel (auto-deploy on push to `main`) |

---

## Getting Started

### Prerequisites
- Bun ≥1.4
- A Supabase project with migrations applied (see `supabase/migrations/`)

### Install
```bash
bun install
```

### Environment
Copy `.env.local` and fill in your values:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Commands
```bash
bun run dev          # dev server (Turbopack)
bun run build        # production build
bun run lint         # Biome + oxlint (auto-fix)
bun run lint:check   # lint without writing
bun run format       # Biome format (auto-fix)
bun run check:ci     # full Biome CI check (no writes)
bun run test         # Vitest unit suite (single run)
bun run test:watch   # Vitest in watch mode
bun run test:e2e     # Playwright suite
bun run test:coverage
bun run types:generate  # regenerate Supabase types
```

---

## CI/CD

- **Runner**: self-hosted **X64** Linux, requested as `[self-hosted, linux, X64, frontend-runner|backend-runner]`. **No job in this repository can currently run** — see [`docs/ci-runners.md`](./docs/ci-runners.md). Self-hosted runners are provisioned by the `ghrunner` fleet manager (Podman + Quadlet, one x86_64 VPS behind Tailscale), and this repository is listed in its `UNSERVED` file, so the selectors match nothing and every job queues forever. That is a decision recorded elsewhere, not a fault in these files: `X64` is correct and should not be changed.
- **On push to `main`**: `ci.yml` runs lint → types → unit + coverage → build → Playwright e2e → live `/api/health` probe. `supabase.yml` runs in parallel on any `supabase/**` change and pushes migrations. There is **no Vercel deploy job** — it was removed on purpose (spare previews, doubled upload consumption, the free tier's `api-upload-free` rate limit). Production ships from the push plus the health probe. Do not re-add it.
- **Scheduled**: `runner-health.yml` every 30 min, `walle-refresh.yml` at 04:17 UTC, `secret-audit.yml` at 04:37 UTC. All three are equally unserved today, for the same reason. Deliberately staggered off `:00`, when every scheduled workflow competes for the shared runner fleet. There is no nightly compatibility workflow; `scripts/ai-review.mjs` is unreferenced.
- **Pre-commit**: ~24 lefthook guards — secrets, migration/RLS/`SECURITY DEFINER` checks, Biome, oxlint, typecheck, four env-contract checkers, lockfile pairing, and `playwright test --list` (spec parse only, no browsers). A committed migration regenerates `src/types/supabase.ts`.
- **Pre-push**: lint → unit → typecheck → coverage → production build → peer-deps, then the **Playwright e2e delivery gate** when the push range touches runtime surfaces (`src/`, `e2e/`, `public/`, `supabase/`, configs, lockfile). Docs-only pushes skip e2e. Bypass: `LEFTHOOK_EXCLUDE=e2e git push`.

---

## Key Directories

```
src/
  app/            # Next.js App Router pages and API routes
  components/     # Shared UI components
  lib/            # Supabase client, Zustand stores, utilities
supabase/
  migrations/     # Ordered SQL migration files
  functions/      # Edge Functions (notify-contact, etc.)
e2e/              # Playwright specs (a11y, nav, link-integrity)
scripts/          # Node/mjs utilities (gen-types, ai-review, etc.)
```

---

## Documentation

- **[AGENTS.md](./AGENTS.md)** — architecture guide, coding rules, deferred upgrades, and agent skill index. Primary reference for AI agents and new contributors.
- **[SKILLS.md](./SKILLS.md)** — project-specific usage guide for each installed agent skill.
- **[docs/secrets-and-config.md](./docs/secrets-and-config.md)** — all four configuration stores (Vercel, Supabase edge secrets, GitHub Actions, Vault) and which value belongs in each.
- **[docs/ci-secrets.md](./docs/ci-secrets.md)** — GitHub Actions inventory, and why `NEXT_PUBLIC_*` is a variable not a secret.
- **[docs/ci-runners.md](./docs/ci-runners.md)** — why every workflow here queues forever (`ghrunner`'s `UNSERVED` list), how to check, and what serving this repository would take.
- **[docs/content-editor.md](./docs/content-editor.md)** — the block editor: model, autosave, undo, revisions, preview, and the invariants behind them.
- **[docs/crm-operations.md](./docs/crm-operations.md)** — the broadcast state machine, what keeps test traffic out of real inboxes, and recovery from a stuck send.
- **[docs/apex-cutover-runbook.md](./docs/apex-cutover-runbook.md)** — moving from `test.` to the apex, with verification and rollback.

---

&copy; 2026 Indivisible Fair Oaks-Carmichael. Built for the movement.
