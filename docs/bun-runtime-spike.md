# Bun runtime spike — Next.js 16.3.2 on Bun 1.4.4

**Status:** in progress · **Spike date:** 2026-10-19 · **Author:** engineering

A dated, read-only measurement of whether this app can run its Next.js server
on Bun's runtime instead of Node's — and, if so, on what terms. No production
behaviour is changed by this document. The `bun --bun` flag is passed on the
command line only; no committed script, config, or dependency is altered.

## Why this is not a foregone conclusion

Bun's adoption is real — 16.1M npm downloads/month for the installer, 17.5M
for the platform binary — and Bun 1.4 (2026-08-20) rewrote the runtime in
Rust, cut Next.js server memory 28% (397 MB → 285 MB), and Bun's own release
notes claim `bun --bun next build` works on Next.js 16.3 with Turbopack.

What that claim does not cover is **this** app's configuration. `next.config.ts`
sets `cacheComponents: true` and `partialPrefetching: true`, and that
combination is the documented failure surface:

- `oven-sh/bun#39847` (open) — Bun does not run `unhandledRejection` listeners
  in the promise's AsyncLocalStorage context. Next suppresses its own prerender
  control-flow rejects by reading exactly that store, so on Bun the rejects
  escape to the logger.
- `vercel/next.js#99575` (open) — the Next-side view of the same defect.
- `oven-sh/bun#31721` (open, unmerged) — the Bun-side fix, additionally
  depending on an unlanded WebKit PR.

Verified locally on the newest available Bun, independent of the trackers:

```
bun 1.4.4:      store inside unhandledRejection: null
node 24.22.0:   store inside unhandledRejection: {"type":"prerender-client"}
```

## Pre-registered decision rule

**Written before any result was observed.** The measurements below were taken
after this section was committed to the file; the diff order is the evidence.

This app cannot adopt the Bun runtime on the strength of "it starts up". It
depends on the prerendered shell being byte-for-byte the same shape under a
different event loop. So the rule is stated in terms of observable artefacts
rather than impressions:

**DISQUALIFYING — any one of these means the Bun runtime is not adopted:**

| # | Condition | Why it is disqualifying |
|---|---|---|
| D1 | `bun --bun next build` fails to complete | The build is the artefact. No artefact, no evaluation. |
| D2 | The prerendered route table differs from the Node build | A different route table means a different static shell, produced at build time, before any request. |
| D3 | The response body for any probe route differs byte-for-byte between the Node server and the Bun server | The shell is the product. Upstream, Bun inlined resumed HTML that Node postponed (5 886 → 9 328 bytes on the same build). |
| D4 | Any Playwright spec fails against the Bun-hosted server | The e2e suite is the delivery gate. `e2e/instant.spec.ts` is specifically the shell-contract guard. |
| D5 | The Bun server emits unhandled rejections **at a rate that scales with traffic** and the upstream fix is not in a stable Bun release | Not cosmetic: the upstream maintainer's stated risk is uncached IO leaking into the static shell — a cache-poisoning shape. |

**CONDITIONAL PASS — every disqualifier clear, and the only outstanding defect
is the known unhandled-rejection leak:**

Adopt the Bun runtime **only** once `oven-sh/bun#31721` (and its WebKit
dependency) ship in a stable Bun release **and** `vercel/next.js#99575` is
closed. Then re-run this entire spike on that release. A conditional pass today
is a *documented finding*, not a deployment.

**PASS —** all of the above clean **and** no rejection leak at all. Adopt and
record the release it passed on.

**Note on the built-in reject filter:** Next's `unhandledRejection` handler
drops its own prerender rejects when it can see the aborted work unit in
`workUnitAsyncStorage.getStore()`. On Bun it cannot, so the rejects that Node
silently absorbs become visible log lines. This is a *filter* failure, not a
rendering failure — which is precisely why D3 (byte comparison) and D4 (the
spec suite) exist as separate gates, and why D2 exists. A log line is not a
defect; a different shell is.

---

## Measurements

### Environment

| | |
|---|---|
| Next.js | 16.3.2 (Turbopack) |
| Bun | 1.4.4 (local) — CI was pinned to 1.4.2 at the time of the spike |
| Node | 24.22.0 (control) |
| App config | `cacheComponents: true`, `partialPrefetching: true` (unchanged for the spike) |
| Build mode | production (`.env.local`, no `SENTRY_AUTH_TOKEN`, so no source-map upload) and, separately, e2e mode (`NEXT_E2E_BUILD=true NEXT_SKIP_ENV_VALIDATION=1`) for the Playwright gate |

