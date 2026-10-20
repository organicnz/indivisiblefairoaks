#!/usr/bin/env bun
/**
 * Env usage coverage.
 *
 * Every env var referenced in code must be declared in .env.example.
 * A referenced-but-undeclared var is silently undefined in CI/deploy
 * (validation-layer drift) — the Vault/edge secrets only cover declared
 * keys, so undeclared access would ship a runtime bug.
 *
 * Allowed raw-access files (env.ts, supabase init) are already exempted
 * by no-raw-env-access; this closes the NEXT_PUBLIC + declaration gap.
 */

const files = process.argv.slice(2);
const violations = [];

for (const file of files) {
  // A variable named in a *test* is a fixture, not an application setting.
  //
  // The guard's subject is the contract every environment has to honour:
  // `.env.example` lists the app's configuration, and a name that is
  // referenced only by a test is not part of it. Declaring a test fixture in
  // `.env.example` would put a key in the production contract that nothing
  // in production reads.
  //
  // The application's own references are still checked, which is where the
  // value of this guard is: a typo'd variable in shipped code is
  // silently `undefined` in CI and in production.
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || file.includes('/__tests__/')) continue;

  let content;
  try {
    content = await Bun.file(file).text();
  } catch {
    continue;
  }

  // Both raw-access spellings, for the same reason
  // `no-raw-env-access.mjs` matches both: `Bun.env` in `src/` is a latent
  // crash on the Edge runtime and in the browser, so a var reached through it
  // is just as undeclared as one reached through `process.env`.
  //
  // The *spelling* is captured as well as the name, so the finding names the
  // form it actually found — the two have different fixes.
  const varRegex = /(process\.env|Bun\.env)\.([A-Z_][A-Z0-9_]*)/g;
  const vars = new Map();
  let match;
  while ((match = varRegex.exec(content)) !== null) {
    vars.set(match[2], match[1]);
  }

  for (const [varName, spelling] of vars) {
    if (
      varName.startsWith('NEXT_PUBLIC_') ||
      varName === 'NODE_ENV' ||
      varName === 'NEXT_SKIP_ENV_VALIDATION'
    ) {
      continue;
    }

    let example;
    try {
      example = await Bun.file('.env.example').text();
    } catch {
      example = '';
    }

    if (!example.includes(`${varName}=`)) {
      violations.push(`  ${file} → ${spelling}.${varName}`);
    }
  }
}

if (violations.length > 0) {
  console.log('');
  console.log('✖  Env vars used in code but missing from .env.example:');
  for (const v of violations) console.log(v);
  console.log('');
  console.log('   Add the key to .env.example (and a value to .env.local).');
  console.log('   Secrets live in the Supabase Vault / edge secrets and in');
  console.log('   Vercel Env Variables for the app — .env.example is the');
  console.log('   contract every environment must honour.');
  console.log('');
  process.exit(1);
}
