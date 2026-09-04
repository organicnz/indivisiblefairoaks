# Indivisible Fair Oaks-Carmichael — Agent & Contributor Guide

> **Scope**: Architectural decisions, coding rules, active constraints, and agent skill index.
> Treat everything in this file as authoritative. See README.md for setup and CLI commands.

---

## Architecture

### App Router structure
- **Server Components** handle all data fetching via `createClient` from `@supabase/ssr`.
- **Client Components** are scoped to interactive leaves: Cart, Wishlist, command palette, Stripe checkout.
- Dynamic pages use `[slug]` routing; `generateMetadata` is mandatory on every dynamic route.
- `cacheLife` profiles are set to `"hours"` across all catalog and content fetches — do not change to `"minutes"` until the project moves to Vercel Pro (see Conservation Mode below).

### Supabase backend
- PostgreSQL with RLS on every user-facing table. Anon key = read-only + insert on allowlisted tables only.
- Auth includes MFA support. Middleware enforces session checks on `/account`, `/admin`, `/login` **only** — do not expand middleware scope without checking Fluid CPU budget.
- Edge Functions: `notify-contact`, `stripe-webhook`, `health`. Invoked directly from Server Actions; never call Edge Functions from Client Components.
- **RLS role-repair pattern**: after project restore/re-provisioning, policy→role OID references can orphan (`pg_policies` shows `{public}` but matches nobody). Playbook: `DROP POLICY … ; CREATE POLICY … TO authenticated …`. Reference: `20260825160000_contact_rls_role_repair.sql`.

### Sanitization layer
`sanitizeWPContent` in `src/lib/` must wrap **all** HTML from the `content` table before render. It:
1. Removes legacy WPForms shortcodes (replaces with native contact component).
2. Strips spam keywords (Casino, Slot, Betting, etc.) and their parent elements.
3. Drops outbound links not matching trusted domains (supabase.co, stripe.com, indivisiblefairoaks.org).

Never render raw Supabase HTML without this helper — treat it as a security boundary.

---

## Design System — "Sensory Luxury"

Tokens are defined in `src/app/globals.css` via `@theme`. No `tailwind.config.*` file exists.

### Active color tokens
| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#1e3a8a` | Primary blue — buttons, links, active states |
| `--primary-light` | `#2563eb` | Hover/focus variants |
| `--primary-dark` | `#172554` | Pressed/deep variants |
| `--primary-ink` | `#1e3a8a` | Text on light surfaces (replaces raw lime) |
| `--secondary` | `#0f172a` | Page backgrounds, dark surfaces |
| `--accent` | `#d97706` | Amber — donate CTA, warnings |
| `--accent-gold` | `#f59e0b` | Active nav indicators |
| `--accent-red` | `#dc2626` | Destructive actions, errors |
| `--surface-muted` | `#f8fafc` | Card backgrounds on light pages |

Use `text-primary-ink` for any text placed on light/white surfaces. Raw lime (`#D1FF00`) is reserved for dark-surface non-text accents only — do not use it for body or heading text.

### Typography
- **Headings**: Outfit font, `font-black uppercase tracking-tighter`
- **Navigation**: `font-bold uppercase tracking-[0.2em]`
- **Body**: Inter font, `font-medium text-slate-600 leading-relaxed`

### Motion
- Use `motion` (the `motion` npm package, not `framer-motion`) for complex transitions.
- Tailwind utilities for micro-animations (hover scale, opacity, color transitions).
- All transitions must be `ease-out`, duration `300ms`–`500ms`. Avoid durations over 500ms for interactive feedback.

---

## Coding Rules

1. **Tokens always** — no hardcoded hex, no arbitrary Tailwind values for brand colors.
2. **generateMetadata everywhere** — every `page.tsx` must export it; title and description must be unique.
3. **Sanitize all CMS content** — `sanitizeWPContent` before any `dangerouslySetInnerHTML`.
4. **No console.log in committed code** — enforced by oxlint.
5. **No layout shift** — always provide width/height on `next/image`; use `aspect-ratio` utilities for unknown-dimension embeds.
6. **Server-only env reads** — `process.env.SUPABASE_SECRET_KEY` etc. are accessed as dotted properties, never spread into objects, never imported into client modules. Public `NEXT_PUBLIC_*` vars are safe to access anywhere.
7. **Exact dependency versions** — use `^` only; pin via `overrides` for any package with a known CVE.
8. **MFA guards** — account-mutating operations must check MFA enrollment status server-side.

---

## Vercel Free-Tier Conservation Mode

The team shares one Fluid Active CPU pool (4 hrs / rolling 30 days). **Do not revert these settings without checking the Usage dashboard first.**