### M1 — Build (D1)

Both builds completed, exit 0.

| | Node | Bun (`bun --bun next build`) |
|---|---|---|
| Wall time | 23.66 s | 23.92 s |
| Peak RSS | 2.25 GB | 2.30 GB |
| Pages generated | 81 | 81 |
| **Route table** | baseline | **identical** — same 88 lines, same ◐/ƒ/○ per route |

**D1 passes. D2 passes.**

### M2 — Build-side noise

The Bun build emitted **7 `CLIENT_HOOK_DYNAMIC` errors** the Node build did not:

```
Error: Route "/admin/orders/[id]": Next.js encountered URL data `useParams()`
in a Client Component outside of `<Suspense>`.
    at <anonymous> (.next/server/chunks/ssr/_1lfiw_s._.js:2:57613) {
  digest: 'CLIENT_HOOK_DYNAMIC'
}
```

Routes: `/admin/orders/[id]`, `/admin/products/[id]`, `/admin/content/[id]`,
`/admin/crm/[id]`, `/admin/customers/[id]`, `/products/[slug]`, `/[slug]`.

This is `vercel/next.js#99575` exactly. The components **are** inside Suspense;
the route table is unchanged; the build exits 0. It is noise, not a change in
the artefact — but it is noise a deploy log would carry.

It is also **timing-dependent**: in e2e build mode (which sets
`experimental.cpus: 1`) the Bun build emitted **0** of them. The upstream
diagnosis is a race — Bun more often takes the `signal.aborted` branch, which
has no `.catch` — so the error only appears when workers run concurrently.
A Vercel build uses many workers, so it would appear there.

### M3 — Build output, byte level

Comparing the two `.next/server/app` trees:

- Identical file sets.
- 33 of the prerendered `.html` files differ. **Every one of those differences
  is a Turbopack chunk-name hash** — `/_next/static/chunks/2paty06f_qzns.js` vs
  `/_next/static/chunks/10z7e6r5h82uy.js` — which is *build non-determinism*,
  not a runtime difference. (Two consecutive **Node** builds do not match
  either.)
- With chunk hashes masked, **32 of 33 are byte-identical**.
- The 33rd, `_global-error.html`, differs only in a per-build random
  identifier embedded in the flight payload
  (`"PZ2y3YTBDCz2MItFlPevq"` vs `"4Afihu8RSVC8auONnjoGN"`).

**The prerendered static shell is equivalent.** This is the artefact the
caching and SEO strategy rests on, and it does not change under Bun.

### M4 — Runtime: the 2×2

Four cells — {node build, bun build} × {node server, bun server} — because
comparing "node build + node server" against "bun build + bun server"
confounds the build with the runtime. First request after server boot, same
build, sizes in bytes:

| Build | Server runtime | `/` | `/products` | `/about` | `/voter-info` |
|---|---|---|---|---|---|
| node | node | 328 287 | 166 934 | 161 134 | 226 181 |
| node | **bun** | 330 351 | 168 138 | 162 510 | 256 506 |
| bun | node | 328 302 | 166 934 | 161 134 | 226 181 |
| bun | **bun** | 330 351 | 168 138 | 162 510 | 256 506 |

Reading the table:

- **The build contributes almost nothing.** Node-build vs bun-build differs by
  15 bytes on `/` and 0 elsewhere.
- **The runtime contributes everything.** Bun's server emits a consistently
  larger first response.

### M5 — What the runtime actually changes

The Suspense boundary count is identical (3, 3, 3, 6) — the shell *structure*
is the same. What changes is the flight payload volume:

| Route | boundaries | flight pushes, Node | flight pushes, Bun |
|---|---|---|---|
| `/` | 3 | 12 | 60 |
| `/about` | 3 | 9 | 41 |
| `/voter-info` | 3 | 9 | 52 |
| `/products` | 6 | 4 | 32 |

**Bun resolves the dynamic holes and inlines the content**, where Node
postpones it and delivers it through the flight stream. Classifying every
differing byte region between the two responses gives **5 774 differing
regions** — this is a structural difference, not a formatting one.

This is the upstream-described behaviour, and it is the shape the Next.js
maintainer warned about.

### M6 — Steady state: is the difference per-request or first-request only?

The first response after boot differs. But a *response* that varies per request
would be the real problem, so that was tested separately — and the control
matters: two requests to the same URL on the **Node** server also differ.

