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
| `tsc --showConfig --project <tsconfig> --pretty false` | parsed as JSON, to read `compilerOptions.incremental` and `.composite` | `tsrs`, natively |
| `tsc --project <tsconfig> --noEmit --declarationMap false --emitDeclarationOnly false` | the actual type check | `tsrs`, natively |

## The shim is only a launcher

`tsrs` 7.1.0-beta.tsrs4 implements `--showConfig` natively, including the
merged tsconfig chain, the compiler defaults, and the expanded file list.
Every argument is forwarded unchanged to the native binary.

Older `tsrs` releases did not implement `--showConfig`; this shim answered
that call itself with a small JSONC parser and tsconfig merger. That code is
gone. Keeping it would mean maintaining a second, subtly different view of
the project's configuration next to the compiler that actually checks it.

Next.js reads only `compilerOptions.incremental` and `.composite` from the
JSON, and both come directly from `tsrs` now.

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
- No second implementation of `--showConfig`, tsconfig inheritance, or JSONC
  parsing in the repository.
- The `typescript` package — a Go binary — is not in the dependency tree.
  It was never Node.js, so this is toolchain consolidation rather than
  runtime removal, but it is one fewer compiler to keep in step.
- `next build`'s type check runs at Rust speed.

## What it costs

- One thin launcher between Next.js and the native compiler.
- `tsrs` is a beta release. It is pinned exactly so a routine `bun install`
  cannot change the gate's output.
