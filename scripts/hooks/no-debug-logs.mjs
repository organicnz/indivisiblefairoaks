#!/usr/bin/env node
/**
 * Security-path console.log audit.
 *
 * console.log in webhook/API/admin/middleware paths leaks payment data,
 * session tokens, and PII into production logs.
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
    if (lines[i].includes('console.log')) {
      found.push(`${file}:${i + 1}:${lines[i]}`);
    }
  }
}

if (found.length > 0) {
  console.log('');
  console.log('✖  console.log in security-critical path:');
  for (const f of found) console.log(f);
  console.log('');
  console.log('   Use console.error / console.warn for intentional logging.');
  console.log('');
  process.exit(1);
}