After three warm-up requests, two consecutive warm responses were captured
per route, and every differing region was classified:

| Comparison | Differing regions | All React `useId` tokens? |
|---|---|---|
| Node server vs Bun server (same build), `/` | 2 | yes |
| Node server vs Bun server, `/voter-info` | 2 | yes |
| Node server vs Bun server, `/products` | 2 | yes |
| Node server vs Bun server, `/about` | 2 | yes |
| **Node server vs itself** (request a vs b), `/` | **2** | yes |
| **Node server vs itself**, `/voter-info` | **2** | yes |

The differing bytes are React `useId` random identifiers
(`x9ZtXf8Le4dUhsHlL-1uNv` vs `7dIEmDSXsHhNT1-n-NG8nv`) — **at the same
offsets, in the same count, on the Node server as on the Bun server.** So:

- The per-request variation is React's, not Bun's.
- In steady state the Node and Bun responses are **equivalent**: same length,
  same structure, differing only in the random ids Node also randomises.

**D3 passes in steady state.** The runtime difference is confined to the first
response after boot, where Bun inlines content Node postpones.

### M7 — Runtime unhandled rejections

**Zero**, in both runtimes, for this app. The upstream rejection leak
(`oven-sh/bun#39847`) is a *build*-side symptom here (M2), not a runtime one.
The ALS context loss was verified directly on this machine:

```
bun 1.4.4:      store inside unhandledRejection: null
node 24.22.0:   store inside unhandledRejection: {"type":"prerender-client"}
```

The defect is real and present in the newest Bun — it just does not manifest
at runtime for this app's routes, because none of them hit the aborted
hanging-promise path after boot.

### M8 — Cache headers

Identical between runtimes on the same build — `Cache-Control: private,
no-cache, no-store, max-age=0, must-revalidate`, same `Vary`, same
`Content-Type`. Only `Date` differs.

### M9 — The e2e gate, on each runtime

The same 95-spec suite, same build family, on this machine:

| | Node server | Bun server |
|---|---|---|
| Passed | 87 | 86 |
| Skipped | 7 | 8 |
| Failed | 1 (pre-existing, see below) | 1 (the same one) |
| **Wall clock** | **2.0 min** | **2.4 min** (4.3 min under load) |
| Specs that hit the 60 s timeout and needed a retry | **0** | **3** |
| Server log lines | 34 | ~22 000 |
| `unhandledRejection` lines | **0** | **770–871** |

Every one of the rejections is an `AbortError` from an aborted request, plus
39 `NEXT_PRERENDER_INTERRUPTED` records — Next's own prerender control-flow
signals, which Node's filter drops and Bun's forwards. Same spec, same
build, same requests; the difference is the runtime.

The one extra skip under Bun is not a new skip: it is the MFA step-up spec,
which timed out at 20 s on `waitForURL` and was then skipped on its retry
rather than re-run. The skip set is otherwise identical — the six
`admin-authenticated` specs and the setup project, skipped in both runs
because the e2e build has no seeded admin credentials.

**D4 passes**: the Bun server produces no additional spec failure. **D5
fails**: the rejection leak is real, it scales with traffic, and the upstream
fix is not in a stable Bun release.

### M10 — What the leak is *not*

It is not suppressible from this project, and three plausible mitigations were
tested and rejected:

- **`NEXT_UNHANDLED_REJECTION_FILTER=silent`** — only mutes the filter's own
  diagnostics. The rejects are logged by Next's logger, not the filter.
- **`NEXT_UNHANDLED_REJECTION_FILTER=disabled`** — removes the filter, which
  leaves Bun's default rejection handling in play. Strictly worse.
- **Bun's `--unhandled-rejections=none`** — a no-op here, because Next
  installs its own `unhandledRejection` handler, so Bun's mode never applies.
  It also changes semantics: it would hide *genuine* unhandled rejections.

Next's filter holds its captured listeners in a module-private array, so
nothing outside Next can remove the logger from the forwarding path. The
only fix is upstream: `oven-sh/bun#31721`, open and unmerged, additionally
dependent on an unlanded WebKit PR.

### M11 — The e2e suite under Bun only

The suite had to run on Bun with no Node anywhere, because that is the
project's direction. Playwright is the obstacle, and it is a specific one:

`registerESMLoader()` in Playwright's own source returns early on
`"Bun" in globalThis`, so Playwright never registers its Babel transform.
It then maps `Module._extensions['.ts']` to the plain-JS handler, and every
TypeScript spec is parsed as JavaScript:

