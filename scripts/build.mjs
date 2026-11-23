#!/usr/bin/env bun
/**
 * Run `next build` and fail if Next reports a prerender warning.
 *
 * `next build` exits 0 for warnings such as:
 *
 *   Error: Route "/admin": Next.js encountered the unstable value
 *   Date.now() while prerendering.
 *
 * That is exactly how a route can ship with a broken static shell while the
 * build is green. This wrapper streams the build output unchanged, scans the
 * combined stdout/stderr, and turns those warning lines into a failed build.
 *
 * The actual build is still `bun --bun next build`; this is a guard around it,
 * not a second build implementation.
 *
 * ## E2E builds are self-contained
 *
 * The browser suite is built with `NEXT_E2E_BUILD=true` on a machine that may
 * be a fresh checkout with no `.env.local`. A real local environment wins when
 * it exists; otherwise the build gets loopback/placeholder public values so
 * `/sitemap.xml` can construct a client and the build can finish. The app and
 * mock ports are chosen here as a free pair, and the chosen app port is written
 * to `.next/e2e-port` so `playwright.config.ts` starts the server on the same
 * origin. Keeping this here rather than in `lefthook.yml` means the same rules
 * apply when the build is run directly.
 */

import { lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnvLocal } from './load-env-local.mjs';
import { findPrerenderWarnings } from './prerender-warnings.mjs';

const isE2E = process.env.NEXT_E2E_BUILD === 'true';
let e2ePort;

if (isE2E) {
  // Bun normally loads this at startup, but a shell with NODE_ENV=test does
  // not. The loader is the same one the scripts use: shell values win, and the
  // file is simply absent on a fresh checkout.
  await loadEnvLocal();

  const ports = await import('../e2e/helpers/ports.ts');
  e2ePort = ports.E2E_PORT;

  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    process.env.NEXT_PUBLIC_SITE_URL = `http://localhost:${e2ePort}`;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9';
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'placeholder';
  }
  // The public values above make the schema parseable, but the build has
  // historically used the skip as well: it is a throwaway browser-test bundle,
  // not a deployment, and a half-filled local environment should not stop it.
  if (!process.env.NEXT_SKIP_ENV_VALIDATION) {
    process.env.NEXT_SKIP_ENV_VALIDATION = '1';
  }
}

const output = [];

async function forward(stream, target) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const text = decoder.decode(value, { stream: true });
    if (text) {
      output.push(text);
      target.write(text);
    }
  }

  const tail = decoder.decode();
  if (tail) {
    output.push(tail);
    target.write(tail);
  }
}

const proc = Bun.spawn([process.execPath, '--bun', 'next', 'build'], {
  // `Bun.spawn` inherits the environment **as it was at process start**, not
  // mutations made since. The e2e defaults above are exactly such mutations;
  // without this, the build worker sees an empty Supabase configuration and
  // `/search` fails during prerendering. Pass the current environment through.
  env: process.env,
  stdin: 'ignore',
  stdout: 'pipe',
  stderr: 'pipe',
});

await Promise.all([forward(proc.stdout, process.stdout), forward(proc.stderr, process.stderr)]);

/**
 * Turbopack emits hashed aliases for server externals — for example
 * `@sentry/nextjs-c6ef459ddbd6c254` — and points `.next/node_modules` at the
 * real packages through symlinks. Vercel's function packaging drops those
 * symlinks, so the deployed chunk fails at runtime with:
 *
 *   Failed to load external module @sentry/nextjs-c6ef459ddbd6c254:
 *   ResolveMessage: Cannot find module '@sentry/nextjs-c6ef459ddbd6c254'
 *
 * Copying the package into `.next/node_modules` does not help, because that
 * directory is not part of the packaged function. Rewrite the quoted
 * specifiers in `.next/server` to the real package name instead, and only when
 * that package exists on disk, so a string that merely looks hashed is left
 * untouched. See vercel/next.js#87737 and #93901.
 */
async function dehashServerExternals() {
  const aliasPattern = /(["'])((?:@[^/"']+\/)?[^/"']+-[a-f0-9]{16})(\/[^"']*)?\1/g;
  const files = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile() && /\.m?js$/.test(entry.name)) {
        files.push(path);
      }
    }
  }

  await walk('.next/server');

  const aliases = new Set();
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(aliasPattern)) aliases.add(match[2]);
  }

  // alias -> real package name, but only for packages that actually exist.
  const resolvable = new Map();
  for (const alias of aliases) {
    const base = alias.replace(/-[a-f0-9]{16}$/, '');
    try {
      await lstat(join('node_modules', base));
      resolvable.set(alias, base);
    } catch {
      // Not a real package; leave the emitted string exactly as it is.
    }
  }

  if (resolvable.size === 0) {
    console.log('✔ no Turbopack hashed server externals to rewrite');
    return;
  }

  const counts = new Map();
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    let changed = false;
    const next = source.replace(aliasPattern, (match, quote, alias, subpath = '') => {
      const base = resolvable.get(alias);
      if (!base) return match;
      changed = true;
      counts.set(alias, (counts.get(alias) ?? 0) + 1);
      return `${quote}${base}${subpath}${quote}`;
    });
    if (changed) await writeFile(file, next);
  }

  for (const [alias, base] of resolvable) {
    const count = counts.get(alias) ?? 0;
    console.log(
      count > 0
        ? `✔ rewrote ${alias} -> ${base} (${count} reference${count === 1 ? '' : 's'})`
        : `… ${alias} -> ${base}: no live reference in .next/server`
    );
  }
}

const exitCode = await proc.exited;
const warnings = findPrerenderWarnings(output.join(''));

if (warnings.length > 0) {
  console.error('');
  console.error(
    `✖ Next.js emitted ${warnings.length} prerender warning${warnings.length === 1 ? '' : 's'}:`
  );
  for (const warning of warnings) {
    console.error(`  ${warning}`);
  }
  console.error('');
  console.error('A route read unstable or request-time data while prerendering.');
  console.error(
    'Fix the boundary, or declare `export const instant = false` when the route is deliberately dynamic.'
  );
  console.error('This build fails so the warning cannot ship silently.');
  process.exitCode = 1;
} else {
  process.exitCode = exitCode ?? 1;
}

if (process.exitCode === 0) {
  try {
    await dehashServerExternals();
  } catch (error) {
    console.error('✖ Could not dehash Turbopack server externals:', error);
    process.exitCode = 1;
  }
}

// The suite is about to test this exact build; hand it the same port the build
// baked into `NEXT_PUBLIC_SITE_URL` (or the fallback above). Writing after the
// build is deliberate: Next may replace `.next` while it is working.
if (process.exitCode === 0 && isE2E && e2ePort !== undefined) {
  try {
    await Bun.write('.next/e2e-port', `${e2ePort}\n`);
  } catch {
    // Playwright will probe for a free pair when the handoff is unavailable.
  }
}
