---
name: self-hosted-runner-ci
description: >-
  Strict operational rules for GitHub Actions on the self-hosted ghrunner pool.
  Use when editing .github/workflows, runner setup or health checks,
  next.config.ts e2e build tuning, Playwright concurrency, or diagnosing queued,
  cancelled, and "Set up job" failures. Enforces self-hosted-only
  `[self-hosted, linux]`, no ubuntu-latest, no role/arch pins, Bun-native memory
  controls, one-worker builds, and the split build-e2e jobs.
---

# Self-hosted runner CI

Read [`docs/ci-runners.md`](../../../docs/ci-runners.md) for the incident record
and the measurements behind these rules. This skill is the short operating
contract; the doc is the authority when they disagree.

## Non-negotiables

- **Never switch a job to `ubuntu-latest`.** The repository is self-hosted-only.
- **`runs-on: [self-hosted, linux]` is the whole selector.** Do not add a role
  label (`frontend-runner` / `backend-runner`) or an architecture token
  (`X64` / `ARM64`). All three pool hosts carry both role labels; the split
  never separated capacity, and a pinned selector is a single point of failure.
- **The pool is three hosts, one runner slot each:** `ghrunner-1`,
  `ghrunner-2`, `ghrunner-3`. Runners are ephemeral and register per job over
  Tailscale. A queued job is queue depth against those slots, not a missing
  repository label.
- **Do not diagnose a queue from the run list alone.** A queued job and an
  unservable selector look identical there.
- **Production pushes queue; PR pushes cancel.** `ci.yml` keys PR runs by branch
  with `cancel-in-progress: true`, and push runs by unique run id so a newer
  commit does not kill a run already testing an earlier one. Deploy workflows
  are separate and never share that group.

## Host and container contract

- Host: ~887 MiB RAM, 2 vCPU, ~6 GiB swap, reached over Tailscale.
- Container: `Memory=1073741824` (1024 MiB), `MemorySwap=4294967296`
  (4096 MiB), `CpuQuota=150000` (1.5 CPU).
- Jobs that exhaust the cgroup end **`cancelled`**, not `failed`. That is a host
  capacity verdict, not a code verdict.
- **`NODE_OPTIONS` is not a memory control on Bun.** Bun ignores
  `--max-old-space-size` (measured on 1.4.4: the heap limit stays ~48 MB whether
  the value is 768, 1280, 3584, or absent). Do not reintroduce V8 heap caps.
  The controls that actually bound the work are serial prerendering
  (`experimental.cpus: 1`) and Playwright `--workers=1`.

## Build + e2e contract

`Build + E2E` is split so the build and browser suite each get a fresh 1 GiB
container:

| Job | Ceiling | Does |
|---|---:|---|
| `build-e2e-build` | 40 min | Install, `NEXT_E2E_BUILD=true bun run build`, upload compressed `.next` artifact (no `.next/cache`) |
| `build-e2e-test` | 20 min | Restore artifact, run the full Playwright suite with `--workers=1` |
| `build-e2e` | 5 min | Stable aggregate check name; green only when both halves are green |

For the throwaway e2e bundle only, `next.config.ts` sets:

- `experimental.cpus: 1` — serialize prerender instead of one worker per host
  CPU the container does not have;
- `staticPageGenerationTimeout: 180` — avoid the default-60s retry spiral
  during swap pressure;
- `typescript.ignoreBuildErrors: true` — types are gated separately by the lint
  job, and `build-e2e` needs that job;
- `compress: false` — no Gzip/Brotli for localhost fixtures;
- `experimental.turbopackFileSystemCacheForBuild: false` — no warm `.next/cache`
  exists in the fresh container, and keeping the snapshot resident measured
  2.87 GiB peak RSS versus 2.16 GiB without it.

Production builds keep the type check, Sentry wrapper, compression, and
Turbopack cache. Do not turn these e2e-only switches on globally.

The e2e bundle also prunes prerender slugs to a few fixtures and uses local
gallery images through `src/lib/e2e-image-loader.ts`. Production keeps the full
slug set and the real media loader.

## Playwright

- CI always uses `--workers=1`. Two Chromium processes plus `next start` and the
  mock server exceed physical RAM.
- `playwright.config.ts` already sets `workers: 1` when `CI` is true; passing
  the flag again is harmless and explicit.
- Tests that iterate 8+ viewport sizes (for example `header-fit.spec.ts`) use
  `test.slow()` so serial execution does not hit the standard 60-second timeout.
- A full e2e job has a 20-minute ceiling. A run that spends 38 minutes queued
  is not wedged; measure the **job**, not the run.

## Caching

- The Quadlet container maps `%h/dev/ghrunner/cache/bun` onto
  `/home/runner/.bun/install/cache`; that is the warm dependency cache.
- Do not upload the ~1.5 GB Bun cache over WAN on self-hosted runners. Gate
  `actions/cache` for Bun dependencies with
  `if: "!contains(runner.labels, 'self-hosted')"`.
- Playwright browsers cache at `~/.cache/ms-playwright`; Next.js `.next/cache`
  is keyed on `bun.lock`. The e2e artifact deliberately excludes `.next/cache`.

## Health and diagnosis

```bash
# Registered runners, with labels — not just status.
gh api repos/:owner/:repo/actions/runners \
  -q '.runners[] | {name, status, busy, labels: [.labels[].name]}'

# Is the fleet configured to serve this repository?
cd ../ghrunner && cargo run -q -p fleet-coverage -- --root .

# Is this a job failure or a job that never started?
gh run view <id> --log-failed | tail -40
gh run view <id> --json jobs --jq '.jobs[] | "\(.name) \(.conclusion)"'
```

- `runner-health.yml` runs hourly. Its API check degrades to a warning when the
  token cannot list runners; the independent smoke jobs are the primary liveness
  signal. It opens/comments on one long-lived outage issue rather than a new
  issue per tick.
- The watchdog cancels a run only when one of its **in-progress jobs** is older
  than 50 minutes. It does not use the run's `startedAt`; a long queue wait must
  not kill a healthy job.
- A `Set up job` failure with
  `_PipelineMapping/.../PipelineFolder.json` access denied is a runner
  filesystem ownership problem, not a code failure. Confirm the runner name,
  then clear `_PipelineMapping` on that host and restore ownership to the
  runner's user. Do not start by deleting `_work`.
- A missing `ghrunner-network.service` or a podman network with DNS enabled
  makes the runner fail to register before any job starts. On a custom network,
  podman takes the resolver from the network; `--dns` is silently ignored.
  `--disable-dns` is the lever.

## Do not

- Add `sudo` or `actions/setup-node` to a workflow. The host has no project Node
  runtime; the runner's own bundled Node is only for GitHub's actions.
- Add `npx` or `bun <bin>` where `bun --bun <bin>` is required.
- Raise a timeout to hide a queue wait. A passing run's wall clock is not a
  failing run's budget.
- Treat `cancelled` or exit 137 as a test failure. Check whether the container
  hit its cgroup or wall clock first.
- Re-add `NODE_OPTIONS: --max-old-space-size=...`; it protects a V8 heap that
  no longer exists.

## Verification

- Workflow YAML: inspect the diff, then run the relevant job or
  `gh workflow view <file>`; there is no local GitHub Actions runner.
- Runner health from a workstation: `bash scripts/check-runners.sh`.
- Docs and numeric claims: `bun scripts/check-doc-claims.mjs`.
- E2E config changes: build with `NEXT_E2E_BUILD=true bun run build` and run the
  affected spec with `--workers=1`; do not infer a pass from a config diff.