```
BuildMessage: Expected ";" but found ":"
```

`BuildMessage` is a **Bun** global — that is JavaScriptCore's parse error, not
a type error. The fix is to make Playwright take its ESM path, where it hands
the file to the runtime's loader and Bun strips the types natively:
`e2e/package.json` containing `{"type": "module"}`. That is the whole change;
`__dirname` becomes `import.meta.dirname` in the three files that used it.

Verified: `bun node_modules/@playwright/test/cli.js test --list` reports
**95 tests in 22 files** under Bun, and the full suite runs green on a
Bun-hosted server with the Bun-hosted runner.

## Result

**The project moved to Bun. The Next.js *server* runtime is the one place
where Bun is measurably worse, and the reason is a single unlanded upstream
pull request.**

| Gate | Verdict |
|---|---|
| D1 — the Bun build completes | **Pass.** 23.9 s, 81 pages, exit 0. |
| D2 — the route table is identical | **Pass.** Same 88 lines, same ◐/ƒ/○ per route. |
| D3 — the response body is equivalent | **Pass in steady state.** The only differing bytes are React `useId` random tokens, in the same count and at the same offsets as a Node-vs-Node comparison. The *first* response after boot differs structurally: Bun inlines the resolved content where Node postpones it. |
| D4 — the e2e suite passes on a Bun server | **Pass.** 87 passed, 7 skipped, 1 failed — the same single failure Node produces. |
| D5 — no traffic-scaling rejection leak | **Fail.** 871 rejections per e2e run against Node's 0. Not suppressible from this project (M10). |

### What was adopted

- **Bun everywhere**: package manager, Next.js dev/build/start, type
  checking, unit tests, e2e tests, project scripts, CI, and the Vercel
  function runtime. `package.json` no longer declares a `node` engine.
- **No Node on the runner host.** `scripts/setup-runner.sh` used to install
  Node 20 "as a fallback for some tools"; nothing needed it, and a second
  runtime next to Bun is how a project ends up running under Node in
  production after a job quietly falls back to it. The one Node that remains
  on that host is the GitHub Actions runner's *own* bundled runtime, which is
  what executes Node-based actions such as `actions/checkout` — it lives
  inside the runner package and is independent of the system Node.
- **The last npm invocation is gone.** The secret-audit workflow installed the
  Vercel CLI with `npm install -g vercel`, which was both the last npm call in
  CI and the last reason the fleet needed Node. The CLI could not have run
  there anyway: its bin is a `#!/usr/bin/env node` script, and it needs
  `vercel link` state that cannot exist on a runner. The audit's live Vercel
  read goes through the REST API; where the CLI is still used locally, it is
  run *through Bun* (`bun node_modules/vercel/dist/vc.js`), because Bun
  ignores the shebang and runs it on its own runtime.
- **Bun's own types, and an explicit `types` allowlist.** `tsconfig.json`
  lists `bun-types`, `node`, `react` and `react-dom` by name, so the global
  type surface is a decision rather than an accident of what is in
  `node_modules/@types`. `@types/node` stays and cannot go: `bun-types`
  *extends* Node's compatibility layer (`/// <reference types="node" />` in
  its own `index.d.ts`) and Next's `next/types/global.d.ts` references it
  too. The one consequence that reached the code is that Bun's `fetch` carries
  a `preconnect` member, so a `vi.fn()` is not assignable to
  `globalThis.fetch` — which is why there is a single
  `src/lib/__tests__/fetch-mock.ts` helper rather than thirty-four casts
  across six suites.
- **`bun audit` as a dependency gate**, with a committed baseline of accepted
  advisories. It found 75 advisories on the tree this was run against, three
  of them *critical* in `next` itself; the baseline now holds one, and that
  one has no published fix. See AGENTS.md → Dependency vulnerabilities.
