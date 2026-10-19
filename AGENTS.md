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
- **The `/products` sidebar categories query is cached, and that is the end of it.** An uncached inline fetch here used to log a prerender warning on every build; `0e65c6a` lifted it out of the page into `getCategories()` with `'use cache'`, `cacheLife('hours')` and `cacheTag('categories')`, and a clean build is now silent. A follow-up once asked for it to move inside a Suspense boundary, and that half is moot: `/products` sets `export const instant = false` — a deliberate Block opt-out, because per-category SEO titles require awaiting `searchParams` in `generateMetadata` — so there is no prerender pass to warn about, and the segment's boundary is `src/app/products/loading.tsx`, which already covers the whole page. Adding a second boundary would trade a warning that no longer exists for a flash of an empty sidebar. Re-verified 2026-09-30 with `rm -rf .next && NEXT_E2E_BUILD=true NEXT_SKIP_ENV_VALIDATION=1 bun run build`: `/products` prerenders as `◐`, build silent.

### Site identity — one source of truth
**`src/config/site.ts` owns "where does this site live".** `metadataBase`, every
canonical URL, every `og:url`, `sitemap.xml`, `robots.txt`, and all JSON-LD
`@id`/`url` values derive from `env.NEXT_PUBLIC_SITE_URL`. Nothing may hardcode
`indivisiblefairoaks.org` for those purposes.

- Build page metadata through `pageMetadata()` in `src/lib/metadata.ts`. It
  guarantees a canonical, an `og:url`, a Twitter card and a robots directive.
  Returning a hand-written `Metadata` literal is how the `og:url` bug happened.
- **Next replaces, never merges, `openGraph`.** A child that declares its own
  `openGraph` discards the parent's — including `images` from the
  `opengraph-image` file convention. This is why `pageMetadata` sets an explicit
  default card.
- `IS_PRODUCTION_SITE` is true only when the configured origin is the apex.
  Otherwise the whole build emits `noindex, nofollow` and `robots.txt` returns
  `Disallow: /`, so previews and staging can never compete with the apex.
- **The apex cutover is therefore a single env change**, not a code sweep. See
  `docs/apex-cutover-runbook.md`.
- `app/page.tsx` shares its segment with the root layout, and Next does not
  apply a segment's own `title.template` to itself — the homepage must pass an
  absolute title.

### Navigation and legacy URLs
- `src/config/routes.ts` is the single source of truth for primary navigation.
  `Header.tsx` renders the desktop row and the drawer from it, and
  `isActiveRoute()` supplies `aria-current`. Add a link there, not inline.
- **The horizontal nav row is `2xl` and above only.** The nine labels at
  `tracking-[0.2em]` render a ~1047px row, which needs ~1700px of viewport with
  the logo and action cluster. That fits no standard breakpoint at full label
  length, which is why `NavLink.short` exists: the desktop row uses the short
  label, the drawer uses the full one. Do not drop `short` — without it the row
  silently reverts to ~1700px and overflows.
- `e2e/header-fit.spec.ts` asserts the header fits at eight widths from 320px to
  1920px and that the account entry is reachable at every one. It exists because
  this has already broken twice, and the symptom (a Playwright click timeout) did
  not identify the cause.
- `src/config/legacy-redirects.ts` maps the old Google Sites paths to their real
  equivalents as permanent redirects. It is imported by **both** `next.config.ts`
  (which cannot resolve the `@/` alias, hence the standalone module) and
  `getAllPublishedSlugs()`, so a shadowed CMS slug is never prerendered. The two
  cannot drift.

### Supabase backend
- PostgreSQL with RLS on every user-facing table. Anon key = read-only + insert on allowlisted tables only.
- Auth includes MFA support. Middleware enforces session checks on `/account`, `/admin`, `/login` **only** — do not expand middleware scope without checking Fluid CPU budget.
- Edge Functions: `notify-contact`, `checkout`, `search`, `webhook`, `health`,
  `wall-e-chat`, `walle-refresh`, `crm-broadcast-send`, `data-points`. All are deployed by
  `.github/workflows/supabase.yml`; `crm-broadcast-send` joined that list only
  recently, and until it did, `CRM_BROADCAST_FUNCTION_URL` pointed production at
  a route no pipeline shipped. Invoked directly from Server Actions; never call
  Edge Functions from Client Components.
  **JWT verification is on unless a step says `--no-verify-jwt`.** Five functions
  are deliberately public (`notify-contact`, `search`, `webhook`, `health`, `data-points`);
  `checkout`, `wall-e-chat`, `walle-refresh` and `crm-broadcast-send` require a
  key. A step that silently loses the flag turns a credentialed endpoint into a
  public one; one that silently gains it makes an internal endpoint unreachable.
  The `verify` job probes each function and asserts the specific expected code —
  400, 400|401, 405, 401 for `crm-broadcast-send`, or 200 for `health` and `data-points` — so neither direction passes
  silently. **A config var and a deploy step have to land together.**
- `supabase/config.toml` governs the **local** CLI stack only. The hosted
  project's `site_url` / `additional_redirect_urls` live in the dashboard —
  Authentication → URL Configuration. Magic links and OAuth callbacks fail
  closed against that list, so an apex cutover that misses it strands every user.
- **The hosted Site URL and redirect allow-list drifted to an unrelated domain,
  and nothing in the repository could see it.** Both read
  `https://ai.foodshare.club` while the app served
  `https://test.indivisiblefairoaks.org`, so every magic link went to a host with
  broken TLS *and* this project's own callback was rejected, because the
  allow-list named only the wrong host. Login was broken end to end with no
  failing test, build or review — the state lives in a dashboard. Fixed by
  `PATCH /v1/projects/<ref>/config/auth`, and `scripts/check-auth-redirects.mjs`
  now reconciles both settings nightly from `secret-audit.yml`, with an offline
  pre-commit half proving no absolute `/auth/callback` URL returns to source.
  The login page builds its callback from `window.location.origin`, so the app
  is correct on every host by construction and the hosted settings are the only
  place the origin can go wrong.
- **The redirect allow-list is comma-separated, and getting that wrong fails
  silently.** `GOTRUE_URI_ALLOW_LIST` is documented as "a comma separated list of
  URIs" and GoTrue's config field is a `[]string` populated by go-envconfig,
  which splits slices on commas. Newlines are **not** a separator: the Management
  API strips them from a multi-line value before storing, collapsing three URLs
  into one entry that matches nothing. `uri_allow_list` must also be a string —
  an array is a `400`. So the correct write is one comma-separated string, and
  this project carries all three hosts that way:
  `site_url` is the origin the deployment serves, and the allow-list is the
  staging, apex and `www` callbacks. `scripts/check-auth-redirects.mjs` parses on
  commas for the same reason and reports a concatenated value as drift,
  because the corrupted result *looks* configured while rejecting every
  callback — strictly worse than an obviously empty list.
- **`otp_disabled` is not evidence that auth email is off.** Auth email *is*
  configured (`smtp.resend.com:465`, user `resend`, sender and admin address
  set) and the mailer path authenticates — a live `AUTH LOGIN` against the relay
  returns 235. GoTrue answers `otp_disabled` for an address that has no account,
  because confirming it either way would enumerate users, so a probe using a
  synthetic address "proves" nothing either way. An earlier revision of this file
  asserted the opposite on exactly that evidence; it takes a real account to
  test, and a guess here becomes a false statement in an authoritative document.
  `/authorize` is the probe that does carry meaning: every provider reports
  unsupported or disabled, so `signInWithOAuth` cannot complete until one is
  configured. `signInWithOtp` and `resetPasswordForEmail` have a working mailer
  behind them and are limited by whether the address has an account.
- **RLS role-repair pattern**: after project restore/re-provisioning, policy→role OID references can orphan (`pg_policies` shows `{public}` but matches nobody). Playbook: `DROP POLICY … ; CREATE POLICY … TO authenticated …`. There is no dedicated migration for this — the pattern responds to a re-provisioning event rather than a schema change, so it lives in `scripts/rls-role-repair.mjs` and not in `migrations/`.

### Commerce
- `src/config/commerce.ts` owns currency, shipping rates and price formatting.
  Stripe sessions, the Product JSON-LD and the storefront all read from it.
  The site previously charged `nzd` with Auckland pickup addresses while its
  structured data advertised `USD`; do not reintroduce a per-site currency
  literal. Shipping rates are placeholders pending the chapter's confirmation.
- **The checkout wire payload is built in exactly one place.**
  `buildCheckoutItems()` in `src/lib/checkout-validation.ts` serves both
  `cart/page.tsx` and `StripeExpressCheckout`, which previously inlined the same
  six-line mapping. Two hand-copied shapes is how this storefront shipped `nzd`
  checkout beside `USD` structured data; a parity test cannot catch a field one
  site forgot to send, but a shared function can. Its `variationId ?? undefined`
  is load-bearing — the cart store carries `number | null` while the validator
  accepts only a positive integer or `undefined`, so a null reaching the server
  is a 400 on a perfectly ordinary cart.
