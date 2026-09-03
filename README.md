# Indivisible Fair Oaks-Carmichael: Grassroots Democracy in Action

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-blue?logo=stripe)](https://stripe.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-Styling-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

A modern platform for [Indivisible Fair Oaks-Carmichael](https://indivisiblefairoaks.org) — a non-violent grassroots movement defending democracy and advocating for community in Fair Oaks and Carmichael, CA. Built with Next.js 16, Supabase, and Stripe.

---

## 🌊 The Vision: Sensory Luxury
Indivisible Fair Oaks-Carmichael is more than a chapter; it's a movement. This digital platform is engineered to reflect the energy and commitment of grassroots democracy in action.
- **Visual Depth**: Glassmorphism, high-contrast typography, and fluid micro-animations.
- **Performance First**: Optimized LCP and cumulative layout stability for a seamless journey.
- **Tactile UI**: Interactive "Liquid Glass" galleries and responsive, high-fidelity components.

## 🛠 Features
- **Instant Storefront**: Cache Components + Partial Prefetching — the full catalog (45+ products, all CMS pages) prerenders to CDN-edge shells; dynamic data streams behind Suspense.
- **Secure Payments**: Stripe Checkout with server-side price authority, idempotent webhook processing (unique session index), and out-of-stock guards.
- **Hardened Security**: MFA support, Row-Level Security on all sensitive tables, CSP/HSTS/Permissions-Policy headers, rate-limited checkout & contact endpoints.
- **Advanced Sanitization**: WordPress content scrubbing engine eliminating legacy spam/injection.
- **Verified in CI**: unit suite + Playwright guards for instant navigation, header-clearance geometry, and sitewide link integrity.

## 🚀 Technical Stack
- **Frontend**: Next.js 16 (App Router, `cacheComponents`, Turbopack), React 19, TypeScript 5.9
- **Backend**: Supabase (PostgreSQL, Auth, Storage via `@supabase/ssr`)
- **Payments**: Stripe Checkout + webhooks (idempotent)
- **Styling**: Tailwind CSS 4 ("Sensory Luxury" tokens, native CSS vars)
- **State**: Zustand (cart/wishlist persistence), TanStack Query
- **Quality**: Biome 2 + oxlint, Vitest, Playwright (`@next/playwright` instant())
- **Runtime**: Bun ≥1.4

## 📥 Getting Started

### 1. Prerequisites
- Bun ≥1.4
- A Supabase project with the indivisiblefairoaks schema applied

### 2. Installation
```bash
bun install
```

### 3. Environment Setup
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key-here
SUPABASE_SECRET_KEY=sb_secret_your-key-here
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Development
```bash
bun run dev          # dev server (Turbopack)
bun run test         # vitest unit suite
bun run test:e2e     # Playwright instant-nav + clearance + link-integrity guards
bun run build        # production build
```

### 5. CI/CD
- All workflows execute on a self-hosted ARM64 runner (`[self-hosted, linux, ARM64]`) with a preflight disk guard and terminal workspace cleanup.
- Push to `main` → CI gates (lint, types, unit, build, e2e, Supabase migrations) → Vercel auto-deploys production.
- Dependency health runs nightly: drift audit, vulnerability scan, safe-upgrade proposals.

## 📖 Documentation
For more detailed information, please refer to:
- **[AGENTS.md](./AGENTS.md)**: Technical migration status, architectural decisions, and deferred upgrades.
- **[CLAUDE.md](./CLAUDE.md)**: Developer guide, coding patterns, and CLI shortcuts.

---

&copy; 2026 Indivisible Fair Oaks-Carmichael. All rights reserved. Built for the movement.
