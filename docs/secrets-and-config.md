# Secrets & Configuration — all four stores

Every credential and piece of runtime configuration in this project lives in one
of **four** places. They are independent, they drift independently, and until now
only one of them was documented.

| # | Store | What lives there | Declared in | Enforced by |
|---|---|---|---|---|
| 1 | **Vercel** environment variables | The Next.js app's runtime config — the store that actually serves requests | `scripts/vercel-env.mjs` | `scripts/check-vercel-env.mjs` (pre-commit) + `secrets-audit.mjs` (live) |
| 2 | **Supabase Edge Function** secrets | Values read by Deno functions. `supabase functions deploy` ships code **only** | `supabase/functions/secrets.manifest.mjs` | `scripts/check-edge-secrets.mjs` (pre-commit) + `secrets-audit.mjs` (live) |
| 3 | **GitHub Actions** secrets + variables | CI-only credentials and the public `NEXT_PUBLIC_*` build env | `scripts/ci-env.mjs` | `scripts/check-ci-env.mjs` (pre-commit) + `secrets-audit.mjs` (live) |
| 4 | **Supabase Vault** | *Unused* | — | — |
| — | `.env.local` | Local dev only. Template is `.env.example` | `.env.example` | `env-integrity` hook (pre-existing) |

Plus one cross-cutting file that none of the stores can express on their own:

| File | What it holds | Enforced by |
|---|---|---|
| `scripts/secrets-registry.mjs` | **Owner, blast radius and expected store for every credential.** The one question a name list cannot answer | `src/lib/__tests__/secrets-registry.test.ts` + `secrets-audit.mjs` |

Print any inventory:

```bash
bun scripts/check-vercel-env.mjs  --list
bun scripts/check-edge-secrets.mjs --list
bun scripts/check-ci-env.mjs       --list
bun run secrets:audit              # live reconciliation of all four stores
```

---

## Why the reconciler exists: the gates were all offline

Every checker above runs in pre-commit, and every one of them reads **source and
YAML only**. That makes each of them good at one narrow question — *does the
declared manifest agree with what the code reads?* — and structurally incapable of
answering the one that actually bites: *is the value there, in the right store,
classified correctly, and owned by someone?*

This is not a hypothetical gap. A live audit of all four stores on **2026-09-27**
found production drift in every category the offline gates claim to cover, and not
one of them could see it:

| Finding | Which gate should have caught it | Why it could not |
|---|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` unset in the hosted edge project — checkout and order fulfillment return **503 in production** | the assert step in `supabase.yml` | the step existed but was **uncommitted**, so it had never run |
| All three `NEXT_PUBLIC_*` values held as GitHub **secrets** — withheld from fork `pull_request` runs, so a fork PR builds against empty config | `check-ci-env.mjs` rule 3 | rule 3 only parses workflow YAML. It cannot see the repository's store |
| `SUPABASE_PROJECT_REF` declared `required: true`; the repository had **zero** variables set | `check-ci-env.mjs` rule 1 | same — YAML only |
| 12 secrets in the edge project that no manifest declares and no function reads, including **`GITHUB_TOKEN`** | `check-edge-secrets.mjs` | source only. It cannot see the hosted project |
| `VERCEL_TOKEN` held in the repository, referenced by **no workflow** | `check-ci-env.mjs` rule 2 | the gate checks manifest-vs-YAML, never manifest-vs-store |
| The Vercel store's actual contents | *nothing* | `vercel env ls` needs a token with project env-read scope |

`bun run secrets:audit` closes that gap. It is **read-only** — there is no mutation
path in the tool, because a linter that can delete a live credential is a
liability. Where reality is wrong it prints the exact command that would fix it and
exits non-zero.

### The one property that matters most: unread ≠ empty

Every probe returns a **status**, and `unreachable` is reported as its own finding
class. It is never folded into an empty list.

This is not theoretical caution. During development, with a token that cannot read
the project:

```
$ vercel env ls
> No Environment Variables found for organicnz2/indivisiblefairoaks   # exit 0

