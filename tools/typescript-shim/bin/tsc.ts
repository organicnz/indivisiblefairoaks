#!/usr/bin/env bun
/**
 * The `tsc` command line, backed by tsrs.
 *
 * ## Why this file exists
 *
 * Next.js runs a type check as part of `next build`, and it finds the compiler
 * the same way it finds any other dependency: it resolves
 * `typescript/package.json` out of `node_modules`, reads that package's `bin`
 * metadata for a binary named `tsc` (or `tsc<N>`), and runs it.
 *
 * That is the whole contract. It is not "install the `typescript` package" — it
 * is "provide a package called `typescript` whose `tsc` binary behaves like
 * `tsc`". This file is that binary, and it is backed by `tsrs`, the Rust port
 * of the TypeScript 7 compiler (Cloudflare + VoidZero), so the project has
 * exactly one type checker rather than two.
 *
 * ## This is a launcher, not a second implementation
 *
 * `tsrs` 7.1.0-beta.tsrs4 implements both calls Next.js makes:
 *
 *   1. `tsc --showConfig --project <tsconfig> --pretty false`, whose JSON
 *      Next.js reads to decide whether the project is incremental.
 *   2. `tsc --project <tsconfig> --noEmit --declarationMap false
 *      --emitDeclarationOnly false`, whose diagnostics are the type check.
 *
 * Older `tsrs` releases did not implement `--showConfig`; this shim used to
 * answer that call itself. It no longer does. Every argument is forwarded to
 * the native binary, which keeps the build's configuration view and its
 * diagnostics on the same compiler, with no JSONC parser or tsconfig merger to
 * drift from TypeScript's own semantics.
 *
 * ## Why the compiler is resolved, not assumed
 *
 * `tsrs` ships one native binary per platform as an optional dependency, and
 * the right one depends on the host (Linux additionally distinguishes musl
 * from glibc). `tsrs` already knows how to answer that, and it also honours a
 * `TSRS_BINARY` override for a locally built compiler. This shim reuses
 * `tsrs`'s own resolver rather than carrying a second copy of the platform
 * table, so the two cannot drift.
 *
 * ## Why this is a Bun script
 *
 * Next.js spawns the compiler with `process.execPath`. Under
 * `bun --bun next build` that is the `bun` binary, and Bun runs TypeScript
 * natively. The check below turns the one case that would otherwise be
 * baffling — the file being handed to a runtime that cannot parse it — into
 * a sentence that says what to do.
 */

import { dirname, join } from 'node:path';

if (typeof Bun === 'undefined') {
  console.error(
    'tsc-shim: this file must be run by Bun.\n' +
      '  Next.js spawns the compiler with `process.execPath`, so the whole build ' +
      'has to run on Bun: `bun --bun next build`.\n' +
      '  A Node runtime here would also fail to parse this TypeScript file, so ' +
      'the failure would otherwise be a syntax error rather than a diagnosis.'
  );
  process.exit(1);
}

/**
 * Locate the native `tsrs` binary.
 *
 * `tsrs` ships its own resolver: it detects the platform (and on Linux,
 * musl against glibc), honours a `TSRS_BINARY` override, and produces a
 * useful error when the platform is unsupported. Reusing it keeps the
 * platform table in one place — a second copy in this shim would be a
 * second thing to forget to update.
 */
async function resolveTsrsBinary(): Promise<string> {
  const searchDirs = [import.meta.dir, process.cwd()];

  let tsrsDir: string | undefined;
  for (const dir of searchDirs) {
    try {
      tsrsDir = dirname(Bun.resolveSync('tsrs/package.json', dir));
      break;
    } catch {
      // Try the next directory.
    }
  }

  if (!tsrsDir) {
    throw new Error(
      'tsc-shim: cannot find the `tsrs` package. It is a devDependency of this ' +
        'project; run `bun install`.'
    );
  }

  const resolverPath = join(tsrsDir, 'lib', 'getExePath.js');
  if (await Bun.file(resolverPath).exists()) {
    const resolver = (await import(Bun.pathToFileURL(resolverPath).href)) as {
      default: () => string;
    };
    return resolver.default();
  }

  throw new Error(
    `tsc-shim: ${resolverPath} is missing. tsrs has changed its internal layout; ` +
      'the shim resolves the native binary through that module and needs to be ' +
      'updated to match.'
  );
}

const tsrsBinary = await resolveTsrsBinary();
const result = Bun.spawnSync([tsrsBinary, ...process.argv.slice(2)], {
  stdio: ['inherit', 'inherit', 'inherit'],
});
process.exit(result.exitCode ?? 1);