- **There is deliberately no idempotency key on `checkout.sessions.create`.**
  The obvious candidate — a hash of the cart — is wrong: Stripe returns the
  cached response for a key for 24 hours, so buying the same cart twice in a day
  hands back the *first*, already-completed session and charges nothing for the
  second. The orphan session a key would prevent is cosmetic, and the
  parallel-submit case is already closed by `disabled={isLoading}` on the cart
  button. The full reasoning sits at the call site in
  `src/app/api/checkout/route.ts`. **Do not "fix" this without reading it.**
- **Orders are provider-agnostic and the store is not yet connected.** There are
  no live orders, so the admin and account surfaces are empty-state shells that
  render the stored row currency with `CURRENCY_CODE` as fallback and format
  with `formatPrice` — never a per-site literal (`commerce-no-nzd.test.ts` fails
  the build on any `nzd` residue outside the historical record). A future
  WooCommerce store writes through `mapWooOrderToRow()` in
  `src/lib/commerce/orders.ts` into the same `orders` table with
  `source = 'woocommerce'` (migration `20261009000000`, CHECK
  `orders_source_check`); a new provider adds a mapper plus a CHECK value in the
  same change, never a second orders table. Reads do not select
  `source`/`external_id` until that migration has been pushed — PostgREST refuses
  a select naming an unknown column, so the hand-written order types carry both
  as optional until then.

### Sanitization layer
`sanitizeWPContent` in `src/lib/` must wrap **all** HTML from the `content` table before render. It:
1. Strips Google Sites page furniture — see below.
2. Removes legacy WPForms shortcodes (replaces with native contact component).
3. Strips spam keywords (Casino, Slot, Betting, etc.) and their parent elements.
4. Drops outbound links not matching trusted domains (supabase.co, stripe.com, indivisiblefairoaks.org).

Never render raw Supabase HTML without this helper — treat it as a security boundary.

**Spam keywords match on word boundaries, not substrings.** All three call sites
— `isSpamContent`, the element-removal pass, and the contact form — go through
`containsSpamKeyword()`, which builds `\b<keyword>(?:s|es|ed|ing)?\b`. This is
load-bearing in both directions. The inflection allowance is why `isSpamContent(
'hot slots action')` is still spam. The boundaries are why a paragraph about a
**judicial** review or **pragmatically** better canvassing survives: matching
`'judi'` as a substring deleted the entire `<p>`, `<div>` or `<a>` that mentioned
it, and the contact form told the resident they were a spammer. The list is
still aggressive on purpose — a bare `slot`, `bonus` or `bingo` *is* still a hit,
which is documented in `sanitize-keywords.test.ts` rather than left as a
surprise. Adding a fourth matcher here re-opens the same bug; export and use
`containsSpamKeyword` instead.

**The block editor must produce markup the sanitizer preserves.** A property
test asserts `sanitize(serialize(blocks)) === serialize(blocks)` for arbitrary
blocks. It is the only thing standing between a newly added block type and
silently vanishing on publish — it is how a `button` block was caught being
deleted. The one documented exemption is content that is genuinely spam, since
deleting that is the filter working. A failure here is a sanitizer bug or a
missing block type, not a flaky test.

**The sanitizer's allowlist is therefore load-bearing, and the test that says so
must keep saying it.** An image's measured `width` / `height` reach the reader
only because `img: ['src', 'alt', 'width', 'height', 'loading']` permits them.
The properties were present in the model and the serializer from the start and
populated by nothing; the moment the uploader began filling them in, the
allowlist became a correctness dependency rather than a tidy list. Narrowing it
now fails the round-trip test at the boundary instead of as a slow, invisible
regression in the field.

**Container tags are dropped with their bodies, and the option that sounds like
it does this does not.** `disallowedTagsMode: 'discard'` strips a tag and keeps
its children — right for inline markup, wrong for a container. A migrated page's
`<form>` or `<marquee>` re-injected its contents as live body copy, and
`htmlToExcerpt` runs the same sanitizer, so that copy also reached the SERP meta
description. Two options look like the fix and are neither:

- **`nonTextTags`** sets sanitize-html's `skipText`, which suppresses the *raw
  text* directly inside a disallowed tag. A container's children are elements, so
  `<marquee><p>x</p></marquee>` still emitted the `<p>`. It is correct for
  `script` / `style` / `textarea` / `option` and nothing more.
- **`exclusiveFilter`** is never consulted for a tag that is *already disallowed* —
  sanitize-html returns from its close handler before reaching it. Returning true
  for `form` there does nothing at all.

The removal is a **pre-pass**, and its position is the part that is invisible
until it bites. The pass that strips active-content tags already removes the
opening and closing tags of `form`, `object`, `select` and `marquee`, destroying
the evidence: afterwards there is no `<marquee>` left to match, so a subtree
removal placed after it silently matches nothing. Both wrong fixes were applied
and observed to change nothing before the ordering was found.
`sanitize-hardening.test.ts` pins every member of `MIGRATED_PAGE_FURNITURE` and
the ordering. The unclosed-tag sweep runs to the end of the input, so it is
applied **only** to the four tags whose truncated variants the migration actually
left behind; extending it to `<form>` would delete the rest of a valid page.

**The CMS bodies are plain text, not HTML.** The Google Sites export stripped
every tag, so the site chrome arrived as literal lines — "Search this site",
"Skip to main content", a sidebar navigation repeated three or four times, and a
trailing "Report abuse / Page details / Page updated" block. Tag-based filtering
cannot see any of it. `stripMigratedSiteChrome()` handles it, gated on
`looksLikeGoogleSitesExport()` so it can never touch hand-authored content.

Derive meta descriptions with `htmlToExcerpt()`, never by slicing the raw body.
Slicing raw text is how shipped SERP snippets came to begin "IndivisibleFairOaks.org
- Links Search this site Embedded Files…".

---

## Design System — "Sensory Luxury"

Tokens are defined in `src/app/globals.css` via `@theme`. No `tailwind.config.*` file exists.

### Active color tokens
| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#1e3a8a` | Primary blue — buttons, links, active states |
| `--primary-light` | `#2563eb` | Hover/focus variants. **Light surfaces only** — 3.5:1 on the dark header |
| `--primary-dark` | `#172554` | Pressed/deep variants |
| `--primary-ink` | `#1e3a8a` | Text on light surfaces (replaces raw lime) |
| `--secondary` | `#0f172a` | Page backgrounds, dark surfaces |
| `--ink-on-dark` | `#cbd5e1` | Body copy on dark surfaces |
| `--ink-muted-on-dark` | `#94a3b8` | Secondary copy on dark surfaces |
| `--primary-bright` | `#155dfc` | Brand blue as a **surface on dark pages** (CTAs) |
| `--primary-on-dark` | `#8ec5ff` | Brand blue as **display text on dark** (hero highlights) |
| `--primary-on-dark-muted` | `#50a2ff` | Brand blue as **eyebrow/label text on dark** |
| `--accent` | `#d97706` | Amber — donate CTA, warnings. **Surface, not text** |
| `--accent-gold` | `#f59e0b` | Active nav indicators, dark-surface accents |
| `--accent-red` | `#dc2626` | Destructive actions, errors |
| `--accent-lime` | `#d1ff00` | Dark-surface non-text accent only |
| `--surface-muted` | `#f8fafc` | Card backgrounds on light pages |

Use `text-primary-ink` for any text placed on light/white surfaces. Raw lime
(`#D1FF00`) is reserved for dark-surface non-text accents only — do not use it for
body or heading text.

**`--accent` and `--accent-gold` are text-unsafe on white** (3.19:1 and 2.15:1)
and `--primary-light` is text-unsafe on the dark header (3.51:1). These are
surfaces. On an amber background use `text-secondary` (5.69:1); on a dark
background use the `--ink-*-on-dark` pair. The axe gate in `e2e/a11y.spec.ts`
enforces this — do not "fix" a failing contrast check by swapping to a token
without re-measuring.

### Radius, elevation and motion tokens
`@theme` also defines `--radius-*` (`xs`…`3xl`), `--shadow-*` (`card`, `raised`,
`float`, `hero`, `header`), `--ease-sensory`, and `--duration-fast` (300ms) /
`--duration-slow` (500ms). Prefer these over ad-hoc `rounded-[2.5rem]` and
`shadow-[0_40px_100px_-20px_rgba(...)]` values.

`--primary-bright` / `--primary-on-dark` / `--primary-on-dark-muted` exist because
`--primary` is only 1.5:1 against `--secondary` — correct as a surface on white,
but a CTA built from it disappears on a dark page. The token set had no
"brand blue on dark" entry, which is why the civic pages reached for raw
`blue-600`. Adding a token was the fix; re-measuring first was the discipline.

### Changing colours: measure, then sweep
Never find-and-replace palette classes blind. The tooling exists:

```bash
bun run palette /about        # colours actually painted, by area, vs the tokens
bun run token-sweep -- --check  # dry run of the class mapping
bun run snap before           # capture every route to .snapshots/before/
# …make the change…
bun run snap after            # …then diff the two
```

