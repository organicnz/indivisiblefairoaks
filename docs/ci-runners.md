# CI runners

> What actually runs this repository's workflows, what stops them, and how to
> tell the difference. Read this before changing a `runs-on:` line.

## The short version

**`runs-on: [self-hosted, linux, X64, …]` is correct. Do not change it.**

This repository **is** served — a runner exists, it is `X64`, and it accepts jobs,
checks out the repository and runs them. That was not true for most of this
repository's life, and the reason it stayed invisible is the part worth keeping.

Two independent things can stop it, and they need different fixes:

- **The `ghrunner` podman network went missing (fixed 2026-10-03).** When it is
  absent, every container start fails with `unable to find network with name or
  ID ghrunner: network not found` and podman exits 125, so the runner service
  fails, systemd hits its restart limit, and GitHub shows the runner
  `offline` while every workflow sits `queued`. The remedy is one command:
  `systemctl --user restart ghrunner-personal-<instance>.service` over SSH. The
  `ARM64` Mac is `online` but cannot satisfy the `X64` selector, so a green
  runner list is not evidence a job can run.
- **The runner host is too small to finish the work even when it is up.** See
  [The host is the ceiling](#the-host-is-the-ceiling). Jobs now start, reach the
  typecheck, and are cancelled when the host runs out of memory and swap.

Check which one you are looking at with the two commands under
[How to check whether CI can actually run](#how-to-check-whether-ci-can-actually-run) —
never from the run list, because a queued job and an unservable selector look
identical there.

## Where the runners come from

Self-hosted runners for this organisation are not hand-registered. They are
provisioned by **`ghrunner`**, a fleet manager that runs as rootless Podman +
Quadlet units on a single x86_64 VPS behind Tailscale. A repository is served when
it has an `instances/<id>.env` declaring its `REPO_URL`; an organisation can also
be served org-wide from `org/*.env`.

This repository's instance is `instances/indivisiblefairoaks.env`, and its
runner registers as **`indivisiblefairoaks-runner-1`** — deliberately *not* the
name `personal-organicnz`, which is the Apple-silicon Mac. The collision matters;
see below.

The fleet ships a coverage auditor that answers the served-or-not question
directly:

```bash
cd ../ghrunner
cargo run -q -p fleet-coverage -- --root .
```

## Why it looked like nothing could ever run

Five separate defects stacked, and each one on its own looked like a healthy
system. This is the record, because the failure mode is what generalises.

1. **A `runs-on` selector that matches nothing does not error.** The job waits
   indefinitely. There is no error to notice.
2. **`concurrency: cancel-in-progress: true` cancels the previous run** as the next
   push lands, so the queue never visibly grows past one entry. The run history
   reads as a calm series of `cancelled` runs.
3. **A merged PR shows a green tick from `Vercel`, `GitGuardian` and `CodeRabbit`**,
   which are separate checks that do run. So a PR looks healthy.

A green tick that means *no job started* is the most dangerous kind of fake
control, because it is indistinguishable from passing. The same rule as
`ChoirAudioPlayer`'s progress bar and the featured image that no public route
rendered.

Once a runner *was* deployed, four more defects hid behind that first one, and
each only became visible after the previous was fixed:

4. **An unrelated empty organisation blocked every runner on the host.**
   `ghrunner`'s deploy refuses to install anything unless it can register in
   *every* declared org, and `RUNNER_ACCESS_TOKEN` had no access to an org with
   zero repositories. One empty org meant no personal runner started, on any
   repository. A shared-fleet gate failing closed is correct; failing closed on
   something irrelevant is not.
5. **Two runners claimed one name.** The VPS runner and the Mac both registered
   as `personal-organicnz` in the same repository, so the broker answered
   `HTTP 409: A session for this runner already exists` — while the runner still
   reported `status=online`, which is why it looked healthy while doing nothing.
   Fixed by declaring `RUNNER_NAME=indivisiblefairoaks-runner-1`.
6. **Checkout died at its first `git` call.** git's dubious-ownership guard
   (CVE-2022-24765) refuses a repository owned by a different uid and reports it
   as `fatal: --local can only be used inside a git repository`. The job
   workspace is owned by uid 1001 and the job's `git` can run as root, so every
   checkout failed with an empty workspace and no fetch.
7. **The runner user had no `HOME` of its own.** The privilege drop switched uid
   without touching the environment, leaving uid 1001 with `HOME=/root`, mode
   0700. That surfaced as `EACCES: permission denied, stat '/root/.gitconfig'`
   *after* (6) was fixed, so it presented as a second, unrelated checkout
   failure.

A fifth fleet-side defect — the installer's prune deleting the Podman network
file on every install, so no runner could start after any deploy — is fixed in
`ghrunner` as well. The pattern across all of them: **each fix exposed the next
defect, and none of them was visible from the run list.** Defects 6 and 7 in
particular would both have been diagnosed as "checkout is broken" from the logs
alone, and neither was checkout.

**A green runner list is not evidence that a job can run**, in either direction.
The only reliable questions are the ones below.

## How to check whether CI can actually run

Do not read the run list. A queued job and an unservable selector look identical
there. Ask:

```bash
# 1. What runners exist, with which labels?
gh api repos/organicnz/indivisiblefairoaks/actions/runners \
  -q '.runners[] | {name, status, busy, labels: [.labels[].name]}'

# 2. Does the fleet intend to serve this repository?
cd ../ghrunner && cargo run -q -p fleet-coverage -- --root .
```

If (1) is empty or the labels do not match, and (2) reports `UNSERVED`, nothing in
this repository will run.

Two more checks worth doing, because both have produced failures here that the run
list summarised as a single red job:

```bash
# 3. Is the fleet's own support unit installed? A missing one is not visible
#    in any run list; it shows up only as a runner that will not start.
ssh <host> systemctl --user is-active ghrunner-network.service

# 4. Is the job failing, or failing to start? These have different fixes.
gh run view <id> --log-failed | tail -40
```

## The host is the ceiling

The runner is a **887 MiB / 2 vCPU** VPS. When it is up, jobs are dispatched and
start, and the typecheck then dies:

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
bunx tsc --noEmit  →  Aborted (core dumped)
```

The abort is Node's *own* default cap, not the machine's: on a host this size V8
gives the old space roughly 448 MB. Measured, `bunx tsc --noEmit` over this
program (~295 files, `skipLibCheck` on) peaks at **~598 MB RSS in ~1.4 s** — so
the default cap is genuinely too small. The instance already declares the
headroom to fix that — `MEMORY=1024M` plus **`MEMORY_SWAP=2048M`** — so the lint
job now caps the heap explicitly:

```yaml
# .github/workflows/ci.yml — the lint job only
env:
  NODE_OPTIONS: --max-old-space-size=768
```

It is scoped to that one job on purpose. A workflow-level `NODE_OPTIONS` would
also raise the ceiling for `bun install`, `vitest` and the Next build, which have
their own memory profiles and share one 887 MB machine.

### Two faults, and they are not the same fault

On 2026-10-03 the runner was brought back and the pipeline was observed for the
first time. Caching bun's dependency cache then moved the failure from "install
never finishes" to "the build is killed", and each step has been measured:

| Symptom | Cause | Status |
|---|---|---|
| Every workflow `queued`, nothing starts | `ghrunner` podman network `ghrunner` was absent; every `podman run --network=ghrunner` exited 125 (`network not found`) until the service was restarted | **Fixed** — `systemctl --user restart ghrunner-personal-indivisiblefairoaks.service` |
| `bun install` never returns; job dies at 20 min | Every ephemeral container refetched the whole tree — ~13 min cold, before any verification ran | **Fixed** by caching `~/.bun/install/cache`: **30 s** warm |
| `tsc` aborts, `Reached heap limit` (exit 134) | Node's ~448 MB default cap < 598 MB measured peak | **Fixed** by the 768 MB cap |
| `bun run build` killed, exit 137 | The cgroup OOM-killer: SIGKILL once RSS passes `MEMORY=1024M`. V8 grows the heap rather than collecting | **Attempted** — build heap capped; never observed to pass |
| Lint passes sometimes, cancelled other times | `tsc` takes 8m28s here against **1.4 s** locally. The host runs at load ~12 on 2 vCPU | **Not fixable here** — shared, undersized host |
| Queue never drains | One runner for all four workflows, five jobs per run, and `cancel-in-progress` only cancels within a single ref — so main and every open PR compete | **Workaround only** — cancel superseded runs by hand |

### What a passing run costs

Measured on the first run to clear lint and test (2026-10-03):

| Step | Lint & Types | Tests & Coverage |
|---|---|---|
| `checkout` | 22 s | 4 s |
| `setup-bun` | 9 s | 11 s |
| `Cache bun dependencies` | 39 s | 1 s |
| `Install dependencies` | **30 s** (hit) | 6m45s (miss — seeds the cache) |
| `biome` + `oxlint` | 3 s | — |
| **`tsc --noEmit`** | **8m28s** | — |
| verification | — | 1m49s |
| **total** | **10m21s** | **10m10s** |

Two numbers carry the argument. The cache took `bun install` from ~13 minutes to
**30 seconds**, which is what made any of this reachable. And `tsc` takes **8m28s
on the runner against 1.4 s on a workstation** — roughly 360× — against a
per-job ceiling of about 20 minutes. Lint clears it with 10m21s to spare when the
host is quiet and loses it when the host is loaded, which is exactly the observed
behaviour: same commit, same configuration, green then cancelled.

That ratio is the whole problem. Nothing in this repository causes a 360× slowdown;
it is swap. The host has 887 MiB of RAM against 2047 MiB of swap, and it is
shared — load average 11.87 on 2 vCPU with 7 MiB free was observed mid-run.

### Why it is contention, and why the results look random

The host is oversubscribed *by design*. `ghrunner` runs on-demand runners under a
`MAX_CONCURRENT_RUNNERS` ceiling, and its capacity gate asks whether the
**concurrent peak** fits rather than the sum of every declared ceiling — here
`2 × 1024 MB = 2048 ≤ 2422 MB` (RAM + swap), which passes. So two runner
containers are meant to be up at once, each capped at 1024 MB, on **887 MiB of
actual RAM**. Six repositories declare instances on this host.

That is the whole explanation for the coin-flip. `tsc` needs ~598 MB RSS by
itself, so it fits when this repository's runner has the machine largely to
itself and does not when a neighbour's container comes up. Both states were
observed on the same commit with the same configuration:

| Host state | Result |
|---|---|
| load 0.73, 590 MB available, this runner alone | `Lint & Types` ✅ 10m21s |
| load 11.87, 7 MB free, a `foodshareclub` runner starting | `Lint & Types` ❌ |
| load 5.90, lint ✅ — then every job cancelled by the next push | — |

Nothing in this repository can fix that. Every lever is outside it:

- **Resize the host.** 887 MiB / 2 vCPU, and per the fleet's own notes a Standard D
  family VPS with **0 vCPU quota** — so it cannot be scaled up in place.
- **Give this repository a dedicated runner**, so a 598 MB typecheck is not
  competing with a neighbour's container for the same 887 MiB.
- **Drop `MAX_CONCURRENT_RUNNERS` to 1.** Trades fleet throughput for the guarantee
  that whatever is running has the machine to itself.

Until one of those happens, expect `Lint & Types` to pass intermittently and
`Tests & Coverage` to pass reliably — it is the lighter job and tolerates sharing.

**Do not merge to `main` while a run you care about is in flight.** The third row
above is self-inflicted: a docs commit landed while the run testing the build cap
was executing, the new push joined the same `ci-refs/heads/main` concurrency
group, and `cancel-in-progress: true` killed all five jobs of the run in flight —
including the one that would have answered the open question.

### Do not read `cancelled` as `failed`

- **`cancelled`** — the ephemeral container hit its ~20-minute wall clock, or the
  cgroup removed the process. The host ran out of room. Nothing is wrong with the
  code.
- **exit 137** — `128+9`, SIGKILL from the OOM-killer. A memory ceiling, not a
  configuration fault.
- **exit 134** — V8 asserting its own heap ceiling. That one *is* configuration,
  and the lint job now fixes it.

These three look identical in a run list and have three different fixes.
`Build` and e2e remain unproven here: the build has never passed, and e2e is
gated behind it, so no run has ever reached the browser suite on this host.

### Draining the queue by hand

`concurrency: cancel-in-progress: true` is scoped to `ci-${{ github.ref }}`, so it
only ever cancels a *previous run on the same ref*. A push to `main` and the
`pull_request` run for every open PR are different refs, so they all queue against
the same single runner and none of them cancel the others. Five runs were observed
queued at once, and the runner worked them oldest-first regardless of which commit
was current.

When that happens, the superseded runs are safe to cancel — they are for branches
already merged, so their verdicts describe code identical to `main`:

```bash
gh run list --limit 10 --json databaseId,status,event,headBranch \
  -q '.[] | "\(.databaseId) \(.status) \(.event) \(.headBranch)"'
gh run cancel <id>            # only for merged branches
```

This buys time; it does not make a run succeed. It is worth knowing precisely
*why* — a `cancelled` job here means the box is too small, and reading it as a
red build sends you looking for a defect that does not exist.

So the honest current state is: **lint and test pass when the host is quiet, and
nothing downstream has ever run.** Until the host is resized, the local gates
below remain the only ones that reach a verdict reliably — not because the
pipeline is broken, but because the pipeline is too small.

## What this means for the delivery gates

The local gates are real, they run on every push, and they are currently the only
ones that finish:

| Gate | Command |
|---|---|
| 30 pre-commit guards | lefthook, on `git commit` |
| documentation claims | `bun scripts/check-doc-claims.mjs` — guards, baseline, spec counts |
| suppression ratchet | pre-push, baseline 12 |
| lint | `bun run lint:check` |
| unit + coverage | `bun run test:coverage` — full suite, per-file thresholds |
| types | `bunx tsc --noEmit` |
| production build | `NEXT_E2E_BUILD=true bun run build` |
| peer deps | `bun scripts/check-peer-deps.mjs --all` |
| e2e | `playwright test --workers=2` — 119 specs |

A merge is only as trustworthy as the last full local run, so run all of them
before merging anything that CI would otherwise have gated.

The unit-test count is deliberately absent from this table. It moved four times in
as many rounds, and the obvious cheap source of truth cannot reproduce it:
`vitest list` enumerates 884 tests while `vitest run` executes 997, the difference
being `it.each` expansion the listing does not perform. A figure nothing checks is
a figure that will be wrong. `scripts/check-doc-claims.mjs` verifies the claims
that *can* be re-derived — guard count, baseline, `lefthook.yml` length, spec
total and both coverage floors — and records why this one is not among them.

## Migrations and Edge Functions are deployed by hand

`supabase.yml` runs on the same fleet, so nothing it does is a substitute for
applying a migration deliberately:

```bash
supabase db push --linked --dry-run     # always first
supabase db push --linked --yes
supabase functions deploy <name> --project-ref mojsubkqjdruhpxbzgme
```

`20260930120000_crm_and_content_safety.sql` and
`20260930140000_broadcast_draft_updated_at.sql` were applied this way on
2026-09-30, and the `crm_broadcasts_test_only_needs_recipient` CHECK was then
verified live by attempting the insert it exists to forbid:

```
23514  new row for relation "crm_broadcasts" violates check constraint
       "crm_broadcasts_test_only_needs_recipient"
```

That is a stronger guarantee than any unit test, and it is the shape of evidence
to aim for when the pipeline cannot run.
