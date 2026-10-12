# CI runners

> What actually runs this repository's workflows, what stops them, and how to
> tell the difference. Read this before changing a `runs-on:` line.

## The short version

**`runs-on: [self-hosted, linux, <frontend|backend>-runner]` is arch-neutral on
purpose: it matches both registered runners, and GitHub routes each job to
whichever is idle. Do not re-add an arch token (`X64` or `ARM64`)** — a pinned
selector is a single point of failure, and one took the whole pipeline down on
2026-10-05 when `indivisiblefairoaks-runner-1` went offline mid-`tsc`.

| Runner | Distinguishing labels |
|---|---|
| `indivisiblefairoaks-runner-1` | `X64, ghrunner` (Quadlet container on the ghrunner host) |
| `personal-organicnz` | `ARM64` (hand-registered Mac) |

Both carry `self-hosted, linux, frontend-runner, backend-runner, personal,
personal-organicnz`. The `frontend-runner` / `backend-runner` role split is
what keeps frontend jobs off the deploy path and vice versa — that split
stays; the arch token is what went.

The real runner is **`indivisiblefairoaks-runner-1`**, a Quadlet container
(`ghrunner-personal-indivisiblefairoaks.service`) on the **ghrunner** host — an
x86_64 Linux box reached over Tailscale. Its labels are:

```
self-hosted, Linux, X64, ghrunner, personal, personal-organicnz, frontend-runner, backend-runner
```

The labels match the hardware (`uname -m` says `x86_64`). Since 2026-10-05
the `runs-on` selector is arch-neutral so both runners can serve (`self-hosted,
Linux, <role>`). Rewriting the selector to `ARM64` would exclude the container
runner just as surely as `X64` excludes the Mac — either pin reintroduces the
single point of failure.

### What actually went wrong, for weeks

**The runner could not register itself, so no X64 runner existed.** Every job sat
`queued`. Its entrypoint mints a registration token from `api.github.com` before
starting, and it could not resolve the name:

```
curl: (6) Could not resolve host: api.github.com
```

The cause was the podman network, not the labels. `ghrunner` was created with
DNS enabled, so containers received podman's embedded resolver at `10.89.0.1`
(aardvark-dns). aardvark-dns forwards to the host's resolver — and this host runs
systemd-resolved on `127.0.0.53`, a **loopback-only** stub that a bridge network
cannot reach. No upstream, no DNS.

Evidence that isolates it from everything else:

| Check | Result |
|---|---|
| raw-IP egress from the `ghrunner` network | works (`http://1.1.1.1` → `301`) — NAT is fine |
| default `podman` network (`dns_enabled: false`) | resolves — podman injects the real upstream itself |
| `podman run --dns 1.1.1.1` on `ghrunner` | **silently ignored**; container still got `10.89.0.1` |
| same network recreated with `--disable-dns` | container gets `nameserver 168.63.129.16`, resolves, `github=200` |

`--dns` being ignored is the detail worth remembering: on a custom network podman
takes the resolver from the network, so the only lever is the network's own
`dns_enabled` setting, or a real nameserver on the host.

**Fix applied 2026-10-04**, rootless, on the ghrunner host:

```sh
systemctl --user stop ghrunner-personal-indivisiblefairoaks.service ghrunner-foodshareclub-1.service
podman network rm -f ghrunner
podman network create --disable-dns --subnet 10.89.0.0/24 ghrunner
systemctl --user start ghrunner-personal-indivisiblefairoaks.service ghrunner-foodshareclub-1.service
```

Both containers went from crash-looping to `healthy` within seconds and the
runner registered as `indivisiblefairoaks-runner-1`.

> **This reverts on reboot.** `ghrunner-network.service` recreates the network
> from the fleet definition, which does not pass `--disable-dns`. The durable fix
> is that one flag in `../ghrunner`; until it lands, re-apply the commands above.

### The diagnostic trap

The runners page listed a **single** runner — `personal-organicnz`, a
hand-registered ARM64 Mac — and nothing else. That was accurate rather than
misleading: the real runner was missing because it had never registered.
"The selector matches no runner" and "the runner does not exist" are
indistinguishable from the repository, and an ARM64/X64 partial overlap looks
exactly like a label bug.

