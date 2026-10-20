# CI/CD ownership: what Vercel does, what we do

> **Status**: implemented, except branch protection (see §6).
>
> Companion to [`branch-hardening-plan.md`](./branch-hardening-plan.md), which
> covers the CRM/MFA hardening. This document is the delivery boundary.

---

## The line

> **Vercel owns compiling and shipping the Next.js app. We own deciding whether a
> commit may merge, plus everything that is not the app — schema, edge
> functions, secrets, fleet health.**

Verified: Vercel runs only `next build` (no `prebuild`, no lint step in
`package.json`), so lint and tests are irreducibly ours.

## Why this needed saying

`ci.yml`'s `build` job carried **three** roles at once, which is where the
tangling came from:

| Role | Whose | Where |
|---|---|---|
| The shipped artifact | **Vercel's** | git integration, `Vercel` commit status |
| A merge gate | nobody's — it duplicated Vercel | `needs: [lint, test]`, gated nothing (no branch protection) |
| E2E's test fixture | **ours, necessarily** | `upload next-build` → `e2e` `download-artifact` |

Separating by **purpose** rather than by tool dissolves it. Same commands,
different jobs.

---

## 1. The health check, rebuilt

Replaced `health-probe` (`ci.yml:310-359`) with `vercel-deploy`.

**Before:** slept a fixed 90 s, then curled a *guessed* host —
`vars.NEXT_PUBLIC_SITE_URL` with a hardcoded `test.indivisiblefairoaks.org`
fallback and an entire branch detecting that the apex 302s to Google Sites.

Four defects, all consequences of guessing:

1. the 90 s was a guess at build duration — slow builds went red, fast ones
   wasted 90 s;
2. the host was a guess, hence the fallback and the redirect branch;
3. a failure carried no attribution, so a slow Vercel build read as *our* CI
   failing;
4. it could not say which build it was probing.

**Now**, two stages:

- **Stage 1** — `GET /v7/deployments?projectId=…&sha=<this commit>`; poll
  `state` until terminal. On failure, print Vercel's own `errorCode` /
  `errorMessage`, then the raw build log, then `inspectorUrl`.
- **Stage 2** — `/api/health` on the `url` Vercel returned. 503 is a warning,
  not a failure: "deployed, database unreachable" is the useful distinction.

**Stage 2 is retained deliberately and is not substitutable.**
`src/app/api/health/route.ts` fetches `products?select=id&limit=1` from
Supabase. That is a live app→database check. **No build log can replace it** —
`READY` means the code compiled, not that the site works.

**Runtime logs are deliberately not read.** Nobody requests the app after a
deploy, so there are no runtime invocations to inspect. Logs are diagnostic
*after* something exercises the app — a debugging aid, not a gate.

### Exit codes, each failure mode distinguishable

| Exit | Meaning |
|---|---|
| 0 | `READY` + health 200 (503 → warning) |
| 1 | `ERROR`/`CANCELED`/`BLOCKED`/`DELETED` + Vercel's own words |
| 1 | no deployment for this SHA within budget |
| 1 | Vercel API unreachable — *our probe broke, not the deploy* |
| 1 | `READY` but never serves — the genuine deploy failure |

That last distinction was impossible before.

### No Vercel CLI

REST only, per `scripts/secrets-audit.mjs`: *"the CLI aborts on the runner… it
needs `vercel link` state that must not exist on a runner."* The Vercel CLI is
not installed on the fleet at all any more — it used to arrive via
`npm install -g vercel`, which was the last npm invocation in CI and the last
reason the runner host needed Node. The CLI's bin is a `#!/usr/bin/env node`
script, so it could not have run here even if it were installed.
`VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_ORG_ID` are already declared
(`scripts/ci-env.mjs:55-64`).

New shared client: **`scripts/vercel-api.mjs`**, so every Vercel read in the
repository shares one explanation of why the CLI is not an option.

> Endpoint shapes verified against Vercel's `list-deployments` reference rather
> than from recall — which mattered: the working assumption was `/v6` and
> `meta-githubCommitSha`; it is `/v7` and `sha`. `errorCode`/`errorMessage` ride
> on the deployment object, which is a better error source than fetching build
> events.

---

## 2. Pre-merge migration gate — `schema-check`

**`supabase.yml`'s `migrate` cannot be a required check.** It triggers on push
to `main` **with a `supabase/**` path filter**, so on a pull request it does not
run at all. A required check that never reports blocks every PR that does not
touch that path — enabling it would wedge the repository.

**And `deploy`/`migrate` running in parallel is deliberate**, not an oversight
(`supabase.yml:203-206`): *"function delivery must be verified even when
migration push is blocked… Each job reports its own signal."* Not changed.

So the gate is a new job, **`schema-check`** in `ci.yml`:

- runs on **every** pull request, **no path filter** — the only property a
  required check needs;
- **read-only**: compares repository migration filenames against
  `supabase_migrations.schema_migrations` on the hosted project, over the
  Management API that `scripts/apply-migrations.mjs` already proves works on
  this fleet. No CLI, no database connection, no writes;
- **no `bun install`** — two stdlib imports. Installing the whole tree would
  make this the slowest gate on the fleet, the opposite of what a pre-merge
  check should cost.