$ vercel whoami
Error: Not authorized                                                  # exit 1
```

`vercel env ls` **exits 0 and confidently reports an empty project** while the same
token is unauthorized. A reconciler that trusted the listing would have demanded
that eleven correctly-configured production variables be created — confidently
wrong, and actively inviting an operator to break a working system. The tool
therefore runs an **authentication preflight before any enumeration** (`gh auth
status`, `supabase projects list`, `vercel whoami`), and every store behind a
failing preflight is reported UNKNOWN.

This is the same class of bug as the one the `supabase.yml` guard already documents:
`supabase secrets list -o json` emits compact JSON, so a `grep '"name": "X"'`
silently matched nothing and reported every secret missing. A failed read must
never be reported as a clean result.

### Baseline: a ratchet, not a wall of red

The project is not clean on arrival — the audit found the drift it now reports. A
gate that is red from its first run is a gate people learn to ignore, which is how
the original missing Stripe keys stayed missing. So findings are fingerprinted
(`code:store:name`, insensitive to rewording) and compared against a committed
baseline. Accepted findings print as **KNOWN**, not as hidden; only a **new** finding
fails. The baseline can only shrink, and every fix removes a line from it.

```bash
bun run secrets:audit              # reconcile; fails only on new drift
bun run secrets:baseline           # re-accept the current state
```

`.github/workflows/secret-audit.yml` runs this daily at 04:37 UTC (deliberately not
`:00`, when every scheduled workflow in every repository fires at once) and on demand.

---

## The three rules that decide which store a value belongs in

**1. `NEXT_PUBLIC_*` is public by construction.** Next inlines it into the client
bundle at build time. The repository may be private; the *built JavaScript* is
served to everyone. These belong in Vercel **Plain** and in GitHub **Variables**,
never in either Secrets store. Two real bugs came from getting this wrong — both
`ci.yml` variants, where a fork PR built against placeholder credentials.

**2. Vault is the wrong tool here.** It is available and unused, and that is
correct: every consumer is an edge function or a Next server module that needs the
value at cold start, without a database round trip. Vault earns its place when a
**Postgres function or trigger** needs a secret — code that can only read
environment variables can never use it. Revisit if you add such a trigger.

**3. Blast radius decides urgency, not importance to us.** `secrets-registry.mjs`
classifies every credential as `public`, `server`, `privileged` or `unused`, and
the ordering is about *what possession buys an attacker* rather than what the
business would miss. `SUPABASE_SECRET_KEY` is `privileged` because possession of it
is possession of the database, not of a feature. This is what makes an orphan like
`GITHUB_TOKEN` visible: every name-based check classified it as harmless, because
no code reads it — which is exactly why it is pure liability.

---

## 1. Vercel

The store that actually matters — a mistake here is a production incident, not a
red pipeline. Also the hardest to audit from a checkout, because
`vercel env ls` needs the CLI authenticated against the project.

### Variables (Project → Settings → Environment Variables → **Plain**)

| Name | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | yes | **The apex-cutover variable.** Drives metadataBase, canonicals, `og:url`, sitemap, robots. A non-apex value makes the build `noindex, nofollow` site-wide. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Anon-role. Safe as a var. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | yes | Read by `StripeExpressCheckout`, which the cart renders. Was missing from `.env.example` — local dev could not mount it and nothing flagged it. |
| `RESEND_FROM_EMAIL` | yes | Must have a published Resend DKIM record or DMARC fails. |
| `ADMIN_ORDER_EMAIL` | no | Defaults in code. |
| `CONTACT_RATE_LIMIT_MAX` | no | Defaults in code. |

### Secrets (→ **Secret**)

| Name | Notes |
|---|---|
| `SUPABASE_SECRET_KEY` | **Bypasses RLS on the entire database.** The most damaging value here; a leak makes the row-level security model decorative. |
| `STRIPE_SECRET_KEY` | Checkout sessions and refunds. |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe event signatures. Absent → forged events are accepted. |
| `RESEND_API_KEY` | Contact form and order confirmation. |

### Must **not** be set in Vercel

`NEXT_E2E_BUILD`, `CONTACT_SUBMISSION_TEST_MODE`, `CONTACT_FUNCTION_URL`,
`NEXT_SKIP_ENV_VALIDATION` are CI-only test switches. The checker fails if one
appears in `.env.example`, because that file is what people copy.

### Verify what is actually set

The checker validates the *code* side offline. To confirm the live project
matches, run this with the CLI authenticated:

```bash
vercel env ls production
```

Compare against `bun scripts/check-vercel-env.mjs --list`. That comparison is
manual by necessity — it needs network and project auth.

---

## 2. Supabase Edge Function secrets

`supabase functions deploy` ships **code only**. `supabase.yml` never runs
`supabase secrets set`, so these are set by hand in the dashboard and CI could
not see them. The `verify` job's probes all fail on a validation or method check
that runs *before* any secret is read — so a missing `STRIPE_SECRET_KEY` used to
deploy green and break silently for users.

Required set: `APP_URL`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`.