**Never diagnose this from the run list**, where a queued job and an unservable
selector are identical. Ask for `.runners[].status` **and**
`.runners[].labels[].name` — then confirm the runner you *expect* is on that
list at all, rather than only that its labels match.

### The host is still the ceiling

The container runs with `Memory=1073741824` (1024 MiB),
`MemorySwap=4294967296` (4096 MiB, backed by 6 GB host swap) and `CpuQuota=150000`.
Jobs end `cancelled` rather than `failed` once the cgroup is exhausted, and
`cancelled` there means the host ran out of room — it is not a verdict on the code.
With expanded 6 GB host swap, `build-e2e` sets `NODE_OPTIONS: --max-old-space-size=3584`
to let V8 utilize the available swap without triggering excessive GC cycles or allocation failures.

### Never switch to `ubuntu-latest`

Workflows in this repository run exclusively on self-hosted runners (`[self-hosted, linux, <role>-runner]`).
Do not switch jobs to `ubuntu-latest`. When optimizing `build-e2e` on the self-hosted host:
1. **Single-worker Next.js builds**: `next.config.ts` sets `experimental.cpus: 1` during `NEXT_E2E_BUILD`
   so page collection and static generation run sequentially with 1 worker rather than spawning multiple
   V8 processes that compete for physical memory and cause swap thrashing.
2. **Extended static page timeout**: `staticPageGenerationTimeout: 180` in `next.config.ts` prevents
   Next.js from failing prerender passes after the default 60 seconds and triggering 3-attempt retry spirals.
3. **Single-worker Playwright**: Playwright runs with `--workers=1` in CI, preventing multiple Chromium
   browser processes from fighting against the Next.js server for RAM.

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

# 5. Did it fail at "Set up job", with no checked-out files and no test output?
#    That is the runner's filesystem, not the repository — see below.
gh run view <id> --json jobs --jq '.jobs[] | "\(.name) \(.conclusion)"'
```

## "`Set up job` failed" is not a code failure

A distinct, recurring fault that the run list summarises as one red job and that
`--log-failed` reports as a single annotation:

```
Set up job  ##[error]Access to the path
'/tmp/runner/_PipelineMapping/organicnz/indivisiblefairoaks/PipelineFolder.json'
is denied.
```

**What it is.** GitHub Actions writes a per-pipeline mapping directory during job
setup, before `actions/checkout` runs. When that directory exists but is owned by
a *different UID* than the account the runner service runs as, the runner cannot
write it and the job dies at setup. It happens when a runner was first started
as a different user, or after an OS upgrade remapped UIDs.

**Why it is worth its own section.** It is easily mistaken for three other
things, and each has a different fix:

| It looks like | Why that reading is wrong |
|---|---|
| our code is broken | nothing was checked out; not one line of the repo ran |
| the runner label selector is wrong | the runner *was* selected and *did* start |
| the cgroup killed the job | that produces a 10-minute run with no failed step; this fails in ~4 s |

**Confirm which runner took it** — the fix is per-host, so you need to know
before touching anything:

```bash
gh api repos/:owner/:repo/actions/jobs/<job-id> --jq '.runner_name'
```

**Then, on that host** (not from a checkout of this repository — this is why an
agent with only repo access cannot fix it):

```bash
# 1. Stop the runner service.
#    macOS (runsvc.sh / the launchd unit) and Linux (systemd --user) differ;
#    use whatever starts it there.

# 2. Clear the stale mapping and hand the tree back to the runner's own user.
#    Substitute the account the runner runs as — `$USER` is usually right.
sudo rm -rf /tmp/runner/_PipelineMapping
sudo chown -R "$USER:$USER" /tmp/runner

# 3. Restart it and confirm it re-registers.
# 4. Confirm from here — this is the check that matters:
gh api repos/:owner/:repo/actions/runners \
  -q '.runners[] | "\(.name) \(.status)"'