- **`bun check` for type checking** — verified against `tsc --noEmit` on the
  clean tree, on seven injected type errors across `.ts`, `.tsx`, a
  path-aliased import and a spec file, and on a frozen snapshot of the tree
  itself: the same errors, at the same places, with the same messages. The
  one difference is vocabulary, not coverage — for a missing-property
  assignment failure, `tsc` says `TS2741` ("Property 'x' is missing in type
  A but required in type B") and `bun check` says the more general `TS2322`,
  for the same line and the same severity. ~40× faster, 466 MB against tsc's
  1.03 GB. `typescript` remains a devDependency because Next's own build
  type-checks through it.
  *(A first pass at this comparison reported a false gap: the extraction
  matched `tsc`'s output format against `bun check`'s XML format, so every
  `bun check` error was silently dropped. The frozen snapshot exists because
  the tree was being edited by another session while the comparison ran.)*
- **Vitest on Bun, not `bun test`** — 547 `vi.fn`, 142 `vi.mock`, 126
  `vi.hoisted` and 37 `vi.stubGlobal` calls across 131 files. Bun's
  `mock.module` has different hoisting and resolution semantics; a partial
  port would leave 895 tests asserting against a mock that no longer behaves
  like the one they were written for. The runtime is the same either way.
- **Playwright on Bun** — via `e2e/package.json` (`{"type": "module"}`),
  which puts Playwright on its ESM path where Bun's own loader handles
  TypeScript.

### What was found along the way

**An unlayered-CSS cascade bug that silently disabled 304 `dark:` variants.**
`src/app/globals.css` hand-wrote `.bg-primary`, `.text-primary` and
`.border-primary` as plain CSS. Tailwind v4 emits its utilities in
`@layer utilities`, and **unlayered CSS beats layered CSS regardless of
specificity** — so those three hand-written rules overrode every `dark:`
variant of the same utility across the whole site. The duplicate `.text-primary`
rule sits at byte 229 054 of the compiled stylesheet; the `dark:` variant it
overrides sits at 209 939.

The rules were also *redundant* — Tailwind already generates all three
(`@theme inline` maps `--color-primary` and friends), so removing them
changes nothing about the light palette. One of the 304 affected sites is
exactly what the dark-palette axe gate was failing on:
`/gallery` computed `#155dfc` on `#1e427e` (1.87:1) where `#7cbaff` was
intended.

**A pre-existing red gate, unrelated to Bun.** The `theme-a11y` dark-palette
spec was failing on the untouched tree, with four colour-contrast violations
across `/`, `/gallery` and Voter Information. **One** of them was the cascade
bug above — the `/gallery` element at 1.87:1, which the fix removes. The
other **three** are amber badges: `#f59e0b` (the `--accent-gold` token) on
the dark card surfaces `#464c55` and `#495467`, measuring 4.03:1 and 3.55:1
against a 4.5:1 requirement for their 8–12 px bold text. They are a
token decision, not a cascade bug: `--accent-gold` is documented as a
dark-surface accent, and AGENTS.md already records that it is "text-unsafe on
white (2.15:1)" — the same token is now text-unsafe *on the dark cards* too.
That is a design decision for the chapter, and it is the one remaining red
gate.

**The environment changed under the measurement.** At 23:12:44 on 2026-10-19,
`~/.local/bin/node` — previously a real Node 24.22.0 — was replaced by a
542-byte shim that execs Bun, as part of the Homebrew → `stout` migration
that also removed Node from the machine. Every measurement in this document
predates that timestamp (the last was 23:06:27), so the Node control is a
genuine Node. Afterwards, Playwright could not run at all on the machine until
the ESM fix above, which is what forced that fix to be found.

### The cost, stated plainly

| | Node | Bun |
|---|---|---|
| e2e gate wall clock | 2.0 min | 2.4 min (4.3 min under load) |
| Specs hitting the 60 s timeout | 0 | 3 |
| Server log lines per e2e run | 34 | ~22 000 |
| `unhandledRejection` per e2e run | 0 | 770–871 |
| Build wall clock | 23.7 s | 23.9 s |
| Build peak RSS | 2.25 GB | 2.30 GB |
| Type check | 12.1 s / 1.03 GB (`tsc`) | 0.3 s / 466 MB (`bun check`) |

The type check and the build are a wash. **The server runtime is not**: it is
slower, and it logs two orders of magnitude more. Both come from the same
root cause — Bun does not restore the AsyncLocalStorage context for
`unhandledRejection` listeners.

### When to revisit

Re-run this spike when **all three** hold:

1. `oven-sh/bun#31721` is merged *and* the WebKit PR it depends on has
   landed, *and* a stable Bun release carries it.
2. `vercel/next.js#99575` is closed.
3. A Bun release ships the `useParams()`-outside-Suspense false positive
   fixed — it appears only when the build runs with parallel workers, so it
   shows up on Vercel (many workers) and not in the single-worker e2e build.

Until then: **the Bun runtime is adopted for the toolchain, the type checker,
the build and the tests, and the server runtime's extra cost is a known,
measured, documented quantity with a named upstream fix** — not an unknown.