> **Correction (2026-09-27).** This document previously stated that the
> platform-injected values are "absent from `secrets list` by design and must not
> be required", and the `supabase.yml` guard repeated it as justification for
> excluding them. A live read contradicts it: `supabase secrets list` **does**
> return `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, along
> with the newer plural `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` /
> `SUPABASE_JWKS` forms. A guard reasoning about a store whose contents it has
> never observed is a guard reasoning about a fiction. The exclusion is harmless
> (requiring a platform value you cannot set would break the pipeline), but the
> *stated reason* was wrong, and the three plural forms were undocumented
> entirely. All are now declared in `secrets.manifest.mjs`.

**At audit time, three of the four required values were unset** — `APP_URL`,
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. The edge code is **fail-closed**
about this, which was verified by reading the handler rather than assumed:
`webhook/index.ts` calls `assertRuntimeConfig()` *before* signature verification and
returns `503 Webhook is not configured: …`. So no forged event is accepted — but no
real one is either, and checkout cannot complete. Commerce was non-functional.

**`APP_URL` currently defaults to the apex, which 302s to the Google Site** — so
WALL-E citations and Stripe return URLs point somewhere that does not serve the
app. Set it to the staging host now, the apex at cutover.

**`WALLE_REFRESH_TOKEN`** is an alternate auth path on a service-role-key function
that nothing in the repo uses. If it is set in the project, it is a second way
in. It was **unset** at audit time, and the registry now encodes that as
`mustBeUnset: true` with `stores: []` — so the audit *enforces* the absence rather
than leaving it as a comment nobody re-reads.

Full detail: [`../supabase/functions/env.example.md`](../supabase/functions/env.example.md).

---

## 3. GitHub Actions

See [`ci-secrets.md`](./ci-secrets.md). Five real secrets, four variables. The
`NEXT_PUBLIC_*` build env is variables rather than secrets precisely so fork
`pull_request` runs receive it.

---

## The two commerce copies

Not a secret store, but the same class of hazard and the worst instance of it.
`src/config/commerce.ts` and `supabase/functions/_shared/commerce.ts` are
deliberate duplicates — the edge runtime cannot import from `src/`. They had
already diverged: the app and its JSON-LD advertised `USD` while the edge
`checkout` function created real Stripe sessions in `nzd` with a New Zealand
tariff and `allowed_countries: ['NZ']`.

`src/lib/__tests__/commerce-parity.test.ts` asserts they agree, so a second
duplicate cannot drift unnoticed.

---

## Outstanding remediation (from the 2026-09-27 live audit)

Accepted in `scripts/secrets-baseline.json`, ordered by blast radius.

### Done: the Vercel project was empty

The Vercel project had **zero** environment variables. Every required value the
app reads was absent, so the one store that actually serves requests was entirely
unconfigured. Eight of the nine required values already existed in `.env.local`,
so `scripts/sync-vercel-env.mjs` (`bun run vercel:env:sync`) wrote them in one
pass — dry run first, values never printed, `--no-sensitive` on the public half.
The audit's Vercel findings went from 9 to 0.

Two bugs surfaced by *running* the writes rather than reading the docs, both of
which would have made the tool lie:

- `vercel env add NAME production --value X --yes` stores the value as
  **Sensitive / Secret** by default — so a script pushing `NEXT_PUBLIC_*` values
  would have recreated the exact public-in-secret-store bug the audit exists to
  catch. `--no-sensitive` is required and is now explicit.
- The CLI blocks on an open stdin and hangs silently. `spawn` with
  `stdio: ['ignore', …]` replaces `execFile` for writes.

`scripts/sync-vercel-env.mjs` is the deliberate counterpart to the read-only
audit: the audit decides what *should* be true, this applies what it can *source*.

### Blocked: two stores cannot be read out, by platform design

"Fetch the remaining secrets from Supabase Vault and the edge function secrets" is
not implementable, and it is worth being exact about why rather than working around
it:

| Store | Readable out? | Evidence |
|---|---|---|
| `.env.local` | yes | — |
| Supabase Vault | in principle, via `psql` | **Empty**, and no `SUPABASE_DB_PASSWORD` or Management API token is held locally, so it can be neither read nor seeded from here |
| Supabase edge secrets | **no** | `supabase secrets` offers exactly `list`, `set`, `unset`. There is no `get`. `secrets list` returns sha256 **digests**, never values |
| GitHub Actions secrets | **no** | `gh secret list` returns names and timestamps only |

So `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` exist in **no** readable store.
They are not misfiled — they were never written anywhere. They are obtainable only
from the Stripe dashboard, and `sync-vercel-env.mjs` names that source explicitly
rather than reporting an ambiguous failure.

### Act first — commerce is still down

| # | Action | Why |
|---|---|---|
| 1 | `supabase secrets set STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=… APP_URL=…` | Three of four required edge secrets were unset. `checkout` and `webhook` return **503**, so no order can be taken or fulfilled. Fail-closed, so not a security hole — an outage. |
| 2 | Move the three `NEXT_PUBLIC_*` values from GitHub **secrets** to **variables** (`gh variable set …`, then `gh secret delete …`) | They are inlined into the client bundle, so they are public by construction. As secrets they are withheld from fork `pull_request` runs, so a fork PR builds against empty config and `env.ts`'s `.default()` absorbs it. This is the documented `ci.yml` failure, live right now. |
| 3 | `gh variable set SUPABASE_PROJECT_REF` | Declared `required: true`; the repository has **zero** variables. `supabase.yml` references it. |
| 4 | Rotate, then `supabase secrets unset GITHUB_TOKEN` | A **GitHub credential** in the edge secret store, read by nothing, on a project where `notify-contact`, `search`, `webhook` and `health` are all deployed `--no-verify-jwt` and therefore publicly callable. |

### Then — orphaned credentials

`CRON_SECRET`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`,
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_DNS_ZONE_TOKEN`, `CLOUDFLARE_ZONE_ID`,
`SUPABASE_DB_URL`, `LLM_PROVIDER`, `LLM_DEFAULT_PROVIDER`, `LLM_FALLBACK_PROVIDER`,
`OLLAMA_HOST`, `OLLAMA_MODEL` — set in a store, declared in no manifest, read by no
code. `SUPABASE_DB_URL` (a full Postgres connection string) and
`CLOUDFLARE_DNS_ZONE_TOKEN` (can repoint the apex and the mail records) are the two
worth rotating rather than merely deleting.

### And — the blind spot

`GH_AUDIT_TOKEN` (fine-grained PAT, scoped to `Actions → Secrets: read`) is
**optional**, and without it the two GitHub stores report UNKNOWN on every run.
That is a correct outcome rather than a pass, but it means the audit is half blind
— and half-blind is how the drift above went unnoticed. Add it to close the loop.

`SUPABASE_POOLER_URL` is also unset; migrations have been silently falling back to
the Management API because the direct DB host is IPv6-only and the runner has no
route. The fallback works, so the absence is a single point of failure that looks
like a healthy pipeline.

### 2026-10-04 — Sentry activation pending (code complete, stores not yet set)

The `indivisiblefairoaks-web` (`javascript-nextjs`) project exists in the
`organicnz` Sentry org, `SENTRY_AUTH_TOKEN` is in GitHub Secrets, and the repo
integration is merged: SDK init in all three runtimes, dual reporting from both
error boundaries, CSP allowlist entry, and both manifests declared. What remains
is two Vercel variables — the Vercel CLI is unauthenticated on this machine, so
this is a dashboard step (or `vercel login` first):

- `NEXT_PUBLIC_SENTRY_DSN` as **Plain**, Production + Preview. Value: the DSN at
  `https://organicnz.sentry.io/settings/projects/indivisiblefairoaks-web/keys/`.
  Plain, not Secret — the client SDK ships it in the bundle, and `vercel env
  add` stores Sensitive by default (the `--no-sensitive` lesson from the sync
  script above applies verbatim here).
- `SENTRY_AUTH_TOKEN` as **Secret**, Production + Preview (build-time
  source-map upload only; never inlined).

Until both are set, the daily audit correctly reports them as required-missing.
That red is the system working — Sentry is code-complete but not yet live — not
drift. Do not baseline it away.
