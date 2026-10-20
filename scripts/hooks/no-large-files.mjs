#!/usr/bin/env bun
/**
 * Large file guard.
 */

const LIMIT_KB = 500;

const files = process.argv.slice(2);
const oversized = [];

for (const file of files) {
  // `Bun.file(x).size` is a synchronous property and reads 0 for a path that
  // is not there, so a missing file measures 0KB and drops out on its own —
  // no try/catch needed, and none that could hide a real failure.
  const sizeKb = Math.ceil(Bun.file(file).size / 1024);
  if (sizeKb > LIMIT_KB) {
    oversized.push(`  ${file}  (${sizeKb}KB)`);
  }
}

if (oversized.length > 0) {
  console.log('');
  console.log(`✖  Staged files exceed ${LIMIT_KB}KB limit:`);
  for (const o of oversized) console.log(o);
  console.log('');
  console.log('   Large assets belong in Supabase Storage, not in the repo.');
  console.log('   Bypass: LEFTHOOK_EXCLUDE=no-large-files git commit');
  console.log('');
  process.exit(1);
}