| Setting | Value | Reason |
|---|---|---|
| `cacheLife` for catalog/content | `"hours"` | Minimizes background revalidation renders |
| Middleware scope | `/account`, `/admin`, `/login` only | Middleware runs on every matched request |
| Image quality | `75` | Reduces transform CPU |
| Image cache | 31-day CDN TTL | Avoids repeat transforms |
| Logo | Served unoptimized | Tiny file; transform cost not worth it |
| Sitemap | Fully static | No dynamic compute |
| Checkout rate limit | 10/min/IP | Stripe fraud + CPU protection |
| Contact rate limit | 3/10min/IP | Anon-key flood protection |

When the project moves to Vercel Pro, revisit `cacheLife: "minutes"` for price and stock freshness.

---

## Deferred Upgrades

### TypeScript 7 — BLOCKED
Next.js 16.3 loads TypeScript via the JS compiler API (`lib/typescript.js`), which was removed in TS 7.0. Native-TS builds land ~TS 7.1. Tracking: [vercel/next.js#95633](https://github.com/vercel/next.js/issues/95633).

**Stay on TypeScript 5.9.** The `tsconfig.json` is already shaped for TS 7 (`moduleResolution: bundler`) so the upgrade will be a version bump only.

TypeScript 6 is a bridge release (deprecations only) — skip it.

---

## Agent Skills

Skills are installed in `agent/skills/` (Vercel) and `.agents/skills/` (vgpu), pinned in `skills-lock.json`.
Load on demand — do not load all skills upfront, do not re-install manually.

Full usage guide with project-specific context for each skill: **[SKILLS.md](./SKILLS.md)**

Quick trigger table:

| Skill | Load when |
|---|---|
| `vercel-react-best-practices` | Writing or refactoring any React / Next.js code |
| `vercel-composition-patterns` | Component API design, compound components, boolean-prop refactors |
| `web-design-guidelines` | UI or a11y audits |
| `vercel-react-view-transitions` | Page/route animations, shared element morphs |
| `deploy-to-vercel` | Deploying or creating preview deployments |
| `vercel-cli-with-tokens` | Vercel CLI in CI / token-based automation |
| `vercel-optimize` | Vercel cost or performance investigation |
| `writing-guidelines` | Docs or copy review |
| `vgpu` | WebGPU / shader work (`vgpu` package) |
| `vercel-react-native-skills` | Not applicable — web-only project |

Update: `npx skills update` · Restore: `npx skills experimental_install`

---

## Migration Roadmap

All phases are complete. This section is kept for historical context.

<details>
<summary>Phase history</summary>

**Phase 1 — Core Infrastructure** ✅
Supabase schema, Next.js 16 project scaffold, Header/Footer.

**Phase 2 — Feature Parity** ✅
Home page hero, product catalog + detail pages, cart + Stripe checkout, Logbook (blog) with spam filtering.

**Phase 3 — Content & Assets** ✅
Static pages (FAQs, About, Partners, Gallery), partner logos, community gallery, Sledger Rigs, legal pages.

**Phase 4 — Production Hardening** ✅
README/AGENTS/CLAUDE docs, ProductCard + Gallery design hardening, end-to-end QA, Stripe live keys.

**Phase 5 — Stack Hardening** ✅
- Error telemetry: `error_reports` table (anon insert-only RLS) + rate-limited `/api/report-error` wired into `error.tsx` / `global-error.tsx`.
- Full-text search: weighted `tsvector` generated columns + GIN indexes + ranked RPCs (`search_products`, `search_content`); `/search` uses FTS with ILIKE fallback.
- A11y regression gate: `@axe-core/playwright` over 8 public routes; serious/critical violations fail CI.
- Contrast remediation: `--primary-ink` token for lime-on-light text; lime-bg CTAs use dark text; raw lime reserved for dark non-text accents.
- Bundle hygiene: removed dead `mime-types`; React Query devtools dev-only gated.
- Cart crash fix: `env.ts` was spreading `process.env` (empty client stub → ZodError). Public vars now use dotted property access (inlined by bundler); spreads are server-only.
- Contact email delivery: `notify-contact` Edge Function invoked directly from the server action; atomic `email_sent_at` claim prevents duplicate sends; global 20/10-min volume cap resists anon floods; opt-in sender copy locked to the submitter's own address.
- Daily compatibility workflow: nightly CI with frozen install, lint/types/unit/build/e2e, live health probes, advisory AI diff review (never gates CI).
- RLS role-repair: `20260825160000_contact_rls_role_repair.sql` — recreate-and-rebind playbook for orphaned policy→role OID references.

</details>
