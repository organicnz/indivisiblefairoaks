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

- **Runner**: self-hosted ARM64 Linux with preflight disk guard and workspace cleanup.
- **On push to `main`**: lint → types → unit → build → e2e → Supabase migrations → Vercel production deploy.
- **Nightly** (`daily-compat.yml`): frozen install, full lint/types/unit/build/e2e, live health probes for `/api/health` and all three Edge Functions, advisory AI diff review (output never gates CI).
- **Pre-commit**: lefthook runs `biome check --write` + `oxlint`, typecheck, and `playwright test --list` (spec parse only — no browsers).
- **Pre-push**: lefthook runs lint, unit tests, typecheck, coverage ≥90%, production build, peer-deps, then the **Playwright e2e delivery gate** when the push range touches runtime surfaces (`src/`, `e2e/`, `public/`, `supabase/`, configs, lockfile). Docs-only pushes skip e2e. Bypass: `LEFTHOOK_EXCLUDE=e2e git push`.

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

---

&copy; 2026 Indivisible Fair Oaks-Carmichael. Built for the movement.
