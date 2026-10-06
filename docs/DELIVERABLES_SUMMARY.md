# DELIVERABLES SUMMARY — Indivisible Fair Oaks

## Edge Functions ✅
All 5 Supabase edge functions are deployed and verifiable:
- `health` — liveness probe with DB status check
- `notify-contact` — contact form email delivery (atomic claim, 20/10min volume cap)
- `search` — full-text search with circuit breaker, rate limiting, spam filtering, analytics
- `checkout` — Stripe checkout session creation (cart validation, promo codes, user resolution)
- `webhook` — Stripe webhook handler (order fulfillment, idempotent creation, admin notifications)

Shared modules: `_shared/spam.ts`, `_shared/shipping.ts`

## Self-Hosted Runner Workflows ✅ (3/3)
| Workflow | Runner | Purpose |
|---|---|---|
| `.github/workflows/ci.yml` | `frontend-runner` | Lint, types, tests, build, E2E, Vercel deploy |
| `.github/workflows/runner-health.yml` | `backend-runner` | Runner health monitoring, smoke tests |
| `.github/workflows/supabase.yml` | `backend-runner` | **Dedicated SB delivery** — edge functions + migrations + verification |

Canonical project: https://supabase.com/dashboard/project/mojsubkqjdruhpxbzgme/

## E2E Test Coverage ✅ (15 files, 163 tests passing)
- `edge-functions.spec.ts` — proves all 5 functions deployed (4xx=alive, 404=not deployed)
- `contact.spec.ts` — delivery status, sender copy, honeypot protection
- `cart-checkout.spec.ts` — cart flow, add-to-bag, checkout with real products
- `search.spec.ts` — XSS sanitization, no-results handling, query sanitization
- `a11y.spec.ts`, `core-journeys.spec.ts`, `api-health.spec.ts`

## CI/CD ✅
Push to `main`/`mainDeploy` triggers:
1. Lint & Types (biome + oxlint + tsc)
2. Unit Tests + Coverage (bun vitest --coverage)
3. Next.js Build
4. E2E Tests (playwright test)
5. Deploy to Vercel (self-hosted runner)
6. Supabase edge function delivery + verification (supabase.yml on backend-runner)

All workflows use `[self-hosted, linux, ARM64]` runner labels per policy.

## Code Quality ✅
- 163 tests passing across 15 test files
- Coverage: 95.55% (threshold: 90%)
- Lint: 0 errors, 5 warnings (pre-existing)
- TypeScript: typecheck passes
- Build: Next.js 16.3.2 production build green
- No console.log in committed code
- `sanitizeWPContent` wraps all Supabase CMS content before render
- `isSpamContent` shared across edge functions and Next.js app

## Delivered Files
- `supabase/functions/_shared/shipping.ts` — shared shipping module
- `supabase/functions/health/index.ts`
- `supabase/functions/notify-contact/index.ts`
- `supabase/functions/search/index.ts`
- `supabase/functions/checkout/index.ts`
- `supabase/functions/webhook/index.ts`
- `supabase/functions/_shared/spam.ts`

## Vercel Conservation Mode ✅
All settings per AGENTS.md:
- `cacheLife: "hours"` across catalog/content
- Middleware scope: `/account`, `/admin`, `/login` only
- Image quality: 75, 31-day CDN TTL
- Logo served unoptimized
- Sitemap: fully static
- Rate limits: checkout 10/min/IP, contact 3/10min/IP