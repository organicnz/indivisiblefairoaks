#!/usr/bin/env bun
/**
 * The `tsc` command line, backed by tsrs.
 *
 * ## Why this file exists
 *
 * Next.js runs a type check as part of `next build`, and it does it by
 * invoking a compiler binary it finds the same way it finds any other
 * dependency: it resolves `typescript/package.json` out of `node_modules`,
 * reads that package's `bin` metadata for a binary named `tsc` (or `tsc<N>`),
 * and runs it.
 *
 * That is the whole contract. It is not "install the `typescript` package" —
 * it is "provide a package called `typescript` whose `tsc` binary behaves
 * like `tsc`". This file is that binary, and it is backed by `tsrs`, the Rust
 * port of the TypeScript 7 compiler (Cloudflare + VoidZero), so the project
 * has exactly one type checker rather than two.
 *
 * ## The one thing `tsc` does that `tsrs` does not
 *
 * Next.js calls the compiler twice:
 *
 *   1. `tsc --showConfig --project <tsconfig> --pretty false`, and parses the
 *      output as JSON, to decide whether the project is incremental and
 *      therefore whether to pass `--tsBuildInfoFile`.
 *   2. `tsc --project <tsconfig> --noEmit --declarationMap false
 *      --emitDeclarationOnly false`, and reads the diagnostics.
 *
 * `tsrs` implements (2) natively. It does not implement (1): it exits 5 with
 * `error: --showConfig is not supported by tsrs.` Next.js treats a non-zero
 * exit from that call as a hard failure, so (1) has to be answered here.
 *
 * So this shim answers `--showConfig` itself and forwards everything else
 * straight to the native Rust binary. The JSON it emits is the merged
 * `compilerOptions` of the tsconfig chain, which is what Next.js reads; it is
 * **not** `tsc --showConfig` in full, because `tsc` also expands the `files`
 * and `include` globs into a concrete file list and fills in the compiler's
 * default options. The `_tsrsShim` marker in the output says so, rather than
 * letting the JSON be mistaken for the real thing.
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

import { dirname, isAbsolute, join, resolve } from 'node:path';

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

/** The arguments Next.js (or a human) passed to the compiler. */
const argv = process.argv.slice(2);

/**
 * Strip comments and trailing commas from a JSONC document, which is what a
 * `tsconfig.json` is allowed to be.
 *
 * A regular expression cannot do this correctly: `//` occurs inside string
 * literals (a URL, say), and a comma inside a string may sit in front of a
 * brace. So this walks the text.
 */
function parseJsonc(text: string): Record<string, unknown> {
  let out = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        out += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      out += char;
      if (char === '\\') {
        out += next ?? '';
        i += 1;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    out += char;
  }

  // Trailing commas: a comma that is followed by whitespace and then a
  // closing brace or bracket, outside any string.
  let result = '';
  inString = false;
  for (let i = 0; i < out.length; i += 1) {
    const char = out[i];
    if (inString) {
      result += char;
      if (char === '\\') {
        result += out[i + 1] ?? '';
        i += 1;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === ',') {
      const rest = out.slice(i + 1);
      if (/^\s*[}\]]/.test(rest)) continue;
    }
    result += char;
  }

  return JSON.parse(result) as Record<string, unknown>;
}

async function readJsoncFile(path: string): Promise<Record<string, unknown>> {
  return parseJsonc(await Bun.file(path).text());
}

/**
 * Resolve the `extends` entry of a tsconfig to a path on disk.
 *
 * A tsconfig's `extends` is either a relative path (`"../tsconfig.base.json"`)
 * or a package specifier that points at a file inside a package
 * (`"@tsconfig/node22/tsconfig.json"`). A specifier that names a directory
 * means its `tsconfig.json`.
 */
