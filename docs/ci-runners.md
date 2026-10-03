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
first time. What it showed is that the heap cap fixes the *typecheck* and nothing
else:

| Symptom | Cause | Status |
|---|---|---|
| `tsc` aborts, `Reached heap limit` | Node's ~448 MB default cap < 598 MB measured peak | **Fixed** by the 768 MB cap — but see below |
| Jobs end `cancelled`, not `failed` | `EPHEMERAL=true` → one job per container; each does a fresh `bun install`, the next container starts before swap recovers, and the broker drops the worker mid-step | **Not fixed** — host too small |
| Every workflow `queued`, nothing starts | `ghrunner` podman network `ghrunner` was absent; every `podman run --network=ghrunner` exited 125 (`network not found`) until the service was restarted | **Fixed** — `systemctl --user restart ghrunner-personal-indivisiblefairoaks.service` |

So `Lint & Types` now clears `biome`, `oxlint` and `bun install` and reaches the
TypeScript step before the worker is cancelled — evidence the heap fix is sized
correctly, but **not a green run**. Build and e2e remain unproven on this host:
they are gated behind `lint` and `test`, so no run has ever reached them.

The load average during a run reaches ~7 on 2 vCPU with 1.9 GB of 2 GB swap in
use. That is the ceiling: the pipeline needs more memory and more cores than this
box has, and no `NODE_OPTIONS` value changes that. **Do not diagnose this from a
cancelled job** — `cancelled` here means the host ran out of room, not that the
code or the workflow is wrong.

So the honest current state is: **CI starts, and cannot finish.** Until the host
is resized, the local gates below are the only ones that reach a verdict — not
because the pipeline is broken, but because the pipeline is too small.

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
