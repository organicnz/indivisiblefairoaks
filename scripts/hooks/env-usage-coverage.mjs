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
  let content;
  try {
    content = await Bun.file(file).text();
  } catch {
    continue;
  }

  const varRegex = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
  const vars = new Set();
  let match;
  while ((match = varRegex.exec(content)) !== null) {
    vars.add(match[1]);
  }

  for (const varName of vars) {
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
      violations.push(`  ${file} → process.env.${varName}`);
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
