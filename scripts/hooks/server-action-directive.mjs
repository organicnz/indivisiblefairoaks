#!/usr/bin/env node
/**
 * Server actions must have 'use server' directive.
 *
 * A file that exports async functions calling Supabase or revalidatePath
 * without 'use server' will be treated as a Client Component, causing the
 * server-only imports to leak to the browser bundle.
 */
import { readFileSync } from 'node:fs';

const TRIGGERS = /revalidatePath|revalidateTag|createServerClient|createAdminClient/;

const files = process.argv.slice(2);
const violations = [];

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (!TRIGGERS.test(content)) continue;
  if (content.includes("'use server'") || content.includes('"use server"')) continue;

  violations.push(`  ${file}`);
}

if (violations.length > 0) {
  console.log('');
  console.log('✖  Server action file missing \'use server\' directive:');
  for (const v of violations) console.log(v);
  console.log('');
  console.log('   Add as the very first line of the file:');
  console.log('   \'use server\';');
  console.log('');
  process.exit(1);
}