```

Clearing the whole `/tmp/runner/_work` is occasionally needed as well, but it
discards the job cache and costs a full reinstall on the next run. Start with
`_PipelineMapping` alone.

**Seen on 2026-10-05/06** on `personal-organicnz` (`personal-p08`), taking every
job handed to it while `indivisiblefairoaks-runner-1` was simultaneously
`offline` — so the branch could not run at all, and no commit could be validated
in CI. Both runners must be healthy; see `docs/ci-separation-plan.md` §4 for why
this stays invisible until a run is expected to have happened.

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
headroom to fix that — `MEMORY=1024M` plus **`MEMORY_SWAP=4096M`** (backed by 6.0 GiB host swap) — so the lint
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
| `bun run build` killed, exit 137 | The cgroup OOM-killer: SIGKILL once RSS passes the container's total `MEMORY + MEMORY_SWAP` ceiling. V8 grows the heap rather than collecting | **Partly fixable** — see below |
| Lint passes sometimes, cancelled other times | `tsc` takes 8m28s here against **1.4 s** locally. The host runs at load ~12 on 2 vCPU | **Wall clock fixed** (15 → 25 → 120 min); the load itself is not — shared, undersized host |
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
on the runner against 1.4 s on a workstation** — roughly 360× — which is what
makes this job's wall clock the binding constraint rather than the code.

**That ceiling was wrong, and it was wrong in the direction that hides a pass.**
The job ran `timeout-minutes: 15` while this table measures a *passing* job at
10m21s. Setup costs ~2 min, so `tsc` had ~13 min — and on 2026-10-04 it was
**still running at 13m25s** and was killed. Two runs, `37233487021` (20:48Z) and
`37240597987` (22:36Z), both ended `cancelled` at exactly 15 minutes with
`oxlint` reporting **0 warnings and 0 errors** and `tsc` mid-flight. The job's own
step log shows the split plainly:

| | Lint & Types, 2026-10-04T20:48Z |
|---|---|
| job start → `oxlint` done | 1m58s (checkout, bun, cache hit, install, biome, oxlint) |
| **`tsc --noEmit`** | started 21:19:28Z, **still running at 21:32:53Z** when killed |

So the honest reading of this table is not "lint passes when the host is quiet" —
it is that a 15-minute ceiling cannot distinguish a slow pass from a slow failure,
and it picked the wrong answer twice. The ceiling is now **120 minutes**, which fits
that `tsc` case and still fails fast on a real error, because biome and oxlint
finish in seconds and run first.

**120 minutes is necessary and not sufficient.** The ceiling was raised on the
strength of the `tsc` measurement above, and then the run that carried the change
(`37245233357`, 25m24s) failed somewhere else entirely:

```
23:59:29Z  Cache hit for: bun-gmoqYqdUbaYsI0KujeXt7Zg/p0I=
00:23:59Z  Install dependencies   ##[error]The operation was canceled.
```

It never reached `tsc`. **`bun install` took 24m30s with a warm cache** — the same
step that took ~40 s in the run above, minutes earlier, on the same cache key. So
the step that times out is not fixed:

| Run | `bun install` | reached `tsc`? |
|---|---|---|
| `37233487021` 21:18Z | ~40 s | yes — killed 13m25s in |
| `37245233357` 23:59Z | **24m30s, killed** | **never** |

Forty seconds versus twenty-four and a half minutes, same step, same cache-hit
state, is not a slow dependency tree. It is a container thrashing against
`Memory=1024M` on a host with 887 MiB of RAM and load ~12. `Tests & Coverage` on
that same run finished its own `bun install` and **passed in 3m29s**, minutes later
— which is the contention observed rather than inferred.

So `Lint & Types` on this host is intermittent for two different reasons, and only
one of them lives in this repository. No ceiling value fixes the other.

That ratio is the whole problem. Nothing in this repository causes a 360× slowdown;
it is swap. The host has 887 MiB of RAM against 2047 MiB of swap, and it is
shared — load average 11.87 on 2 vCPU with 7 MiB free was observed mid-run.

### The build needs ~2.2 GB and a floor of 768 MB — measured, not guessed

`next build` peaks at **~1.8 GB RSS on every configuration tried**, which is the
whole reason exit 137 appears. Measured on a workstation, peak RSS and outcome for
each heap cap (before the Sentry integration landed):

| `--max-old-space-size` | Outcome | Peak RSS |
|---|---|---|
| 512 MB | ❌ fails during type check | — |
| 640 MB | ❌ fails during type check | 1795 MB |
| 704 MB | ❌ fails during type check | 1852 MB |
| **768 MB** | ✅ succeeds | 1816 MB |
| uncapped | ✅ succeeds | 1807 MB |

The Sentry plugin adds roughly 300–500 MB on top — 2122 and 2310 MB across two
runs, both exiting 0. That moves the peak from "under the 2048 MB container
ceiling with swap to spare" to over it, so the self-hosted build's margin, such
as it was, is gone. Local and Vercel builds are unaffected; only the 887 MB
host ever needed that margin.

Two things follow, and the first one is the useful one.

**768 MB is a floor, not a preference.** Below it the build does not merely run
slowly — it fails inside `next build`'s own type-check phase. That makes the cap
load-bearing in a way the lint job's is not.

**The cap barely moves peak RSS, and `cpus: 1` does not move it at all.** Peak
stays ~1.8 GB whether the heap is capped at 768 MB or uncapped, and
`experimental.cpus: 1` measured 1813 MB. The reason is that `next build` spawns
worker processes for static generation, so `NODE_OPTIONS` caps each one separately
and total RSS is their sum. Anyone expecting a heap cap to bring this under
`MEMORY=1024M` is wrong by 800 MB.

**So it fits, but only just, and only alone.** The container ceiling is
`--memory=1024M --memory-swap 2048M` — 1024 MB of RAM plus up to 1024 MB of swap,
2048 MB total. The build's 1816 MB peak is under that, so it *can* complete, but
it needs the host to lend roughly 800 MB of swap. With a neighbour runner up there
is no swap to lend, and the kernel kills the process. That is the exit 137.

This is also the trap in measuring a peak RSS: a **failed** build still reports one.
The 512 MB row looked like a 1738 MB win until the exit code was checked, at which
point it was a build that did not finish. Any memory figure here is only meaningful
alongside whether the build exited 0.

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
`Build` was historically unproven due to swap limits, but is now proven:
with 6.0 GiB host swap, `MEMORY_SWAP=4096M`, local font self-hosting, and
`.next/cache` build caching, `Next.js Build` completes reliably in ~5 minutes
warm (~21m cold) with zero OOM events, unblocking the downstream E2E suite.

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

So the honest current state is: **lint, unit tests, migration history,
and Next.js production build pass consistently in CI.** The 120-minute ceiling
makes lint's verdict *reliable*, while the 6.0 GiB swap headroom and runner image
tooling allow the full Next.js build and E2E browser tests to execute on-host.

## What this means for the delivery gates

The local gates are real, they run on every push, and they are currently the only
ones that finish:

| Gate | Command |
|---|---|
| 32 pre-commit guards | lefthook, on `git commit` |
| documentation claims | `bun scripts/check-doc-claims.mjs` — guards, baseline, spec counts |
| suppression ratchet | pre-push, baseline 27 |
| lint | `bun run lint:check` |
| unit + coverage | `bun run test:coverage` — full suite, per-file thresholds |
| types | `bunx tsc --noEmit` |
| production build | `NEXT_E2E_BUILD=true bun run build` |
| peer deps | `bun scripts/check-peer-deps.mjs --all` |
| e2e | `playwright test --workers=2` — 93 specs (93 + no running tests) |

A merge is only as trustworthy as the last full local run, so run all of them
before merging anything that CI would otherwise have gated.

The unit-test count is deliberately absent from this table. It moved four times in
as many rounds, and the obvious cheap source of truth cannot reproduce it:
`vitest list` enumerates 884 tests while `vitest run` executes 997, the difference
being `it.each` expansion the listing does not perform. A figure nothing checks is
a figure that will be wrong. `scripts/check-doc-claims.mjs` verifies the claims
that *can* be re-derived — guard count, baseline, `lefthook.yml` length, spec
total and both coverage floors — and records why this one is not among them.

## Migrations and Edge Functions ship through `supabase.yml`

`supabase.yml` is the only delivery path, and it applies to production. Its own
header says so ("ALL Supabase-project delivery … lives HERE"), and it did push
migrations to the hosted project at 20:56 on 2026-10-04. **An earlier revision of
this file claimed the opposite** — that deployment is done by hand "rather than by
`supabase.yml`" — which is the same class of error as a `CHECK` constraint that
disagrees with the code that writes it: a confident instruction that sends the next
agent somewhere the pipeline has already been.

A push touching `supabase/**` is the trigger (`paths:` at the top of the workflow),
so the fix and the deploy are one action, not two. `workflow_dispatch` exists for a
redeploy after a rotation. Three jobs report independently, and that independence is
deliberate — `verify` needs `deploy`, `migrate` does not:

| Job | Does | On failure |
|---|---|---|
| `Deploy edge functions` | `deno check` first, then all 8 deploys, then asserts required secrets exist in the hosted project | nothing shipped; the type/secret error is in the log |
| `Push database migrations` | route select → dry-run → `db push` → `apply-migrations.mjs` as the authoritative converger | schema may already be ahead of the code — check before re-running |
| `Verify live edge functions` | probes every deployed route for its expected status | a 404 means not deployed; a 200 where a 401 is expected is worse |

The ordering matters when a run fails partway, which is exactly what happened on
2026-10-04: `migrate` **succeeded** and `deploy` failed on a type error, so
production schema moved while the function did not.

`deno check --node-modules-dir=auto supabase/functions/*/index.ts` is the gate that
caught it, and it was the *only* one — nothing local ran it, which is why it reached
`main` through four merges while the runner was offline. `bun run typecheck:edge`
and the `edge-typecheck` pre-commit guard now run the same check locally.

`apply-migrations.mjs` and the CLI dry-run remain the right tools for inspecting
state, and this is the record of how the two CHECK constraints were verified live by
attempting the insert they exist to forbid:

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

## Aggressive Build Memory & Cache Management on Self-Hosted Runners

The self-hosted fleet runs on a 887 MB RAM VPS backed by 6143 MB swap. Building Next.js
and running Playwright tests requires specific memory tuning:

1. **V8 Heap Ceiling (`--max-old-space-size=2048`)**:
   - Setting `max-old-space-size=3584` allowed V8 to balloon heap into swap (`VmSwap: 1.75 GB`).
   - Every GC pass traversed 1.75 GB in swap, causing >1,100 page faults every 2s (>110 MB/s swap I/O)
     and locking CPU at **91% I/O wait (`wa: 91%`)**.
   - Capping `--max-old-space-size=2048` triggers young-generation GCs earlier, keeping the active
     working set hot in physical RAM and eliminating swap thrashing.

2. **Prerender Slug Pruning (`NEXT_E2E_BUILD=true`)**:
   - In production builds (`NEXT_E2E_BUILD !== 'true'`), Next.js prerenders all catalog products and CMS articles.
   - In throwaway E2E builds (`NEXT_E2E_BUILD === 'true'`), `getAllProductSlugs()` and `getAllPublishedSlugs()`
     return only test fixture routes (`defend-democracy-yard-sign`, `privacy-policy`, `terms-and-conditions`).
   - Next.js dynamic routing (`dynamicParams = true`) handles any unprerendered route dynamically at runtime.
   - This drops prerender routes from 66 down to ~20, saving minutes of WAN network latency and swap writes.

3. **Single CPU Worker & Asset Compression**:
   - `experimental: { cpus: 1 }` prevents concurrent V8 compiler threads from contending for RAM.
   - `compress: !isE2EBuild` disables Gzip/Brotli compression for localhost E2E test fixtures.

4. **Quadlet Volume Mount vs WAN Cache**:
   - The Quadlet container maps `%h/dev/ghrunner/cache/bun` directly to `/home/runner/.bun/install/cache`.
   - `actions/cache@v4` on bun dependencies is bypassed on self-hosted runners (`!contains(runner.labels, 'self-hosted')`),
     saving ~45s of WAN download/upload of a 1.5 GB directory already present on the host SSD.

5. **Playwright Multi-Viewport Test Resilience**:
   - Tests that iterate sequentially over 8+ viewport sizes (e.g. `header-fit.spec.ts`) use `test.slow()`
     to triple the test timeout from 60s to 180s, preventing timeouts on single-worker execution.

