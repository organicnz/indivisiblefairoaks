#!/usr/bin/env node
/**
 * Large file guard.
 */
import { statSync } from 'node:fs';

const LIMIT_KB = 500;

const files = process.argv.slice(2);
const oversized = [];

for (const file of files) {
  try {
    const sizeKb = Math.ceil(statSync(file).size / 1024);
    if (sizeKb > LIMIT_KB) {
      oversized.push(`  ${file}  (${sizeKb}KB)`);
    }
  } catch {
    continue;
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
