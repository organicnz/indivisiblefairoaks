#!/usr/bin/env bun
/**
 * Preview which unreachable content rows are archive candidates.
 *
 * Read-only: the only Supabase call is a `select`. There is deliberately no
 * `--apply`; archiving still needs a content-owner decision and, if it ever
 * becomes a script, a separate reviewed change.
 *
 * Usage:
 *   bun run content:archive:preview
 */
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './load-env-local.mjs';
import { unreachableContentSlugs } from '../src/lib/content.ts';
import { groupArchiveRows } from '../src/lib/content-archive.ts';

await loadEnvLocal({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = Bun.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = Bun.env.SUPABASE_SECRET_KEY ?? Bun.env.SUPABASE_SERVICE_ROLE_KEY;

for (const [name, value] of [
  ['NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SECRET_KEY', SERVICE_KEY],
]) {
  if (!value) {
    console.error(`Missing ${name} — add it to .env.local first.`);
    process.exit(1);
  }
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: rows, error } = await supabase
  .from('content')
  .select('id, slug, title, type, status')
  .in('slug', unreachableContentSlugs())
  .order('id');
if (error) throw new Error(`content preview failed: ${error.message}`);

const plan = groupArchiveRows(rows ?? []);
const line = (row) => `${String(row.id).padStart(2)}  ${row.slug}  (${row.type})  ${row.title}`;

console.log('Unreachable content archive preview (read-only)');
console.log('Review rows are listed separately and are never archive candidates.\n');

console.log(`CANDIDATES (${plan.candidates.length})`);
for (const row of plan.candidates) console.log(`  ${line(row)}`);
if (plan.candidates.length === 0) console.log('  (none)');

console.log(`\nREVIEW (${plan.review.length})`);
for (const row of plan.review) console.log(`  ${line(row)}`);
if (plan.review.length === 0) console.log('  (none)');

if (plan.unknown.length > 0) {
  console.log(`\nUNCLASSIFIED (${plan.unknown.length}) — review before cleanup`);
  for (const row of plan.unknown) console.log(`  ${line(row)}`);
}

console.log(
  `\nSummary: ${plan.candidates.length + plan.review.length + plan.unknown.length} unreachable rows — ` +
    `${plan.candidates.length} candidates, ${plan.review.length} need review, ` +
    `${plan.unknown.length} unclassified.`
);
console.log('Read-only preview complete; no database writes were made.');
