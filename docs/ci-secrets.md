# GitHub Actions Configuration

Everything the workflows expect to find in the repository's
**Settings → Secrets and variables → Actions** store, and why each value lives
where it does.

**The contract is machine-checkable.** `scripts/ci-env.mjs` is the source of
truth; `scripts/check-ci-env.mjs` diffs it against what the workflow files
actually reference and runs in the pre-commit gate. Do not edit the inventory
without editing the workflows, or vice versa.

```bash
bun scripts/check-ci-env.mjs          # verify
bun scripts/check-ci-env.mjs --list   # print this page's content
```

---

## Variables (not secrets)

**Settings → Secrets and variables → Actions → Variables → New repository variable**

| Name | Example | Used by |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://test.indivisiblefairoaks.org` | `ci.yml` (build + health probe) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mojsubkqjdruhpxbzgme.supabase.co` | `ci.yml`, `supabase.yml`, `walle-refresh.yml` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | `ci.yml`, `supabase.yml` |
| `SUPABASE_PROJECT_REF` | `mojsubkqjdruhpxbzgme` | `supabase.yml` |

### Why these are variables and not secrets

`NEXT_PUBLIC_*` is inlined by Next.js into the client bundle. Anyone can read
your Supabase publishable key and your site URL out of the shipped JavaScript —
they are public by construction, and treating them as credentials only obscures
which values actually need protecting.

It is also a functional bug, not just untidy. `ci.yml` triggers on
`pull_request`, and **GitHub does not expose repository secrets to
`pull_request` runs from forks**. With these stored as secrets, any fork PR
received empty values, and because `src/lib/env.ts` supplies a `.default()` for
each one, the build did not fail — it silently succeeded against placeholder
credentials. Green CI that proved nothing. Repository *variables* are available
to fork PRs, so the build is now deterministic in every case.

### This drifted, and nothing local caught it (fixed 2026-10-03)

On 2026-10-02 the three `NEXT_PUBLIC_*` values were **secrets** in the live
repository while `ci.yml` read them as `vars.*`. Every job that needed them got
empty strings, and the symptom appeared in the least obvious place possible — not
in the build, which `env.ts`'s `.default()` absorbed, but in `vitest`, which
validates the same schema and threw a `ZodError` on three `invalid_format`
issues. The run failed as "Tests & Coverage" while the real fault was
configuration. It is now fixed by creating the three variables; the redundant
secrets of the same names remain and can be deleted.

Two things about that worth keeping:

- **The offline checker cannot see this class of fault.** `check-ci-env.mjs`
  proves `scripts/ci-env.mjs` agrees with the workflow files. Every file was
  correct the whole time; only the dashboard was wrong. The live reconciliation
  (`bun run secrets:audit`) is the thing that catches it, and it was already
  reporting `public-in-secret-store` as CRITICAL for exactly these three names.
- **A `ZodError` naming three env vars is a configuration failure wearing a test
  failure's clothes.** Read the paths in the error before blaming the suite.

## Secrets

**Settings → Secrets and variables → Actions → Secrets → New repository secret**

| Name | Scope | Used by |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Account PAT | `supabase.yml` — edge function deploys, migration apply |
| `SUPABASE_DB_PASSWORD` | Database role password | `supabase.yml` — advisory-lock migration path |
| `SUPABASE_POOLER_URL` | Supavisor connection string | `supabase.yml` — pooled migration path |
| `SUPABASE_SECRET_KEY` | Service-role key (**bypasses RLS**) | `walle-refresh.yml` |
| `RUNNERS_TOKEN` | Fine-grained PAT | `runner-health.yml` (optional — falls back to `GITHUB_TOKEN`) |

### The one that will hurt you

`SUPABASE_SECRET_KEY` grants full bypass of RLS on the entire database. It is
scoped to a single scheduled workflow that refreshes a stored procedure. If it
leaks, the entire row-level security model is decorative. Treat a rotation as
urgent, not optional.

---

## Least privilege

Every workflow declares an explicit top-level `permissions:` block. The two that
hold credentials (`walle-refresh.yml`, `runner-health.yml`) previously had none
and inherited the repository default, which may grant write.

```yaml
permissions:
  contents: read
```

`check-ci-env.mjs` fails the commit if a credentialed workflow loses this.

## Known non-secret

`SUPABASE_PROJECT_REF` is the public project identifier and is safe to read. It
was previously a YAML literal inside `supabase.yml`, which meant changing it
required a code review; it now lives with the rest of the Supabase identity
values.

---

## What is deliberately absent

- **No Stripe, Resend, Vercel or Cloudflare values.** Nothing in CI touches
  them. Stripe/Resend live in the Vercel environment; Cloudflare is DNS state.
  Duplicating them into the Actions store would create a second source of truth
  that can silently drift from the one that actually serves requests.
- **No `NEXT_E2E_BUILD`, `CONTACT_*` or rate-limit tuning.** These are set inline
  in the e2e job or in `playwright.config.ts`; they are test scaffolding, not
  environment.
- **No `VERCEL_TOKEN`.** The CLI deploy job was removed (see the comment in
  `ci.yml`); production ships by git push and the health probe verifies it.

## Not yet done

Actions are pinned to **major version tags** (`actions/checkout@v4`), which are
mutable. SHA pinning with a trailing version comment is the stronger posture:

```yaml
uses: actions/checkout@<sha> # v4
```

This was left alone deliberately: it needs verified SHAs from the upstream
repositories, and a wrong SHA fails the pipeline at checkout. It is a mechanical
follow-up, not a blocker.
