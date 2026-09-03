# Catch-22: Migration Architectural Guide

## Project Objective
Transform the legacy WordPress/Elementor ecosystem (catch-22.co.nz) into a modern, high-performance headless e-commerce platform. The goal is to achieve feature parity while introducing a "Sensory Luxury" design language and a robust, secure infrastructure.

---

## 🏗 Architectural Blueprint

### 1. Headless E-commerce (Next.js 16)
- **App Router Architecture**: Leveraging Server Components for data fetching and Client Components for interactivity (Cart, Wishlist).
- **Dynamic Routing**: Implementation of `[slug]` patterns for products, categories, and dynamic content pages.
- **Sanitization Layer**: A dedicated utility in `src/app/[slug]/page.tsx` for scrubbing legacy WordPress artifacts and preventing malicious spam injections.

### 2. Backend & Security (Supabase)
- **PostgreSQL Database**: Relational schema for products, categories, content, and coupons.
- **Supabase Auth & MFA**: Secure user management with Multi-Factor Authentication support for account protection.
- **Edge Functions**: Specialized logic for data synchronization, complex server-side operations, and secure Stripe webhook handling.

### 3. "Sensory Luxury" Design System
- **Design Tokens**: Defined directly in `src/app/globals.css` using Tailwind 4 `@theme` (no legacy config file).
- **Core Componentry**: Reusable, high-fidelity components like `ProductCard`, `WishlistButton`, and `Header`.
- **Aesthetic Principles**:
  - **High-Contrast**: Primary Lime (#D1FF00) against Deep Secondary (#0F172A).
  - **Fluidity**: 500ms-700ms ease-out transitions for interactive elements.
  - **Clarity**: Heavy use of tracking (letter-spacing) and black-weight typography for a premium feel.

---

## 🛠 Working Stack (Simplified)
- **Runtime**: Bun (Package management & scripts)
- **Frontend**: Next.js 16 (App Router + React 19)
- **Backend**: Supabase (Database, Auth, Storage via REST client)
- **Payments**: Stripe (Express Checkout & Webhooks)
- **Styling**: Tailwind CSS 4 (Native CSS variables)
- **State**: Zustand (Persistent cart & wishlist)
- **Agent Skills**: Vercel agent skills installed via `skills` CLI (see `.agents/skills/`, pinned in `skills-lock.json`)

---

## 🧠 Agent Skills (Vercel)
Installed from `vercel-labs/agent-skills` via `npx skills add`. Load on demand; do not re-install.

| Skill | Use when |
| --- | --- |
| `vercel-react-best-practices` | Writing/refactoring React or Next.js code (performance patterns). |
| `vercel-composition-patterns` | Component architecture, compound components, provider APIs. |
| `web-design-guidelines` | UI/accessibility audits ("review my UI"). |
| `vercel-react-view-transitions` | Page/route animations via the View Transition API. |
| `deploy-to-vercel` | Deploying the app or creating preview deployments. |
| `vercel-cli-with-tokens` | Vercel CLI automation with access tokens (CI). |
| `vercel-optimize` | Cost/performance optimization of the deployed project. |
| `react-native-skills` | Not applicable to this web-only project (installed for reference). |
| `writing-guidelines` | Docs/prose style review. |

Update with `npx skills update`; restore with `npx skills experimental_install`.

---

## ⏸ Deferred Upgrades
- **TypeScript 7**: BLOCKED — Next.js 16.3 loads TS via the JS compiler API (`lib/typescript.js`), removed in TS 7.0; support lands ~TS 7.1 (see vercel/next.js#95633). Stay on TS 5.9 until then. tsconfig is already TS7-shaped (`moduleResolution: bundler`).
- **TypeScript 6**: bridge release only (deprecations); no value while blocked on 7.
- Revisit after the Next.js 16.3.x line announces native-TS builds.

### Vercel Free-Tier Conservation Mode
The team shares one Fluid Active CPU pool (4 hrs / rolling 30 days) across all projects. Deliberate posture — do not revert without checking the Usage dashboard:
- All catalog/content `cacheLife` profiles are **`hours`** (not `minutes`) to minimize background renders; price/stock edits propagate within the hour.
- Middleware runs **only** on `/account`, `/admin`, `/login`.
- Image transforms: 31-day cache, slim variant grids, logo served unoptimized, qualities locked to 75.
- Sitemap is fully static (`○`). Fuzzed content OG slugs fail fast with 404.
- Rate limits: checkout 10/min/IP, contact 3/10min/IP.
When the store generates revenue, move to Pro and revisit TTLs (`minutes`) for price freshness.

---

## 🗺 Migration Roadmap

### Phase 1: Core Infrastructure (Completed)
- [x] Supabase project initialization and schema design.
- [x] Next.js 16 project structure and base styling.
- [x] Primary Header and Footer navigation mirroring.

### Phase 2: Feature Parity & UI Hardening (Completed)
- [x] **Home Page**: Hero section and "Best Sellers" grid with hardened design tokens.
- [x] **Products**: Dynamic category filtering and individual product detail views.
- [x] **Cart & Checkout**: Persistent cart state and Stripe session integration.
- [x] **Logbook (Blog)**: Content migration with aggressive spam filtering.

### Phase 3: Content Population & Asset Migration (Completed)
- [x] **Static Pages**: FAQs, About Us, Partners, and Gallery (Catch-Snaps).
- [x] **Asset Hardening**: Mapping partner logos, community gallery images, and "Sledger Rigs" content.
- [x] **Legal**: Terms of Service, Privacy Policy, and Shipping/Returns.

### Phase 4: Production Hardening (Completed)
- [x] **Documentation**: Finalizing README, AGENTS, and CLAUDE guides.
- [x] **Sensory Design**: Full hardening of ProductCard and Gallery components.
- [x] **Final QA**: End-to-end checkout flow validation and cross-device testing.
- [x] **Stripe Production**: Transitioning from test keys to live environment.

### Phase 5: Stack Hardening Round (Current)
- [x] **Error Telemetry**: Supabase-native error beacon — `error_reports` table (anon insert-only RLS), rate-limited `/api/report-error`, wired into `error.tsx` / `global-error.tsx`.
- [x] **Full-Text Search**: Weighted `tsvector` generated columns + GIN indexes + ranked RPCs (`search_products`, `search_content`); `/search` uses ranked FTS with ILIKE fallback for un-migrated previews.
- [x] **A11y Regression Gate**: `@axe-core/playwright` suite (`e2e/a11y.spec.ts`) over 8 public routes; serious/critical violations fail CI.
- [x] **Contrast Remediation**: `--primary-ink` (#5c7500) token for lime-on-light text; lime-bg CTAs use dark text; slate-300/400 grays lifted on light surfaces. Raw lime reserved for dark surfaces/non-text accents.
- [x] **Bundle Hygiene**: Removed dead `mime-types`; React Query devtools dev-only gated; patch bumps.
- [x] **Cart Route Crash Fix**: `/cart` rendered the error boundary in production — `env.ts` validated `{ ...process.env }`, which bundlers cannot statically inline on the client (empty stub → ZodError at module scope via `StripeExpressCheckout`). Public vars are now picked as dotted accesses (inlined); spreads remain server-only.
- [x] **Contact Email Delivery**: `contact_submissions` had no consumer (messages invisible). New `20260825140000_contact_notification.sql` + `20260825150000_contact_sender_copy.sql` + `notify-contact` Edge Function: the server action inserts (returning id), invokes the function directly and awaits `{emailed, copied}` — the UI reports real per-email success/failure instead of blanket success. Atomic `email_sent_at` claim = exactly one notification per row ever (replay/double-submit-proof under `--no-verify-jwt`); global 20/10-min volume cap inside the function resists anon-key floods. Opt-in sender copy (`wants_copy`) locked to the row's own address. Tested at every layer: vitest action matrix (13 cases), Playwright e2e over a controllable mock function (`CONTACT_FUNCTION_URL`, `scripts/mock-notify-contact.mjs`) driving all status branches, axe a11y on `/contact`. No secrets in SQL, no Vault step.
- Migration note: `20260825120000_error_reports.sql` + `20260825130000_fts_search.sql` apply via CI db push on merge to main.
- [x] **Daily Compatibility Workflow**: `.github/workflows/daily-compat.yml` runs nightly (21:17 UTC) — frozen install, lint/format/types, unit, production build, full mock-backed e2e, live `/api/health` + edge-function boot probes for all three functions. Advisory AI review job (`scripts/ai-review.mjs`, Groq gpt-oss-120b + Z.ai glm-4.6, keys in GH secrets only) reviews the last 24h of diffs with progressive payload truncation for free-tier token caps; model output never gates CI.
- [x] **RLS Role-Repair Pattern**: project restore/re-provisioning can orphan policy→role OID references (`pg_policies` masks empty polroles as `{public}`) — policies then match nobody and default-deny silently. `20260825160000_contact_rls_role_repair.sql` fixes the incident on `contact_submissions`; recreate-and-rebind is the playbook for any table showing "policy exists but denies everyone".

---

## 🛡 Security & Sanitization
The `sanitizeWPContent` helper is critical for brand integrity. It handles:
1. **Shortcode Extraction**: Replaces legacy WPForms with native Next.js contact components.
2. **Spam Blacklist**: Aggressive filtering of keywords (Casino, Slot, Betting) and their surrounding elements.
3. **Link Hardening**: Strips unauthorized outbound links while preserving trusted domains (Supabase, Stripe).

---

## 📋 Guidelines for Future Development
1. **Maintain Aesthetic Consistency**: All new components must use defined design tokens.
2. **SEO First**: Every dynamic page MUST implement `generateMetadata` for unique titles and descriptions.
3. **Sanitize Everything**: Any data coming from the `content` table in Supabase MUST pass through the sanitization helper.
4. **Performance Budgets**: Monitor LCP and keep client-side bundles minimal.