Every mapping in `scripts/token-sweep.mjs` was chosen so the replacement resolves
to the colour the page was already painting (within ~1.03:1). The pixel diff is
what proves it, and the light pages act as the control: `/products`, `/login` and
`/contact` must read 0.00% changed. Gradient stops (`from-`/`via-`/`to-`) are
deliberately excluded — the atmospheric gradients are a design decision, not a
consistency problem.

### Enter/exit animation layer
`@utility animate-in` / `animate-out` and the `fade-*`, `zoom-*`, `slide-*`
composition classes are implemented **in `globals.css`**, not by
`tailwindcss-animate` (which is not a dependency and never was). Every
`data-[state=open]:animate-in fade-in-0 zoom-in-95` on a Radix primitive depends
on this layer existing. Adding a new variant means adding a `@utility` that sets
the matching `--tw-enter-*` / `--tw-exit-*` variable.

### Typography
- **Headings**: Outfit font, `font-black uppercase tracking-tighter`
- **Navigation**: `font-bold uppercase tracking-[0.2em]`
- **Body**: Inter font, `font-medium text-slate-600 leading-relaxed` on light
  surfaces; `text-ink-on-dark` on dark ones (`text-slate-600` is 1.86:1 on
  `bg-slate-950` and unreadable)

### Motion
- Use `motion` (the `motion` npm package, not `framer-motion`) for complex transitions.
- Tailwind utilities for micro-animations (hover scale, opacity, color transitions).
- All transitions must be `ease-out`, duration `300ms`–`500ms`. Avoid durations over 500ms for interactive feedback.
- The global `prefers-reduced-motion` guard covers CSS only. JS motion
  (`motion`'s `whileHover`, `scrollIntoView`, `scrollBy`) bypasses it — check
  `useReducedMotion()` / `matchMedia` at those call sites.

### Stacking order is one scale, not ad-hoc numbers
Five surfaces stack, and they were on five unrelated arbitrary `z-[…]` values.
The Wall-E launcher (`z-120`) sat **above** the open nav drawer (`z-110`), so on
mobile the chat bubble floated on top of the drawer and a click there opened a
second dialog over a surface that still held the focus trap. The command palette
overlay also tied with the Wall-E panel, so DOM order decided the winner.

| Layer | Class | Surface |
|---|---|---|
| 1 | `z-50` | `<header>` |
| 2 | `z-[60]` / `z-[70]` | WALL-E launcher / panel |
| 3 | `z-[100]` / `z-[110]` | Nav drawer overlay / content |
| 4 | `z-[120]` / `z-[130]` | Command palette overlay / content |

Overlay and content always differ by 10, and a modal layer sits above every
non-modal one. If you add a surface, put it on this scale.

### Scrollable regions must be focusable
An `overflow-x-auto` container is no longer focusable by default in Chrome and
Firefox, so a carousel without `tabIndex={0}` cannot be scrolled by a keyboard
user at all. `ProductSlider` follows the WAI-ARIA Scrollable Region pattern
(`<section aria-label>` + `tabIndex={0}`); Biome's `noNoninteractiveTabindex`
does not model it and is suppressed for that one file.

### No fake controls
A control must do what it says. `ChoirAudioPlayer` shipped a range input labelled
"Seek harmonic broadcast" over a Web Audio oscillator stack with no media
element — nothing to seek, and the `onChange` moved local state only. It is now a
read-only `role="progressbar"`. Check whether a control has an effect before
styling it.

### Reveal-on-hover must be hover-gated
`group-hover:opacity-100` alone hides a control on every touch device and leaves
it in the tab order while invisible on desktop. Gate the reveal with the
`hover-capable` custom variant (`@media (hover: hover)`) and add
`focus-within:opacity-100`. `ProductCard`'s wishlist button is the reference.

---

## Coding Rules

1. **Tokens always** — no hardcoded hex, no arbitrary Tailwind values for brand colors.
2. **generateMetadata everywhere** — every `page.tsx` must export it; title and description must be unique.
3. **Sanitize all CMS content** — `sanitizeWPContent` before any `dangerouslySetInnerHTML`.
4. **No console.log in committed code** — enforced by oxlint.
5. **No layout shift** — always provide width/height on `next/image`; use `aspect-ratio` utilities for unknown-dimension embeds. For a CMS image, **measure the size rather than reserve a guess**: `measureImageSize` reads the intrinsic dimensions from the bytes, and a block that cannot be measured must render in a fixed frame — never neither. See [`docs/content-editor.md`](./docs/content-editor.md#an-image-is-measured-or-the-frame-is-fixed--never-neither).
6. **Server-only env reads** — `process.env.SUPABASE_SECRET_KEY` etc. are accessed as dotted properties, never spread into objects, never imported into client modules. Public `NEXT_PUBLIC_*` vars are safe to access anywhere.
7. **Exact dependency versions** — use `^` only; pin via `overrides` for any package with a known CVE.
8. **MFA guards** — account-mutating operations must check MFA enrollment status server-side. See [`docs/mfa.md`](./docs/mfa.md).
9. **A `'use server'` module may only export async functions**, and the build
   enforces it — `Error: Only async functions are allowed to be exported in a "use
   server" file.` So a constant or a helper a *client* component needs cannot live
   beside the actions it describes, however much it belongs there. The CRM's
   numeric bounds live in [`src/lib/crm-limits.ts`](./src/lib/crm-limits.ts) and
   the step-up error discriminant in
   [`src/lib/mfa-guard.ts`](./src/lib/mfa-guard.ts). Each of those four was in the
   wrong file first, and the build said so.

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
| Sitemap | `cacheLife: 'hours'`, one query per crawl wave | Not truly static — a real query is cheaper than re-rendering |
| Checkout rate limit | 10/min/IP | Stripe fraud + CPU protection |
| Contact rate limit | 3/10min/IP | Anon-key flood protection |
| Pre-push e2e | Playwright when push touches runtime surfaces | Delivery gate without punishing docs-only pushes |

When the project moves to Vercel Pro, revisit `cacheLife: "minutes"` for price and stock freshness.

**The plan constrains configuration, not just performance.** A `vercel.json` with
a `* * * * *` cron failed the *build*, not just the schedule: the free tier
rejects sub-daily cron expressions, so the deployment for `c6ebb3ff` never
completed and `main` was left undeployable. It was reverted in `47c12542`.

Nothing local catches this — the pre-push gate ran the full suite, the build and
112 e2e, all green, because the fault is a hosted-plan constraint rather than a
code defect. Before adding a platform config file, check the tier first.
Anything needing sub-daily scheduling must use Supabase `pg_cron`, not Vercel
crons.

---

## Secrets & configuration — four stores, one reconciler

Credentials and runtime config live in four independent places, each with a
declared contract and a pre-commit checker. Full inventory:
[`docs/secrets-and-config.md`](./docs/secrets-and-config.md).

| Store | Declared in | Checked by |
|---|---|---|
| Vercel environment variables | `scripts/vercel-env.mjs` | `scripts/check-vercel-env.mjs` |
| Supabase Edge Function secrets | `supabase/functions/secrets.manifest.mjs` | `scripts/check-edge-secrets.mjs` + `supabase.yml` |
| GitHub Actions secrets + variables | `scripts/ci-env.mjs` | `scripts/check-ci-env.mjs` |
| Supabase Vault | *unused, deliberately* | — |

- **`NEXT_PUBLIC_*` is public by construction** — Next inlines it into the client
  bundle. It belongs in Vercel *Plain* and GitHub *Variables*, never in a Secrets
  store. Two real bugs came from getting this wrong.
- **Vault is the wrong tool here.** Every consumer needs the value at cold start
  without a database round trip. Vault only applies if a Postgres function or
  trigger needs a secret.

### The reconciler, and why it exists

All three checkers above are **offline** — they read source and YAML, so each proves
only that a manifest agrees with the code. None can see a dashboard. A live audit on
2026-09-27 found production drift in *every* category they claim to cover:
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `APP_URL` unset, so commerce
returned 503; all three `NEXT_PUBLIC_*` values held as GitHub *secrets*, so fork PRs
build against empty config; a `required: true` variable never set; twelve
undeclared, unread secrets in the edge project including a `GITHUB_TOKEN`.

```bash
bun run secrets:audit       # reconcile all four live stores (read-only)
bun run secrets:baseline    # re-accept the current state
bun run vercel:env:sync     # populate Vercel from .env.local (--apply to write)
```

The audit is read-only by construction — no mutation path, because a linter that
can delete a live credential is a liability. It prints the fix command for each
finding. `sync-vercel-env.mjs` is the separate, deliberate counterpart: the audit
decides what *should* be true, the sync applies what it can *source*.

**Only `.env.local` and Vault are readable out.** The Supabase edge secret store
and the GitHub secret store are **write-only by platform design** — `supabase
secrets` has no `get` and returns digests, `gh secret list` returns names. A
value written to either cannot be copied to another store by anyone. Do not
design a rotation or migration that assumes otherwise.

Three properties are load-bearing. Do not "simplify" them away:

1. **An unreadable store is UNKNOWN, never empty.** Measured across all three
   CLIs: a non-zero exit means unauthorized, and exit 0 with zero names means
   genuinely empty. So the *operation's own exit code* is the signal, and
   ambiguously-parsed output is UNKNOWN rather than empty — the same class as the
   `grep '"name": "X"'` bug the `supabase.yml` comment documents.

   There is deliberately **no separate auth preflight**. The first version used
   `vercel whoami` and was wrong: a project-scoped token can read a project's env
   but fails `whoami`, so the preflight reported a readable store as UNKNOWN. A
   safety check that manufactures false negatives is worse than no check, because
   it looks like diligence. Use the least-privileged command the operation
   actually requires.
2. **A committed baseline** (`scripts/secrets-baseline.json`) accepts current drift,
   so a not-yet-clean repository does not sit permanently red — only a **new**
   finding fails. A ratchet, not a wall. Findings are fingerprinted
   `code:store:name`, insensitive to rewording.
3. **`scripts/secrets-registry.mjs`** supplies owner, blast radius and expected
   store — the axes a name list cannot express. It deliberately owns *no names*;
   those stay derived from the three manifests, so there is no fourth list to drift.

`.github/workflows/secret-audit.yml` runs the live reconciliation daily at 04:37 UTC
(not `:00`, when every scheduled workflow competes for the shared runner fleet) and
on demand. Outstanding fixes are listed in
[`docs/secrets-and-config.md`](./docs/secrets-and-config.md#outstanding-remediation-from-the-2026-09-27-live-audit).
Four functions deploy `--no-verify-jwt` and are therefore publicly callable, which
is why an unread credential sitting in the edge store is a finding, not a nit.

**`CRM_BROADCAST_FUNCTION_URL` was set in production on 2026-09-30** as a
non-sensitive Production config var. It takes effect on the next production
deployment; until then, every broadcast still fails safely with "the broadcast
sender is not configured on this deployment" and nothing is queued. Value:
`https://<project-ref>.supabase.co/functions/v1/crm-broadcast-send`. It is a
plain URL, not a credential, and the registry expects it in `vercel-var` — which is the
inverse of the mistake the audit exists to catch, since `vercel env add` stores values as
**Sensitive/Secret** by default. See
[`docs/crm-operations.md`](./docs/crm-operations.md#configuration).

**Setting the variable alone was not the fix and never could have been.**
`crm-broadcast-send` was not in `.github/workflows/supabase.yml`, so the variable
pointed production at a route no pipeline shipped — while `secrets.manifest.mjs` already
marked `RESEND_API_KEY` and `APP_URL` required *for that function*, so the workflow was
asserting secrets for code nothing deployed. It is now deployed by that workflow (JWT
verification on) and probed with the publishable key expecting a 401.

---

## CI configuration (GitHub Actions)

The required set lives in **`scripts/ci-env.mjs`**, and
`scripts/check-ci-env.mjs` diffs it against the workflow files. It runs in the
pre-commit gate, so drift fails at commit time rather than at 3am.

- **`NEXT_PUBLIC_*` and `SUPABASE_PROJECT_REF` are repository *variables*, not
  secrets.** Next inlines `NEXT_PUBLIC_*` into the client bundle, so they are
  public by construction. Storing them as secrets also broke `ci.yml`: secrets
  are withheld from `pull_request` runs from forks, and `env.ts`'s `.default()`
  absorbed the empty value, so a fork PR built successfully against placeholder
  credentials.
- **CI waits forever when no runner can take the job, and that is not always a label
  problem.** `runs-on: [self-hosted, linux, <frontend|backend>-runner]` is
  arch-neutral on purpose (2026-10-05): both registered runners carry those
  labels, so either can serve. Do not re-add an `X64`/`ARM64` token to pin jobs
  to one runner. The real runner is `indivisiblefairoaks-runner-1`, a Quadlet container on
  the **ghrunner** host (an x86_64 Linux box over Tailscale) whose labels are
  `self-hosted, Linux, X64, ghrunner, personal, personal-organicnz,
  frontend-runner, backend-runner` — matching its native x86_64 architecture.

  Every job here sat `queued` for weeks because that container never registered.
  Its entrypoint mints a registration token from `api.github.com` before
  starting; with no DNS it failed, so GitHub never saw an X64 runner at all. The
  cause was the podman network: `ghrunner` had DNS enabled, so containers got
  aardvark-dns on `10.89.0.1`, which forwards to the host's systemd-resolved stub
  on `127.0.0.53` — a **loopback-only** address a bridge network cannot reach.
  Recreating the network with `--disable-dns` makes podman inject the real
  upstream itself, and the container registers within seconds.

  **The diagnostic trap is the part worth keeping.** The runners page listed a
  single runner — `personal-organicnz`, a hand-registered ARM64 Mac — and that
  was *accurate* rather than misleading: the real runner was missing because it
  had never registered. "The selector matches no runner" and "the runner does not
  exist" are indistinguishable from the repository, and an ARM64/X64 partial
  overlap looks exactly like a label bug. So never read this from the run list,
  where a queued job and an unservable selector are identical. Ask
  `gh api repos/:owner/:repo/actions/runners -q '.runners[].status'` **and**
  `-q '.runners[].labels[].name'` — and check that the runner you *expect* is on
  that list at all, not merely that its labels match.

  The host is still the ceiling: the container runs with `Memory=1073741824`
  (1024 MiB) and `MemorySwap=4294967296` (4096 MiB, backed by 6 GB host swap),
  so jobs end `cancelled` rather than `failed` once the cgroup is exhausted.
  With the expanded 6 GB host swap, `build-e2e` configures `NODE_OPTIONS: --max-old-space-size=3584`
  to give V8 sufficient room to compile and prerender without thrashing garbage collection
  or failing on "Ineffective mark-compacts". The full record is in [`docs/ci-runners.md`](./docs/ci-runners.md).
- **NEVER switch CI jobs to GitHub-hosted runners (`ubuntu-latest`).** The runner
  fleet is strictly self-hosted rootless Podman containers on our own server (`ghrunner`).
  Never attempt to "fix" slow or failing builds by changing `runs-on` to `ubuntu-latest`.
  Instead, observe the memory and concurrency contract:
  1. **Memory (`NODE_OPTIONS`)**: With the host's expanded 6 GB swap (`MEMORY_SWAP=4096M`
     on `ghrunner`), `build-e2e` sets `NODE_OPTIONS: --max-old-space-size=3584` to give V8
     room to compile and prerender without thrashing garbage collection cycles.
  2. **Next.js static page generation**: In `next.config.ts`, `isE2EBuild` must configure
     `experimental.cpus: 1` and `staticPageGenerationTimeout: 180` (or higher).
     The default 60s timeout triggers retry spirals (3 retries × dozens of pages)
     when static rendering touches swap, and multiple workers fight for RAM. 1 worker
     prerenders all 66 static pages cleanly in ~1.5 seconds.
  3. **Playwright worker limit**: Pass `--workers=1` in CI (or rely on `playwright.config.ts`'s
     `workers: 1` in CI) to prevent multiple concurrent Chromium instances from fighting
     against Next.js (`next start`) and the mock server for memory.
- **The local lefthook gates are therefore the real gates**, and they do run on
  every push: 33 pre-commit guards, then lint → unit → coverage → types → build →
  peer-deps → 95 Playwright specs (95 + no running tests). Migrations and Edge Functions are **not**
  deployed by hand: `supabase.yml` is the only delivery path and a push touching
  `supabase/**` is its trigger, so the fix and the deploy are one action. It pushed
  migrations to the hosted project at 20:56 on 2026-10-04 while its sibling
  `deploy` job failed on a type error — so after any partial failure, check whether
  schema moved before re-running. See
  [`docs/ci-runners.md`](./docs/ci-runners.md#migrations-and-edge-functions-ship-through-supabaseyml).
- **Every workflow declares an explicit `permissions:` block.** Two that hold
  credentials previously inherited the repository default, which may grant
  write.
- `SUPABASE_SECRET_KEY` bypasses RLS entirely. It is scoped to one scheduled
  workflow; a leak makes the row-level security model decorative.
- Full inventory and rationale: [`docs/ci-secrets.md`](./docs/ci-secrets.md).
- All four stores together: [`docs/secrets-and-config.md`](./docs/secrets-and-config.md).

### Supabase Edge Function secrets — a *separate* store

`supabase functions deploy` ships **code only**. `supabase.yml` never runs
`supabase secrets set`, so these values are set by hand in the dashboard and CI
could not see them. The `verify` job's probes all fail on a validation or method
check that runs *before* any secret is read, so a missing `STRIPE_SECRET_KEY`
deployed green and broke silently.

- `supabase/functions/secrets.manifest.mjs` declares what each function needs;
  `scripts/check-edge-secrets.mjs` (pre-commit) keeps it in sync with the code and
  with `env.example.md`, and `supabase.yml` asserts the required ones are actually
  set in the hosted project.
- Platform-injected (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) are absent from `secrets list` by design — do not
  add them to the required list.
- **`APP_URL` currently defaults to the apex, which 302s to Google Sites.** WALL-E
  citations and Stripe return URLs therefore point somewhere that does not serve
  the app. It must be set to the staging host now and the apex at cutover.
- **Supabase Vault is not used.** Environment injection is correct at this size —
  every consumer is an edge function here and needs the value at cold start. Vault
  earns its place only when a Postgres function or trigger needs a secret.
- The edge `checkout` function carried the **entire NZD bug** independently of the
  Next app and was directly reachable. `src/lib/__tests__/commerce-parity.test.ts`
  now asserts `_shared/commerce.ts` and `src/config/commerce.ts` agree.

---

## Delivery Gates (lefthook)

- **pre-commit**: secrets, migration guards, RLS/SECURITY DEFINER, Biome, oxlint, typecheck, env contracts (local `.env`, the GitHub Actions inventory, and the secrets registry in `--offline` mode — no network, because a hook that needs a token is a hook that gets bypassed), lockfile pairing, data-points seed↔reader↔fallback consistency (`scripts/check-data-points.mjs` — a seed nobody reads, a read nobody seeds, and a wired fallback that disagrees with its seed all fail, with accepted findings annotated in `scripts/data-points-baseline.json`, and that ratchet only shrinks), documentation numeric claims (`scripts/check-doc-claims.mjs` re-derives guard counts, the suppression baseline, `lefthook.yml`'s length, spec totals and the two coverage floors from their sources of truth), and `playwright test --list` when `e2e/**` changes (spec parse only — no browser launch).
- **`lefthook.yml` is 528 lines of wiring; the logic is in `scripts/hooks/*.mjs`.** Every
  guard that was a `run: |` bash block is now a `bun scripts/hooks/<name>.mjs` call, and
  its rationale comment moved into that file's header — where it sits beside the code it
  explains rather than four hundred lines above it. `lefthook.yml` keeps what only it can
  know: the `glob` that decides when a guard runs, its `priority`, and the staged-file
  arguments. The number above is re-derived from the file on every commit, so it cannot
  drift silently. Two things stayed inline deliberately: the `suppress-count` gate, because
  its `BASELINE=12` is what `check-doc-claims.mjs` parses, and the eight guards that were
  already one-line `bun scripts/check-*.mjs` calls. **Adding a guard means adding a file
  under `scripts/hooks/`, not writing bash in YAML.**
- **pre-push**: lint → unit → typecheck → production build → peer-deps → **Playwright e2e delivery gate** (full suite, `workers=2`) when the push range touches `src/`, `e2e/`, `public/`, `supabase/`, app configs, or the lockfile. Docs-only pushes skip e2e with an explicit note.
- **The coverage gate is per-file, not a global percentage, and that is deliberate.**
  Vitest's bare `statements: 90` is checked against the *aggregate* over every included
  file, so a stricter file cannot raise it and a looser one silently lowers it for
  everything else. `vitest.config.ts` therefore names globs: 90 across the board, with
  `src/lib/actions/crm.ts` on an explicit floor of **89 / 85 / 100 / 93** and
  `src/lib/actions/content.ts` on **65 / 57 / 70 / 70** (raised 2026-10-12 with the
  first `getContentList` suite; was **58 / 54 / 61 / 65**). Both were in **no threshold
  at all** until recently — neither was in the `include` list — which is how a
  ceiling refusal stayed dead code and a `created_by` column stayed unwritten with
  the pipeline green. Their remaining uncovered branches are `?? 0` / `?? 'draft'`
  defences against `NOT NULL` columns. A floor is a ratchet, not an exemption: it can
  only go up.
- **Two exclusion globs do not compose; write one.** Vitest treats each threshold key
  as its own "everything except this" set, so naming `'!crm.ts'` and
  `'!content.ts'` separately makes each one *include* the other file, and each set
  then fails on the other's floor. The exclusion has to be a single
  `'!src/lib/actions/{crm,content}.ts'`.
- **Adding a file to `include` can turn the gate red without touching anything else.**
  The same aggregate arithmetic is why. `src/lib/image-size.ts` entered at 86% branches
  and pulled everything-except-`crm.ts` from 90.0% to 89.86% — the build failed on
  coverage alone, with 895 tests green. The fix is to cover the new file, never to
  widen an exclusion to accommodate it: the whole point of naming globs is that a
  file in the list is a file being measured.
- **A gate that is sometimes red is not a gate.** The `blocks.test.ts` property
  suite (four properties × 300 generated documents, up to three serialize → parse →
  sanitize cycles each) sat right at Vitest's 5s default once `v8` instrumentation
  was on, and failed *intermittently* under `test:coverage` — pass or fail depending
  on machine load. That trains people to re-run until green, which is how a real
  regression gets through. The budget is now stated per suite
  (`PROPERTY_TIMEOUT_MS`) with the run count and every assertion untouched; raising
  `testTimeout` globally would have hidden the same cost everywhere else.
- **A mock narrower than the real client fails on correct code.** Five suites
  hand-rolled their own `adminClient`, each modelling the smallest slice it needed.
  `saveContent` legitimately calls `.update().eq().select().maybeSingle()` — the
  shape PostgREST requires to report whether an UPDATE matched a row at all — while
  `content-revisions`' `update()` returned `{ eq: () => Promise.resolve(...) }`, so
  correct code failed a green suite. `src/lib/__tests__/supabase-mock.ts` is the
  shared row-based replacement, and **all eight action suites now use it**: the
  three CRM suites were converted, so nothing asserts on call *arguments* any
  more. The conversion was worth its cost immediately — it found four places
  where the shared mock was wrong rather than merely narrow:

  - `.in()` and `.neq()` matched a **null** row. PostgREST's `in.(null,…)` still
    matches the non-null entries but never the null one, and `s <> 'active'` is
    UNKNOWN rather than true when `s` is null. Both are now excluded, and
    `supabase-mock.test.ts` pins it.
  - A **chunked insert** answered with a single row. PostgREST returns an array
    from an insert with `RETURNING`, so the CSV importer's `(created || []).map(…)`
    hit `map is not a function` on a correct caller.
  - A **`DELETE … RETURNING`** answered `data: null` unconditionally. supabase-js
    sends `Prefer: return=representation` for `.delete().select(…)`, and
    `deleteCRMTask` depends on the deleted row, so the action reported failure
    for a delete that had worked.
  - The builder was **not a `PromiseLike`**, so a test could not `await` one
    without a cast.

  The mock still deliberately does **not** model `.or()`, `.contains()` or
  `.textSearch()`: those are PostgREST query-string languages, and reproducing
  them means reimplementing PostgREST's parser. A test reaching one must declare
  `filterRows` — the rows that filter actually selects — and reaching one without
  declaring it returns **no rows**, so the omission fails loudly instead of
  passing. The handful of tests about a filter *string's contents*
  (search-term sanitisation) record the arguments via `{ recordFilters: true }`
  alongside the rows, because a string that would produce a 400 satisfies every
  assertion about rows.

  **One thing a row-based mock cannot show is pinned explicitly.** Deleting the
  `.order('id', …)` from `resolveBroadcastRecipients` — the fix for a contact
  being mailed twice across a page boundary — fails nothing about rows, because
  the resolved audience never leaves the resolver and a count is identical either
  way. `crm.test.ts` asserts it through `orderCalls` for that reason. Mutating
  the source to delete that `.order()` fails that test and no other in the file,
  which is the evidence it is doing the job no row assertion could.
- Bypasses (documented in `lefthook.yml`): `LEFTHOOK=0`, `LEFTHOOK_EXCLUDE=<command>`.

---

## Deferred Upgrades

### TypeScript 7 — BLOCKED
Next.js 16.3 loads TypeScript via the JS compiler API (`lib/typescript.js`), which was removed in TS 7.0. Native-TS builds land ~TS 7.1. Tracking: [vercel/next.js#95633](https://github.com/vercel/next.js/issues/95633).

**Stay on TypeScript 5.9.** The `tsconfig.json` is already shaped for TS 7 (`moduleResolution: bundler`) so the upgrade will be a version bump only.

TypeScript 6 is a bridge release (deprecations only) — skip it.

---

## Known Follow-ups

Deliberately left undone. None block the apex cutover.

1. **The dark civic pages keep their gradient stops.** ~690 raw palette classes
   were swept to tokens and verified pixel-identical (`scripts/token-sweep.mjs`).
   What remains are the atmospheric `from-`/`via-`/`to-` gradient stops and a
   handful of `indigo-*`/`emerald-*` status tints, which have no token equivalent.
   Collapsing them would flatten a deliberate design choice, so they stay.
2. **Apex SPF does not authorise Resend.** Application mail passes DMARC on
   Resend DKIM alignment alone. `_spf.resend.com` is NXDOMAIN, so adding that
   `include` would make the whole record a `permerror`. Resolving this is a
   decision, not a mechanical fix — see the recovery log §8.
3. **`google._domainkey` is unpublished**, so outbound Workspace mail fails DKIM.
4. **Shipping rates are placeholders** inherited from the previous site's New
   Zealand tariff. See `src/config/commerce.ts`.
5. **HSTS `preload` + `includeSubDomains`** pins every subdomain to HTTPS for
   ~12 months once submitted, including staging.
6. **Existing CRM tags are not lowercased.** Every write boundary now
   normalises — contact schema, segment schema, broadcast audiences, merge,
   and the filter parser all run through `normalizeTags` — but rows written
   before that fix still hold `Choir` next to `choir`. The remainder is the
   one-time `UPDATE … lower(tags)`, a data change that belongs to the chapter,
   not to a deploy.
7. **The admin surfaces need their seeded sessions to have browser coverage.**
   `e2e/admin-authenticated.spec.ts` drives a real password sign-in into a stored
   session and `e2e/mfa-challenge.spec.ts` drives the step-up handshake, but both
   `test.skip` unless their credentials are set — and nothing sets them, because
   that needs two seeded users on the target Supabase project. The MFA suite needs
   **two** roles, and they are mutually exclusive: a non-MFA-enrolled admin (so
   `/admin` resolves at all) and an admin with one verified TOTP factor plus its
   `E2E_MFA_TOTP_SECRET` (so an AAL1 session can be bounced to `/auth/mfa`). The
   five secrets are declared in `scripts/ci-env.mjs` and registered in
   `scripts/secrets-registry.mjs`, so the audit sees them rather than finding five
   undeclared names. Until they exist, the CRM mutation path, the contact editor's
   optimistic-concurrency handshake and the AAL2 upgrade are unit-tested only —
   and a skipped suite must never be read as a passing one.
8. **Pre-existing CMS images still carry no `width` / `height`.** New and edited
    images are measured from their bytes at upload, and a hand-typed URL is
    measured client-side, so nothing added from here on shifts. The content
    migrated from Google Sites does not: those images sit on external hosts that
    are largely dead, so a backfill would rewrite every `content` row — and mint
    a revision per row — for what would mostly be no-op measurements. It is also
    a production data change, which belongs to the chapter rather than to a
    deploy. Cheaper when an author touches the page anyway.
9. **The edge `checkout` function is now rate-limited.** It shares the
    `search_rate_limit` rolling-window table with the search and WALL-E
    functions under a `checkout:` ip prefix, 10/min/IP — the same limit the
    Next route carries. `verify_jwt` still accepts the publishable key (public
    by construction), so the CORS `origin` restriction remains inert for a
    non-browser client; the table-backed window is the working control. Rows
    older than 7 days are purged nightly by pg_cron (migration
    20261008000000 — the edge functions insert and count but never delete).
10. **Consent is filterable, countable, saveable, and captured — but the reason is
    not recorded, and pre-existing rows are not backfilled.** `getCRMContacts` takes
    `consent: 'opted_out' | 'opted_in' | 'unasked'`, the dispatch bar names how many
    matching contacts were excluded rather than asserting that exclusion happens, and
    `crm_segments.consent` (migration 20261005000000) means the audit can be saved as
    a reusable segment. Migration `20261005020000` makes the column nullable and the
    contact form carries a second checkbox, so "never asked" is now a state the
    database can hold and a person who asked a question is no longer implicitly on
    the mailing list. The two numbers reconcile deliberately: `count + excludedCount`
    is every contact the audience rules matched, because both come from one target
    specification rather than two.

    Two things this deliberately did **not** do, and they are chapter decisions
    rather than deploys. **Why** somebody declined is still unrecorded — a volunteer
    answering "why did I stop hearing from you?" has nothing to read, and the answer
    lives only in an email thread. And **existing rows keep their `false`**, so a
    historical `false` still reads as `opted_in` when it may never have been an
    agreement at all; nothing here converts it into one. Until the chapter decides
    otherwise, use the `unasked` filter to find the genuinely unasked contacts and
    treat pre-migration `false` values as unknown-but-reachable. See
    `docs/crm-operations.md`.
11. **The next campaign reaches fewer people than the last one, and that is
    correct.** Migration `20261005020000` drops the `do_not_email` default, so every
    contact created by a path that does not ask — profile signup, store order, a CSV
    import with no consent column — is `NULL` ("never asked") and therefore excluded,
    where previously the column default opted them in. Enforcement was never the
    problem; capture was. A chapter-visible number changes on deploy, which is worth
    knowing before the first campaign goes out rather than after.
12. **`crm_sync_historical_records()` and the three `fn_sync_*_to_crm()` triggers
    were the only privileged functions not pinned to `search_path = ''`.** All three
    triggers fired on rows reachable from the public internet — the contact form's
    RPC is `SECURITY DEFINER` and granted to `anon`, and the trigger fires on
    its owner-privileged insert, with `RLS` bypassed and a `search_path` starting
    at `public`. (An earlier draft of this note named a `WITH CHECK (true)` INSERT
    policy for `anon`; that policy was dropped at 20260922050000 and never
    recreated. The conclusion — pin the path — was right; the stated mechanism
    was stale.) The pre-commit guard only checked that *a* `SET search_path` was
    present, and `= public` satisfies that; it now checks the value and the
    body's qualification. Fixed by migration 20261005010000, which re-declares
    the three. Note: `fn_sync_contact_submission_to_crm()` is declared in
    20261005020000 instead, because that version also writes `do_not_email`;
    leaving it in 20261005010000 would have produced a dead intermediate
    declaration on a partial apply.
13. **The merge RPC's arithmetic is plpgsql and only a text test covers it.**
    `merge_crm_contacts` is `SECURITY DEFINER`, `search_path = ''`,
    `service_role`-only, and locks both rows survivor-first. No row-based mock can
    execute it, so `merge-crm-contacts-migration.test.ts` reads the migration and
    asserts the properties — a guard against editing the SQL, which is the
    realistic regression. It does not execute it: `migration-dryrun.mjs` is
    `supabase db push --dry-run`, which diffs the migration history against the
    linked project and never applies a statement.
    So nothing in the repository runs `merge_crm_contacts`, and the first execution is
    the push itself. A test that reads SQL is not a test that runs it, and neither is
    a diff.
---

## Agent Skills

Skills are installed in `.agents/skills/` (symlinked for discovery at `.claude/skills/`).
The vendored ones are pinned in `skills-lock.json` — load on demand, do not load
all skills upfront, do not re-install manually.

`cms-editor-and-crm` is **not** vendored. It is written for this codebase, is not
in the lockfile, and is meant to be edited when an invariant changes.

Full usage guide with project-specific context for each skill: **[SKILLS.md](./SKILLS.md)**

Quick trigger table:

| Skill | Load when |
|---|---|
| `cms-editor-and-crm` | **Any change to the content editor, the CRM, `sanitize.ts`, or anything that can send email** |
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

## The admin surfaces

Two admin surfaces own the material a volunteer actually edits. They have their
own docs, because their failure modes are invisible to review and to unit tests.

- **Two-factor authentication** — [`docs/mfa.md`](./docs/mfa.md). Enrolment,
  the step-up contract, and the five gates. Read it before changing
  `src/app/auth/mfa/`, `src/lib/mfa-guard.ts` or `MfaSettings.tsx`. Three things
  there are load-bearing and each has failed visibly:

  - **The challenge page answers TOTP only** and filters on `factor_type`. Picking
    the first verified factor of *any* type made a phone factor send an SMS and then
    reject the digits permanently, with no explanation.
  - **A guard failure has a `reason`, and only `step_up_required` earns a redirect.**
    Redirecting on every failure was a four-hop loop — a `listFactors` failure sent
    the user to a page that could not read its factors either, then to `/login`,
    then back to a gated route. `state_unknown` fails closed and is *shown* as a
    fault.
  - **Recovery is a second factor, not a code.** There are no backup codes; losing
    every authenticator is still an out-of-band dashboard reset, and the panel says
    so rather than implying otherwise.

  `/account` and `/auth/mfa` read **live** `listFactors()` rather than AAL alone,
  because AAL comes from the cookie snapshot and the two disagree after 2FA is
  unenrolled elsewhere — which produced an unanswerable challenge. A commit
  message on that gate named a cause that is unreachable on the installed SDK; the
  comment above the gate now states the real one.

- **Content editor** — [`docs/content-editor.md`](./docs/content-editor.md).
  Block model in `src/lib/blocks/`, shell in `ContentEditor.tsx`, server actions
  in `src/lib/actions/content.ts`. Three invariants matter most: autosave persists
  with the document's *current* publish state (an earlier version hardcoded
  `draft` and quietly unpublished live pages); image deletion checks
  `content.body`, `content.featured_image` **and** `content_revisions.body`
  before removing an object; a revision restore writes the revision's
  `featured_image` back instead of clearing the hero; and the history panel
  shows what a restore would change with an inline confirm, never a native
  dialog. Every destructive action on both surfaces goes through the shared
  `ConfirmAction` component — `window.confirm()` asks a blind question and
  cannot be automated, so the paths behind it went untested. A preview renders
  through the same sanitizer and classes as the public page, as a modal. A row
  action names the state it reaches: **View** only when a page is live, never a
  public-URL link for a draft, which resolves to a 200 "Page Not Found" that is
  indistinguishable from a typo. SEO
  meta fields (`meta_title` / `meta_description` in `content.metadata`) win
  over derived values in `generateMetadata`.

  **A save carries the version it was based on.** `saveContent` takes an optional
  `expectedUpdatedAt` and turns it into a precondition on the same UPDATE — two
  organizers on one page used to be last-write-wins with no signal, which is the
  default outcome of the one surface whose purpose is to look after written work.
  Three details are load-bearing and each fails silently without its own test:
  the precondition rides on the UPDATE rather than a SELECT-then-UPDATE (which
  would leave a window in which a colleague's save still lands); the returned
  version is the one the `BEFORE UPDATE` trigger wrote, not a JS timestamp (a
  second clock disagrees, and the author's next autosave conflicts with itself);
  and a null claim uses `.is()`, never `.eq()` (`.eq(col, null)` is
  `col=eq.null` and matches nothing, so the guard would fire against an untouched
  page). The editor keeps it in a ref and adopts it from each save's response,
  and a revision restore adopts the version it re-reads — but undo, redo and
  draft recovery deliberately do not, because they never write the row.
- **A status control has to reach the guard, and a snapshot has to match the
  write.** The Status `<select>` sat next to the Publish button and called
  `setStatus` — local state — for years. `status` is part of the document
  snapshot, so `dirty` flipped and the autosave effect published 2.5 seconds
  later: choosing "Draft" on a live page took it off the site with no
  confirmation and no toast. It could not reach the guarded path because that
  function was a no-argument *toggle*, and a toggle cannot express "the author
  picked Draft" — hence `handleSetStatus(next)`. Separately, `persist` snapshotted
  `fields`, whose `status` predates the write, so a successful publish left
  `dirty` true: the toast said "Published", the indicator contradicted it, and
  autosave rewrote the document 2.5s later, minting a second `content_revisions`
  row per publish. Both are pinned in `ContentEditor.safety.test.tsx`.
- **A rejected promise is not a failed result.** `saveContent` returning
  `{success:false}` was always reported. A *rejection* was not: `handleSave` set
  `saving = false` on the line after the `await`, which a rejection skips, and
  `saving` is what disables the Save button — so one dropped connection left the
  editor permanently unable to save itself, recoverable only by reloading, which
  discards the document. The autosave effect was `void persist().then()` with no
  `.catch()` at all, so it claimed "Saving…" for the rest of the session while
  writing nothing. Both now report, and the message names the three things a
  volunteer can act on: not saved, text still on screen, copy it before reloading.
- **CRM and broadcasting** — [`docs/crm-operations.md`](./docs/crm-operations.md).
  Delivery is off the request path: the action writes a `queued` row and the
  `crm-broadcast-send` Edge Function owns delivery and progress. A self-test
  derives its recipient from the session and **cannot be pointed** at anyone
  else; the narrowing lives in the Edge Function, where recipients are resolved.

  `crm_broadcasts.status` omits nothing, but it once omitted `'queued'` — the
  value the app writes and the sender requires — so **every broadcast failed at
  the insert** and no unit test noticed, because they mock the Supabase client.
  A `CHECK` constraint that disagrees with the code is a trap; when you add a
  state, update the constraint in the same change.

  **Two of its guards were broken, in the direction that looks like safety.**
  `isDeliverableAddress` used a POSIX character class, `[^@[:space:],]`, in a
  **JavaScript** regex. There is no such thing inside `[...]`: it is the literal
  run `[ : s p a c e :]`, so the negated set forbade the letters `s p a c e`
  alongside the separators. `alice@example.com` was rejected — the guard stopped a
  self-test reaching several recipients by refusing to reach *any*. And it lived
  only inside the Edge Function, which no test runner can reach, which is why the
  editor and the CRM are covered and the code deciding who receives email was not.
  It is now in `_shared` and unit-tested, and **anything a
  `crm-broadcast-send` guard must be right about belongs in `_shared` for the same
  reason.** A guard that fails closed on legitimate input is still broken, and one
  nobody can see reads as protection.

  **The audience is paged in a stable order.** Both resolvers called
  `.range(offset, …)` with no `.order()`. Offset paging is coherent only against a
  total order that does not change between statements, and PostgREST emits no
  `order` parameter when none is given — so a contact who opted out, or a CSV
  import that landed, between page 3 and page 4 shifts every later row by one. The
  boundary contact is then **mailed twice** and `recipient_count` is wrong; a
  concurrent insert silently skips someone instead. Both now order by `id`, the
  primary key, so the order is total — a non-unique column would still tie. The
  same file's `getCRMExistingTags` already did this, which is what made it an
  oversight rather than a decision.

  **The directory's filters go through one helper, and the consent filter used to
  be dropped by three of the four paths that build a URL.** `src/lib/crm-filters.ts`
  owns the filter→URL, filter→action-argument and segment→filter mappings. The
  quick pills, the saved-segment chips and **the CSV export** each omitted
  `consent`, so an organiser auditing opt-outs clicked a district and the whole
  opted-out population silently reappeared — and exporting from an "Opted Out of
  Email" view produced a file of *every* contact, which is both wrong and the one
  export a chapter takes off-platform. The export and "save as segment" also read
  uncommitted form state rather than the applied filters, so both could act on a
  set that was never on screen. Each omission is a wrong set of people with no
  error, which is why it is one function and a test per path.

  **Three unbounded reads, and one silently capped.** The contact 360 timeline had
  no `.limit()` at all, so a recipient of one 5,000-recipient broadcast had 5,000
  timeline entries on their profile; it is now capped at 50 with a true count and
  a line saying what is not shown. Campaign history and drafts were `.limit(50)`
  and `.limit(20)` with no pager, so a chapter past fifty campaigns could not see
  its fifty-first and a twenty-first draft was unreachable *and* unremovable. The
  composer's tag chips were `slice(0, 40)` with no indication, so a chapter with
  more than 40 tags had constituents who could not be targeted at all. The
  broadcast template carried the same class of bug as a hardcoded apex
  (`BROADCAST_SITE_URL`) in both copies — a staging build mailed links to a
  host that 302s to Google Sites until the cutover. The origin is now a
  parameter: the Next app passes `NEXT_PUBLIC_SITE_URL`, the sender passes
  `APP_URL`, and the parity test asserts neither copy hardcodes an origin.

  **Every wait in a send is now bounded, and two of them were not.** The dispatch
  fetch, the Resend call per recipient, and each progress poll had no timeout. A
  hung dispatch left the composer's button disabled forever with the row still
  `queued`; a hung Resend call stranded the row at `sending` with
  `dispatched_at` set — the one state that must never be re-dispatched; and a hung
  poll froze the progress loop, because its only exit is a `catch` that a hang never
  reaches. Bounds and reasoning: `docs/crm-operations.md`.

  **`markCRMBroadcastFailed` is one-directional on purpose.** The documented
  recovery for a stranded row was "send a new, narrower broadcast" and then mark
  the old one failed — correct, and previously only reachable by editing the
  database. The action can only move a row to `failed`, never back, and refuses a
  row dispatched in the last fifteen minutes, because cutting short a slow send is
  the one irreversible mistake available here.

  **A GET must never change state on the unsubscribe route.** It did: the
  `do_not_email` write sat *above* the method branch, so `GET` opted the contact
  out and only differed in what it rendered afterwards — while the route's own
  docblock said GET only rendered a confirmation. Corporate mail security products
  fetch every URL in an inbound message (Proofpoint, Barracuda, Microsoft Safe
  Links) and clients prefetch on hover, so any of them turns "the recipient
  clicked unsubscribe" into "the recipient's mail gateway clicked unsubscribe" —
  a silent mass opt-out across a 5,000-recipient list. GET now writes nothing and
  renders a form; POST performs the opt-out, told apart by the *body* (`confirm=1`
  from the browser, empty from an RFC 8058 auto-confirm) rather than by sniffing
  `Accept`, which would silently start returning an empty `204` to a real person
  if a mail client changed a header.

**No test may send email, by two different mechanisms.** The contact form's
notifier is *redirected* in e2e: `playwright.config.ts` points
`CONTACT_FUNCTION_URL` at a local mock, and `notifyUrl()` refuses to fall back
to the live URL in an e2e build, so the call is harmless rather than bypassed —
the suite still exercises the delivery-status UI and its failure branches. The
CRM send paths are *refused in code*: `sendCRMBroadcast`,
`sendCRMBroadcastSelfTest` and `sendCRMDirectEmail` return early when
`isE2EMode()` is true, because they dispatch to a live Edge Function that talks
to Resend and there is no redirect for them. That matters the moment e2e gains a
seeded admin session. Any new send path needs the second mechanism;

**The e2e flags must never reach a Vercel environment.** `isE2EMode()` requires
both `CONTACT_SUBMISSION_TEST_MODE` and `NEXT_E2E_BUILD`, and Playwright sets
both only on the server process it spawns. If either ever appears in a Vercel
env var, that deployment becomes a site where CRM sends silently fail and the
contact form posts to a mock — with no UI signal. The admin layout now renders
a loud amber banner whenever `isE2EMode()` is true, so an accidental e2e build
announces itself to the first admin who loads `/admin` rather than reading as
a broken CRM. The two vars themselves are never a "config knob" anyone should
flip on purpose; they are a property of the test harness.

  A preview stays in the campaign history — hiding it would leave a campaign with
  no visible trace — so every column has to say what happened. Its audience reads
  `Nobody — sent only to you`, never `All Constituents`, because a preview row has
  no filters at all, and rendering it the way a campaign renders tells an
  organizer a blast went out when nobody received anything.
`isE2EMode()` requires **both** `CONTACT_SUBMISSION_TEST_MODE` and
`NEXT_E2E_BUILD`, so CI cannot enable it by accident and an admin cannot
disable real delivery by setting one variable.

---

## Visual Editor Overlay & CRM Panel

### Visual Editor Overlay (`src/components/visual-edit/VisualEditOverlay.tsx`)

A full-featured in-page visual editor mounted globally in `src/app/layout.tsx`. Admins toggle it via the **Editorial Button** (icon-only `PenLine` in header, `EditorialDrawerRow` in mobile drawer).

**Capabilities:**
- **Direct in-place editing suite**: Click any text block or copy region to edit inline with floating formatting toolbar (Bold, Italic, Underline, Strikethrough, Inline Code, Highlight mark, Bullet/Numbered lists, Link/Unlink, Clear formatting, Heading 2/3 and Paragraph block format quick switchers, live word/character counters).
- **Direct S3 image replacement & 1-click device upload**: Click any `<img>` tag to summon the image asset pill, replacing assets via `CRMMediaLibraryModal`, directly uploading replacement files from desktop via `uploadCRMMedia`, or updating accessibility `alt` text with instant backend persistence.
- **Dynamic ResizeObserver tracking**: Uses a `ResizeObserver` on `[data-visual-edit-root]` debounced with `requestAnimationFrame` to keep section overlays and bounding boxes pixel-perfect during inline text expansion and dynamic DOM mutations.
- **Interactive controls protection**: Tabs, accordions, audio players, dialog triggers, and civic buttons (`[role="tab"]`, `[data-civic-control]`, `.audio-player`, etc.) are protected from `contentEditable` hijacking.
- **Responsive viewport simulator**: Interactive Desktop (100%), Tablet (768px), and Mobile (390px) framed preview modes directly in the bottom dock toolbar.
- **CRM Visual Broadcast Composer enhancements**: Email canvas viewport simulation (100% full width, 600px email standard, 375px mobile phone) and real-time word count & reading time estimation stats in `VisualComposerCanvas.tsx`.
- **Per-section CRUD**: Every section has a floating action pill (frame on/off, edit, duplicate, move up/down, add below, delete with `ConfirmAction`)
- **Block editor modal**: Rich editing for all 11 block types (heading, paragraph, bulletList, orderedList, quote, callout, code, image, divider, table, button) with inline toolbar (bold, italic, code, strikethrough, link)
- **Dock toolbar**: Undo/redo (Cmd+Z/Shift+Z), save, badges/frames toggles, viewport simulator (desktop/tablet/mobile), theme toggle, section navigator, add block menu (Radix `DropdownMenu`, never hover-only), media library, revisions, settings, CRM Studio link
- **Media library**: `CRMMediaLibraryModal` (reused from CRM composer) for Supabase Storage `media` bucket pick/upload
- **Revisions**: `getContentRevisions` / `restoreContentRevision` with `ConfirmAction`
- **Settings modal**: Edit title, slug, status (publish/draft), featured image
- **Backend health**: Probes DB, Storage, Edge Functions (`getCRMEdgeFunctionHealth`)
- **CRM Panel**: `CRMPanel` (see below)

**Invariants:**
- Header button is icon-only master switch; per-section controls live on section pills + drawer `EditorialDrawerRow`
- All modals follow the reader's palette (`bg-surface-card`, `text-foreground`, etc.); dock/pills/frames stay dark chrome (`bg-secondary`)
- Add Block menu is a Radix `DropdownMenu` (click-to-open, keyboard accessible), never hover-only
- Hidden frames recover via per-block frame switch in dock block bar

### CRM Panel in Visual Editor (`src/components/visual-edit/CRMPanel.tsx`)

A `Dialog` opened from the overlay dock (`Constituents` button, `UsersRound` icon). Reuses existing CRM actions and components.

**Capabilities:**
- **Search constituents**: `getCRMContacts({ query, consent, page, pageSize })`
- **Create/edit contact**: Reuses `CRMContactEditorModal` (optimistic concurrency via `expectedUpdatedAt`)
- **Delete contact**: `deleteCRMContact` behind `ConfirmAction`
- **Consent tri-state**: `setCRMEmailConsent` with `opted_in` / `opted_out` / `unasked`
- **Follow-ups**: Reuses `CRMTaskForm` via `addCRMTask` / `getCRMTasksForContact`
- **Notes** — `crm_activities` timeline (`getCRMContactDetail`), with add (`addCRMNote`), in-place edit (`updateCRMNote`) and `ConfirmAction` delete (`deleteCRMNote`). Existing `notes` column kept.
- **Task mutation** — `setCRMTaskStatus` toggle + edit (`updateCRMTask`) + `ConfirmAction` delete (`deleteCRMTask`)
- **Consent** — derived from `crm-filters.ts` (`ConsentFilter`, `consentLabel`, `splitActiveValues`); local `consentFromDoNotEmail` removed
- **Segments** — read-only chips + `/admin/crm/segments` link (using overlay `<a>` precedent); stray `{}` JSX artifact removed; `generateMetadata` fixed to use `pageMetadata`
- Tests: `src/components/visual-edit/__tests__/CRMPanel.test.tsx` scaffolded per `VisualEditOverlay.test.tsx` convention (`createRoot`, hoisted mocks, `ConfirmAction` stub)

**All mutations through existing server actions** (`src/lib/actions/crm.ts`). No email sending from overlay — send paths are E2E-refused and dispatch live Edge Functions.

### `content_media` Table (`supabase/migrations/20261011000000_content_media_hardening.sql`)

Tracks per-page media items for the visual editor.

- Columns: `id`, `content_id`, `name`, `path`, `url`, `mime_type`, `size`, `width`, `height`, `alt_text`, `caption`, `folder`, `sort_order`, `created_at`, `updated_at`
- RLS: Public read only for published parent content; Admin full manage
- Actions: `getContentMedia`, `createContentMediaRow`, `updateContentMediaRow`, `deleteContentMediaRow`, `uploadAndCreateContentMedia` (in `src/lib/actions/content-media.ts`)
- Types: `src/types/content-media.ts` (manual until migration lands + `bun run types:generate`)
- Tests: `src/lib/__tests__/content-media.test.ts` (19 tests, all on the shared
  row-based mock). It used to hand-roll a builder whose `maybeSingle()` answered
  a no-match read with an *error* — the inverse of PostgREST's
  `{ data: null, error: null }` — so `assertContentPublished`'s error-only guard
  passed every green test while drafts sailed through in production. The guard
  now also refuses `data === null`, and the suite is converted to
  `createMockAdminClient`.

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
- Error telemetry: `error_reports` table (anon insert-only RLS) + rate-limited `/api/report-error` wired into `error.tsx` / `global-error.tsx`. Both boundaries now also file to Sentry (`indivisiblefairoaks-web` project) via `Sentry.captureException` — dual reporting, neither channel replaces the other; the SDK stays disabled wherever no DSN is set.
- Full-text search: weighted `tsvector` generated columns + GIN indexes + ranked RPCs (`search_products`, `search_content`); `/search` uses FTS with ILIKE fallback.
- A11y regression gate: `@axe-core/playwright` over 12 public routes; serious/critical violations fail CI. `/admin` is excluded — the auth-gated surfaces have no seeded session, so the editor and the CRM have no automated a11y coverage at all.
- Contrast remediation: `--primary-ink` token for lime-on-light text; lime-bg CTAs use dark text; raw lime reserved for dark non-text accents.
- Bundle hygiene: removed dead `mime-types`; React Query devtools dev-only gated.
- Cart crash fix: `env.ts` was spreading `process.env` (empty client stub → ZodError). Public vars now use dotted property access (inlined by bundler); spreads are server-only.
- Contact email delivery: `notify-contact` Edge Function invoked directly from the server action; atomic `email_sent_at` claim prevents duplicate sends; global 20/10-min volume cap resists anon floods; opt-in sender copy locked to the submitter's own address.
- Daily compatibility workflow: nightly CI with frozen install, lint/types/unit/build/e2e, live health probes, advisory AI diff review (never gates CI).
- RLS role-repair: `scripts/rls-role-repair.mjs` — the recreate-and-rebind playbook for orphaned policy→role OID references. It is a script rather than a migration because it responds to a re-provisioning event, not to a schema change.

</details>

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
