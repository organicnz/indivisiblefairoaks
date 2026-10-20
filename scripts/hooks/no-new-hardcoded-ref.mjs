#!/usr/bin/env bun
/**
 * Hardcoded Supabase project ref guard (new files only).
 *
 * Scans newly added `*.{ts,tsx,js,mjs}` files for the literal project ref.
 * Only *new* files are checked: changing a tracked file is a normal edit, and
 * a guard that fires on every touch of an existing file teaches people to
 * reach for the bypass instead.
 */
import { lines, runText } from '../bun-exec.mjs';
import { PROJECT_REF } from './_project-ref.mjs';

const newFiles = lines(
  runText([
    'git',
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=A',
    '--',
    '*.ts',
    '*.tsx',
    '*.js',
    '*.mjs',
  ])
);

if (newFiles.length === 0) process.exit(0);

const found = [];
for (const file of newFiles) {
  try {
    const content = await Bun.file(file).text();
    if (content.includes(PROJECT_REF)) {
      found.push(file);
    }
  } catch {
    continue;
  }
}

if (found.length > 0) {
  console.log('');
  console.log(`✖  Hardcoded Supabase project ref '${PROJECT_REF}' in new file(s):`);
  for (const f of found) console.log(f);
  console.log('');
  console.log('   Use Bun.env.NEXT_PUBLIC_SUPABASE_URL instead.');
  console.log('');
  process.exit(1);
}
