#!/usr/bin/env node
/**
 * No @ts-ignore / eslint-disable in security-critical paths.
 *
 * Type suppressions in API routes, middleware, and admin paths mean TypeScript
 * cannot catch type errors in the code that processes payments and auth.
 * There is currently 0 suppressions in these paths — this keeps it at 0.
 */
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
const found = [];

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/@ts-ignore|@ts-nocheck|eslint-disable|biome-ignore/.test(lines[i])) {
      found.push(`${file}:${i + 1}:${lines[i]}`);
    }
  }
}

if (found.length > 0) {
  console.log('');
  console.log('✖  Type/lint suppression in security-critical path:');
  for (const f of found) console.log(f);
  console.log('');
  console.log('   Fix the underlying type error instead of suppressing it.');
  console.log('   Security paths must have full type coverage.');
  console.log('');
  process.exit(1);
}
