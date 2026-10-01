#!/usr/bin/env node
/**
 * SQL: SECURITY DEFINER must set search_path.
 *
 * A SECURITY DEFINER function without SET search_path = '' is exploitable:
 * a malicious user can manipulate the search path to hijack the function.
 * https://www.postgresql.org/docs/current/sql-createfunction.html#id-1.9.3.67.7
 */
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
const violations = [];

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('SECURITY DEFINER')) continue;

    const start = Math.max(0, i - 5);
    const end = Math.min(lines.length, i + 11);
    const context = lines.slice(start, end).join('\n');

    if (!/SET search_path/i.test(context)) {
      violations.push(`  ${file}:${i + 1}`);
    }
  }
}

if (violations.length > 0) {
  console.log('');
  console.log('✖  SECURITY DEFINER function without SET search_path:');
  for (const v of violations) console.log(v);
  console.log('');
  console.log('   Add SET search_path = \'\' to the function definition:');
  console.log('   LANGUAGE plpgsql SECURITY DEFINER SET search_path = \'\';');
  console.log('');
  console.log('   This prevents search_path hijacking attacks.');
  console.log('');
  process.exit(1);
}
