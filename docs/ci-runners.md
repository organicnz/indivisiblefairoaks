# CI runners

> Why every workflow in this repository queues forever, and what it would take to
> fix. Read this before changing a `runs-on:` line.

## The short version

**`runs-on: [self-hosted, linux, X64, …]` is correct. Do not change it.**

No job in this repository has ever executed. Not "was slow", not "flaked" — could
not run. The selectors are fine; the machine that would satisfy them does not
serve this repository.

## Where the runners come from

Self-hosted runners for this organisation are not hand-registered. They are
provisioned by **`ghrunner`**, a fleet manager that runs as rootless Podman +
Quadlet units on a single x86_64 VPS behind Tailscale. A repository is served only
when it has an `instances/<id>.env` declaring its `REPO_URL`; an organisation can
also be served org-wide from `org/*.env`.

The fleet ships a coverage auditor that answers the question directly:

```bash
cd ../ghrunner
cargo run -q -p fleet-coverage -- --root .
```

For this repository it says:

```
organicnz/indivisiblefairoaks      [self-hosted, linux, X64, frontend-runner], [self-hosted, linux, X64, backend-runner]
                                     no runner serves this repository, and `UNSERVED` says that is intended.
                                     Its jobs queue until the declaration is removed.
```

**This repository is listed in `ghrunner`'s `UNSERVED` file.** It is a recorded
decision, not an accident. Six repositories are in that state, alongside
`portfolio`, `careecho-web` and others.

## Why it stayed invisible

Three separate things conspire, and each one individually looks fine:

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

`ghrunner`'s own `instances/ghrunner.env` documents having been bitten by
exactly this, in exactly these words:

> with no instance here, the job that provisions the whole fleet had no runner to
> run on, and queued forever. Every other signal was green: the units rendered,
> the collector ran, the watchdog was happy.
>
> The blind spot was structural rather than a mistake anyone made. The coverage
> auditor read the *first* `runs-on:` in each workflow file … So the request was
> never read, and a repository with a self-hosted job looked like one with none.

## The hand-registered runner is not a way out

A runner for this repository does exist: `personal-organicnz`, an Apple-silicon
macOS machine with labels `self-hosted, Linux, ARM64, frontend-runner,
backend-runner`.

It is **not** a usable substitute, and the failure mode is instructive:

- Its label set does not match `X64`, so selectors that ask for `X64` skip it.
- If a workflow is changed to `ARM64` to match it, jobs *are* dispatched, and then
  fail in `Prepare workflow directory` with
  `Access to the path '/tmp/runner/_PipelineMapping/…' is denied` — its install
  directory has been wiped, and macOS refuses the path. A freshly reinstalled
  runner at `~/actions-runner` registers, accepts a job, and then fails its OAuth
  handshake with `VssOAuthTokenRequestException: The signature is not valid`.

So **a green runner list is not evidence that a job can run**, in either
direction. The only reliable questions are the ones below.

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

## Serving this repository, if that is wanted

This is an infrastructure decision, not a code change: it puts this repository's
builds and its secrets onto a shared host that, by ghrunner's own design
principle, is *"not any organisation's"*. The steps:

1. Write `instances/<id>.env` in `../ghrunner`:

   ```ini
   REPO_URL=https://github.com/organicnz/indivisiblefairoaks
   LABELS=self-hosted,linux,X64,frontend-runner,backend-runner
   ```

2. Delete the `organicnz/indivisiblefairoaks` entry from `UNSERVED`. Skipping
   this makes the auditor report the entry as stale.

3. `runner-fleet sync`.

The auditor will then report the repository as served, and will complain if the
labels in step 1 stop matching what the workflows ask for — which is the property
that makes this maintainable rather than a thing to re-derive.

## What this means for the delivery gates

Until it is served, **the local gates are the only gates.** Every one of them is
real and runs on every push:

| Gate | Command |
|---|---|
| 24 pre-commit guards | lefthook, on `git commit` |
| suppression ratchet | pre-push, baseline 12 |
| lint | `bun run lint:check` |
| unit + coverage | `bun run test:coverage` — 823 tests, per-file thresholds |
| types | `bunx tsc --noEmit` |
| production build | `NEXT_E2E_BUILD=true bun run build` |
| peer deps | `bun scripts/check-peer-deps.mjs --all` |
| e2e | `playwright test --workers=2` — 112 specs |

The Playwright gate is the meaningful one and it does run, which is why the
delivered work was verifiable end to end: 112 e2e specs, including the real
Chromium session that caught the carousel's touch-target regression during this
branch.

Migrations and Edge Function deploys therefore **cannot** come from
`supabase.yml`. Apply them deliberately:

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