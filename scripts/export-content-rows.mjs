#!/usr/bin/env bun
/**
 * Export every unreachable content row and its revisions to a JSON archive.
 *
 * Read-only by construction: the only Supabase calls are two `select`s. The
 * archive exists so a content owner can review the old copy before the rows are
 * archived or deleted, and so `content_revisions` is not lost with the rows.
 *
 * Usage:
 *   bun scripts/export-content-rows.mjs
 *   bun scripts/export-content-rows.mjs --out tmp/my-archive.json
 *   bun scripts/export-content-rows.mjs --out tmp/my-archive.json --force
 *
 * The default path is under `tmp/`, which is not committed. The archive holds
 * production copy; treat it as a review artifact, not a source file.
 */
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './load-env-local.mjs';
import { unreachableContentSlugs } from '../src/lib/content.ts';

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

const args = process.argv.slice(2);
const force = args.includes('--force');
const outIndex = args.indexOf('--out');
const out =
  outIndex >= 0
    ? args[outIndex + 1]
    : path.join('tmp', `content-archive-${new Date().toISOString().slice(0, 10)}.json`);

if (outIndex >= 0 && (!out || out.startsWith('--'))) {
  console.error('Usage: bun scripts/export-content-rows.mjs [--out <path>]');
  process.exit(1);
}

const slugs = unreachableContentSlugs();
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: rows, error: rowsError } = await supabase
  .from('content')
  .select('*')
  .in('slug', slugs)
  .order('id');
if (rowsError) throw new Error(`content export failed: ${rowsError.message}`);

const ids = (rows ?? []).map((row) => row.id);
let revisions = [];
if (ids.length > 0) {
  const { data, error } = await supabase
    .from('content_revisions')
    .select('*')
    .in('content_id', ids)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`revision export failed: ${error.message}`);
  revisions = data ?? [];
}

const payload = {
  exportedAt: new Date().toISOString(),
  projectHost: new URL(SUPABASE_URL).host,
  slugs,
  rowCount: rows?.length ?? 0,
  revisionCount: revisions.length,
  rows: rows ?? [],
  revisions,
};

await mkdir(path.dirname(out), { recursive: true });
try {
  await writeFile(out, `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
    flag: force ? 'w' : 'wx',
  });
} catch (error) {
  if (!force && error?.code === 'EEXIST') {
    console.error(`Refusing to overwrite existing archive: ${out}`);
    console.error('Pass --force to replace it.');
    process.exit(1);
  }
  throw error;
}
// `mode` only applies when the file is created; chmod also protects an
// existing archive that was previously written with broader permissions.
await chmod(out, 0o600);

console.log(
  `Exported ${payload.rowCount} unreachable rows and ${payload.revisionCount} revisions to ${out}`
);
console.log('Read-only export complete; no database writes were made.');
console.log('The archive contains production copy — do not commit it.');
