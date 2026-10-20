# `typescript-shim` — the `tsc` command line, backed by `tsrs`

This package is named `typescript` and provides a `tsc` binary. It is installed
as `"typescript": "file:./tools/typescript-shim"`.

It exists so that the project has **one** type checker — [`tsrs`](https://github.com/oxc-project/tsrs),
the Rust port of the TypeScript 7 compiler — instead of two.

## What Next.js actually requires

Next.js does not require the `typescript` package. It requires a package
**named** `typescript` whose `bin` metadata exposes a binary called `tsc`.
It finds it like this (`packages/next/src/lib/typescript/runTypeScriptCli.ts`):

```ts
const packageJsonPath = resolveFrom(baseDir, 'typescript/package.json')
// ...
const tscBin = typeof packageJson.bin === 'string'
  ? packageJson.bin
  : (packageJson.bin?.tsc ??
    Object.entries(packageJson.bin ?? {}).find(([name]) => /^tsc\d+$/.test(name))?.[1])
```

It then runs that binary twice:

| Call | Purpose | Handled by |
|---|---|---|
| `tsc --showConfig --project <tsconfig> --pretty false` | parsed as JSON, to read `compilerOptions.incremental` and `.composite` | **this shim** |
| `tsc --project <tsconfig> --noEmit --declarationMap false --emitDeclarationOnly false` | the actual type check | `tsrs`, natively |

`tsrs` implements the second call natively. It does not implement the first —
it exits 5 with `error: --showConfig is not supported by tsrs.` — and Next.js
treats a non-zero exit from that call as a hard failure:

```ts
if (result.exitCode !== 0) {
  throw new Error(/* ... */)
}
```

So the shim answers `--showConfig` itself and forwards everything else to the
native Rust binary.

## The `--showConfig` answer is not `tsc --showConfig`

`tsc --showConfig` reports the *computed* configuration: the merged tsconfig
chain, the compiler's default options filled in, and the `files`/`include`
globs expanded into a concrete file list.

The shim reports the merged tsconfig chain **as declared** — the
`compilerOptions` that the chain resolves to, plus the raw `files`, `include`
and `exclude`. It does not fill in defaults and does not expand globs.

Next.js only reads two booleans out of it, and both are answered faithfully.
The output carries a `_tsrsShim` marker so that a human reading the JSON is
not misled into thinking `tsc` produced it.

## The package deliberately has no `exports` field

Next.js resolves `typescript/package.json` with `resolveFrom`. A package with
an `exports` map that does not expose `./package.json` would fail to resolve,
and the build would report a missing dependency for a package that is
present. The `exports` field is omitted on purpose.

## The compiler binary is resolved, not assumed

`tsrs` ships one native binary per platform as an optional dependency, and
which one is correct depends on the host — on Linux, musl and glibc differ.
`tsrs` already knows this, and it also honours a `TSRS_BINARY` environment
variable for a locally built compiler. The shim calls `tsrs`'s own resolver
(`tsrs/lib/getExePath.js`) rather than carrying a second copy of the platform
table.

## It has to run on Bun

Next.js spawns the compiler with `process.execPath`. Under `bun --bun next
build` that is the `bun` binary, and Bun runs TypeScript natively — which is
what lets this file be TypeScript at all. The shim checks for Bun and fails
with an explanation rather than a syntax error if it is ever handed to a
runtime that cannot parse it.

## What it buys

- One type checker. `tsrs` is the gate (`bun run typecheck`) *and* the
  compiler inside `next build`.
- The `typescript` package — a Go binary — is no longer in the dependency
  tree. It was never Node.js, so this is toolchain consolidation rather than
  runtime removal, but it is one fewer compiler to keep in step.
- `next build`'s type check runs at Rust speed.

## What it costs

- One more moving part, and a `--showConfig` implementation that is not
  `tsc`'s. If `tsrs` ever implements `--showConfig`, the shim should
  delegate to it and this file should lose the JSONC parsing.
- `tsrs` 0.18.0 publishes binaries for `darwin-arm64` and
  `linux-{arm64,x64}-{gnu,musl}`. A host outside that set gets tsrs's own
  "This platform is not supported" error, which names the supported set.
