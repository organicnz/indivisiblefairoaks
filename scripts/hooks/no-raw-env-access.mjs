#!/usr/bin/env bun
/**
 * Raw environment access must not reach `src/`.
 *
 * ## What it protects
 *
 * `src/` code must read the environment through the validated `env` object
 * exported from `src/lib/env.ts`. A direct read bypasses the Zod validation
 * and can silently return `undefined` in production.
 *
 * ## Both spellings, and why the second one is worse
 *
 * The pattern matches **two** forms:
 *
 *   - `process.env.X` — the portable spelling. It works in the browser, on
 *     the Edge runtime, and on Bun, which is why `src/` uses it.
 *   - `Bun.env.X` — the Bun-native spelling. **`Bun.env` does not exist in a
 *     browser or on the Edge runtime**, so a single use of it in `src/` is a
 *     guaranteed runtime crash on two of the three places that code runs.
 *
 * So `Bun.env` is not merely a style violation in `src/`, the way
 * `process.env` is: it is a *latent crash*, and a quieter one, because the
 * build succeeds and the failure appears on the first request that reaches
 * the line.
 *
 * The rule applies to `scripts/` and `e2e/` in exactly the opposite
 * direction, and that is not an inconsistency — it is the same rule seen
 * from both sides:
 *
 *   - `src/` runs in the browser, on the Edge runtime, and on Bun. It needs
 *     the spelling that works everywhere: `process.env`.
 *   - `scripts/` and `e2e/` run on Bun and nowhere else. They use
 *     `Bun.env`, which is the native accessor there.
 *
 * ## Exception
 *
 * `NEXT_PUBLIC_` vars in metadata (the framework pattern), and
 * `supabase-server.ts`, which needs raw access for SSR client init.
 */

const SKIP = new Set([
  'src/lib/env.ts',
  'src/lib/supabase-server.ts',
  'src/lib/supabase.ts',
]);

/**
 * Whether a file is a test.
 *
 * The guard is about **production**: the failure it prevents is a raw read
 * in shipped code that bypasses the Zod validation and silently returns
 * `undefined`. A test is not shipped, and a test that manipulates the
 * environment directly is doing the thing the guard is about — it is
 * *testing* the environment layer.
 *
 * So the exemption is by category, not by file. A per-file exemption list
 * would be one more entry every time a test needed the environment, and the
 * list is the part that goes stale.
 */
function isTestFile(file) {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || file.includes('/__tests__/');
}

/**
 * The raw-access spellings, in the order they are reported.
 *
 * `Bun.env` first: it is the one that crashes at runtime rather than
 * silently returning `undefined`, so it is the one a reader should meet
 * first.
 */
const RAW_ACCESS = ['Bun.env.', 'process.env.'];

const files = process.argv.slice(2);
const violations = [];
for (const file of files) {
  if (SKIP.has(file)) continue;
  if (isTestFile(file)) continue;

  let content;
  try {
    content = await Bun.file(file).text();
  } catch {
    continue;
  }
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!RAW_ACCESS.some((spelling) => line.includes(spelling))) continue;
    if (
      line.includes('NEXT_PUBLIC_') ||
      line.includes('NODE_ENV') ||
      line.includes('NEXT_SKIP_ENV_VALIDATION')
    ) {
      continue;
    }
    violations.push(`--- ${file} ---\n${i + 1}:${line}`);
  }
}

if (violations.length > 0) {
  console.log('');
  console.log('✖  Raw environment access outside the validated env layer:');
  for (const v of violations) console.log(v);
  console.log('');
  console.log('   Import the validated env object instead:');
  console.log("   import { env } from '@/lib/env';");
  console.log('   env.STRIPE_SECRET_KEY  (not process.env.STRIPE_SECRET_KEY)');
  console.log('');
  console.log('   `Bun.env` is worse than `process.env` here: it does not exist in');
  console.log('   a browser or on the Edge runtime, so it is a crash rather than');
  console.log('   an undefined value — and one the build will not catch.');
  console.log('');
  console.log('   `Bun.env` is correct in `scripts/` and `e2e/`, which run on Bun');
  console.log('   and nowhere else.');
  console.log('');
  console.log('   Add env.ts entries for any new secrets.');
  console.log('');
  process.exit(1);
}
