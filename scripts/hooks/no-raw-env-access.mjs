#!/usr/bin/env bun
/**
 * process.env must not be accessed outside src/lib/env.ts.
 *
 * Direct process.env access bypasses the Zod validation in env.ts and can
 * silently return undefined in production. All env access must go through
 * the validated `env` object exported from src/lib/env.ts.
 *
 * Exception: NEXT_PUBLIC_ vars in metadata (framework pattern) and
 *            supabase-server.ts which needs raw access for SSR client init.
 */

const SKIP = new Set([
  'src/lib/env.ts',
  'src/lib/supabase-server.ts',
  'src/lib/supabase.ts',
]);

const files = process.argv.slice(2);
const violations = [];

for (const file of files) {
  if (SKIP.has(file)) continue;

  let content;
  try {
    content = await Bun.file(file).text();
  } catch {
    continue;
  }
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('process.env.')) continue;
    if (
      lines[i].includes('NEXT_PUBLIC_') ||
      lines[i].includes('NODE_ENV') ||
      lines[i].includes('NEXT_SKIP_ENV_VALIDATION')
    ) {
      continue;
    }
    violations.push(`--- ${file} ---\n${i + 1}:${lines[i]}`);
  }
}

if (violations.length > 0) {
  console.log('');
  console.log('✖  Direct process.env access outside validated env layer:');
  for (const v of violations) console.log(v);
  console.log('');
  console.log('   Import the validated env object instead:');
  console.log('   import { env } from \'@/lib/env\';');
  console.log('   env.STRIPE_SECRET_KEY  (not process.env.STRIPE_SECRET_KEY)');
  console.log('');
  console.log('   Add env.ts entries for any new secrets.');
  console.log('');
  process.exit(1);
}