async function resolveExtends(specifier: string, fromDir: string): Promise<string> {
  if (specifier.startsWith('.') || isAbsolute(specifier)) {
    const candidate = resolve(fromDir, specifier);
    if (await Bun.file(candidate).exists()) return candidate;
    const withDefault = join(candidate, 'tsconfig.json');
    if (await Bun.file(withDefault).exists()) return withDefault;
    throw new Error(`tsc-shim: cannot resolve "extends": ${specifier}`);
  }

  const resolved = Bun.resolveSync(specifier, fromDir);
  if (await Bun.file(resolved).exists()) return resolved;
  const withDefault = join(resolved, 'tsconfig.json');
  if (await Bun.file(withDefault).exists()) return withDefault;
  throw new Error(`tsc-shim: cannot resolve "extends": ${specifier}`);
}

/**
 * The merged contents of a tsconfig and everything it extends.
 *
 * `compilerOptions` merges key by key, child over parent. `files`, `include`
 * and `exclude` do not merge — the child's own value replaces the parent's
 * outright, which is what TypeScript itself does.
 */
async function readConfigChain(
  configPath: string,
  seen: Set<string> = new Set()
): Promise<{
  compilerOptions: Record<string, unknown>;
  files?: unknown;
  include?: unknown;
  exclude?: unknown;
}> {
  const absolute = resolve(configPath);
  if (seen.has(absolute)) {
    throw new Error(`tsc-shim: circular "extends" involving ${absolute}`);
  }
  seen.add(absolute);

  const config = await readJsoncFile(absolute);
  const dir = dirname(absolute);

  let parent: Awaited<ReturnType<typeof readConfigChain>> = {
    compilerOptions: {},
  };

  const extendsValue = config.extends;
  const specifiers = Array.isArray(extendsValue)
    ? extendsValue
    : typeof extendsValue === 'string'
      ? [extendsValue]
      : [];

  for (const specifier of specifiers) {
    const parentPath = await resolveExtends(specifier, dir);
    const inherited = await readConfigChain(parentPath, seen);
    parent = {
      compilerOptions: { ...parent.compilerOptions, ...inherited.compilerOptions },
      files: inherited.files ?? parent.files,
      include: inherited.include ?? parent.include,
      exclude: inherited.exclude ?? parent.exclude,
    };
  }

  const ownOptions = (config.compilerOptions ?? {}) as Record<string, unknown>;

  return {
    compilerOptions: { ...parent.compilerOptions, ...ownOptions },
    files: config.files ?? parent.files,
    include: config.include ?? parent.include,
    exclude: config.exclude ?? parent.exclude,
  };
}

/**
 * Answer `--showConfig`.
 *
 * Next.js reads two booleans out of this: `compilerOptions.incremental` and
 * `compilerOptions.composite`. Both are answered faithfully, from the merged
 * tsconfig chain. Everything else in the output is the merged configuration
 * as declared — not the compiler's computed defaults, and not an expanded
 * file list. The `_tsrsShim` marker is there so that a human reading this
 * JSON is not misled into thinking `tsc` produced it.
 */
async function showConfig(): Promise<void> {
  const projectIndex = argv.indexOf('--project');
  const project =
    projectIndex === -1 ? 'tsconfig.json' : (argv[projectIndex + 1] ?? 'tsconfig.json');

  const merged = await readConfigChain(resolve(project));

  console.log(
    JSON.stringify(
      {
        _tsrsShim: {
          note:
            'Produced by tools/typescript-shim, not by tsc. tsrs does not ' +
            'implement --showConfig, and Next.js requires it. The merged ' +
            "tsconfig chain is reported as declared: the compiler's default " +
            'options are not filled in and the file globs are not expanded.',
          notImplemented: ['default compilerOptions', 'file/include glob expansion'],
        },
        compilerOptions: merged.compilerOptions,
        files: merged.files ?? [],
        include: merged.include ?? [],
        exclude: merged.exclude ?? [],
      },
      null,
      2
    )
  );
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

if (argv.includes('--showConfig')) {
  await showConfig();
  process.exit(0);
}

const tsrsBinary = await resolveTsrsBinary();
const result = Bun.spawnSync([tsrsBinary, ...argv], {
  stdio: ['inherit', 'inherit', 'inherit'],
});
process.exit(result.exitCode ?? 1);