Catches: an applied version whose file changed or vanished; a new migration
numbered *below* the highest applied version (non-monotonic ordering, which
`db push` reports as an opaque version error); duplicate versions; malformed
filenames; empty files.

### What it does not catch — stated in the script header too

- **SQL that is wrong.** Nothing executes a statement.
- **The app/schema race.** App and migrations ship in one commit, so no CI check
  can separate "app deployed, schema behind". That remains merge-order
  discipline (`branch-hardening-plan.md` §0.7).

A green result means "history is coherent", not "this migration is safe".

---

## 3. `build` is a fixture, not a gate

`ci.yml`'s `build` header now says in capitals: **do not add this to branch
protection.** Vercel builds the same tree on far more compute and a compile
failure there already blocks the deploy. This job exists so `e2e` has an
artifact, and it is the most memory-hungry job in the pipeline — the one the
container's 1024 MiB ceiling kills first. On the critical path of every PR it
would be the least reliable job there.

**It is not redundant with Vercel's build.** E2E compiles with the e2e flags that
make sending impossible (`isE2EMode()` requires `NEXT_E2E_BUILD` **and**
`CONTACT_SUBMISSION_TEST_MODE`). A Vercel preview is production-mode, so
pointing E2E at one would send real broadcasts and real email to real
constituents. `AGENTS.md` already documents that hazard.

---

## 4. Runner Health alerting

Self-hosted-only is repo policy (`runner-health.yml:28`, `walle-refresh.yml:17`),
and `:31` already treats "queued" as the signal. Both constraints were
respected — the fix is **reach**, not relocation.

A red workflow is not an alert. Nobody opens the Actions tab to confirm a
30-minute cron is still red, which is what happened on 2026-10-05: the container
went offline, the next scheduled run queued behind it, and nothing said so until
a CI run was expected and did not arrive.

Added two steps to `check-runners`, gated on `api_ok == 'true'` so a failed read
never masquerades as an outage:

- **raise/update** — one long-lived issue, commented on per 30-minute tick
  rather than opened fresh, so a night-long outage is a readable timeline and
  not dozens of duplicates;
- **resolve** — closes it when every runner reports `online`.

Needs `issues: write`, scoped to that workflow.

### Residual limitation — deliberate, and not papered over

This fires only when the workflow **runs**. If the offline runner is the one
that would execute the job, the job queues and no issue is opened. That case is
**unobservable from inside this repository** — the self-hosted-only policy rules
out the independent watcher that would catch it. Closing it needs an external
uptime monitor against the runner host, not a workflow change. This narrows the
window; it does not close it.

---

## 5. Vestigial `mainDeploy` trigger removed

`branches: [main, mainDeploy]` appeared in `ci.yml` (push **and** pull_request)
and `supabase.yml`. No such remote branch exists, so it could never match — a
trigger that silently did nothing while implying a second delivery path.

---

## 6. Not done: branch protection

`main` is **not protected** (verified: `Branch not protected`). Nothing gates
merges today, which is why a chronically-red pipeline survived weeks.

Enabling it last is an ordering constraint, not a preference: protection must
not go on before the gates it depends on are green, or it blocks your own
merges.

### When the fleet is healthy, enable with exactly:

- `Lint & Types` (`ci.yml` → `lint`)
- `Tests & Coverage` (`ci.yml` → `test`)
- `Migration History` (`ci.yml` → `schema-check`)

**Not** `Next.js Build` — see §3.

---

## 7. What we must not do

- Run `next build` to mirror or pre-validate Vercel's build.
- Poll or wait for Vercel's deploy from a job that gates anything.
- Deploy via the Vercel CLI. Removed once already (`ci.yml:316` records why:
  duplicate previews, doubled upload consumption, free-tier rate limiting).
- Put e2e or test flags in any Vercel environment.
- Gate merges on Vercel commit statuses — not ours, and Vercel builds previews
  for forks too.

---

## 8. Resulting shape

```
PR          →  ci.yml         [ours]  lint · typecheck · unit+coverage     ← REQUIRED →  schema-check                                                       ← REQUIRED →  build · e2e                             ← fixture, not a gate

merge main  →  Vercel         [theirs] compile + deploy                   ← untouched
           →  supabase.yml   [ours]  edge fns · migrate · verify

schedule    →  ops [ours]  secret-audit · runner-health (+issue) · walle  ← self-hosted, non-gating
```

---

## 9. Known gaps

1. **The app/schema race** is unaddressed by design — merge-order discipline
   until it actually bites. Closing it properly means applying migrations on the
   PR, which lets unreviewed schema reach production before merge. That is a
   policy change and was not made.
2. **Runner outages that take the watching runner with them** are still
   invisible from inside the repo (§4). Needs an external uptime monitor.
3. **Neither runner was healthy while this was written**
   (`personal-organicnz` fails `_PipelineMapping` permissions;
   `indivisiblefairoaks-runner-1` offline), so none of it has run in CI yet.
   Locally: `tsc` clean, 1294 tests pass, coverage exit 0, all workflows parse,
   `check-migrations.mjs` exercised against a seeded bad directory.