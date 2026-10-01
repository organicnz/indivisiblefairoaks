#!/usr/bin/env node
/**
 * use client guard — hooks without directive.
 *
 * useState/useEffect/useReducer in a file without 'use client' is a Next.js
 * App Router runtime error: "You're importing a component that needs X".
 * The error only surfaces at request time, not at build time.
 */
import { readFileSync } from 'node:fs';

const HOOKS = /useState|useEffect|useReducer|useRef|useCallback|useMemo|useContext/;

const files = process.argv.slice(2);
const violations = [];

for (const file of files) {
  if (
    file.startsWith('src/app/api/') ||
    file.startsWith('src/lib/actions/') ||
    /^src\/app\/.*\/actions\.ts$/.test(file)
  ) {
    continue;
  }

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (!HOOKS.test(content)) continue;
  if (content.includes("'use client'") || content.includes('"use client"')) continue;

  violations.push(`  ${file}`);
}

if (violations.length > 0) {
  console.log('');
  console.log('✖  React hooks used without \'use client\' directive:');
  for (const v of violations) console.log(v);
  console.log('');
  console.log('   Add to the top of the file:');
  console.log('   \'use client\';');
  console.log('');
  console.log('   Or move the hook usage into a child Client Component.');
  console.log('');
  process.exit(1);
}
