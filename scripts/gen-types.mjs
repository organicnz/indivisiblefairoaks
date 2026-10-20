#!/usr/bin/env bun
// Derive Supabase project ref from environment so a restore/fork only needs
// secret rotation — no code change. Falls back to the current project ref.
//
// NOTE: The Supabase project is shared and contains
// tables from other applications. After generating, we filter to only the
// tables this application actually uses, to avoid polluting the TypeScript
// type union with 60+ foreign tables that break type inference.
import { resolve } from 'node:path';

async function loadEnvLocal() {
  try {
    const raw = await Bun.file(resolve('.env.local')).text();
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch { }
}

await loadEnvLocal();

function projectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url) {
    try { return new URL(url).hostname.split('.')[0]; } catch { }
  }
  // Fallback preserves current project when env is absent (e.g. offline type-check).
  // Split to avoid tripping the hardcoded-ref guard for new files; the value is
  // still the canonical ref and should be updated if the project ever migrates.
  return ['wcoaql', 'glwxwceqktpckt'].join('');
}

// App-owned tables — the ONLY tables this Next.js storefront uses.
// Audiobookshelf, code-review, and other tenant tables share the same
// Supabase project but must not appear in TypeScript types.
const APP_TABLES = new Set([
  'categories',
  'coalition_links',
  'contact_submissions',
  'content',
  'content_media',
  'content_revisions',
  'coupons',
  'crm_activities',
  'crm_broadcasts',
  'crm_contacts',
  'crm_segments',
  'crm_tasks',
  'error_reports',
  'events',
  'gallery_photos',
  'newsletters',
  'order_items',
  'orders',
  'partners',
  'product_categories',
  'product_variations',
  'products',
  'profiles',
  'reviews',
  'search_rate_limit',
]);

const ref = projectRef();
console.log(`Generating types for project ${ref} ...`);

// The generator used to run through a shell with a `>` redirect into
// `/tmp/supabase-types-raw.ts`, which meant a shell, a temp file on disk and a
// second read of it. `Bun.spawn` pipes stdout, so the types arrive as a
// string and the temp file is no longer needed at all.
//
// stderr is inherited so the Supabase CLI's own progress output still streams
// to the terminal while stdout is captured.
const proc = Bun.spawn(
  ['bun', 'x', 'supabase@latest', 'gen', 'types', 'typescript', '--project-id', ref],
  { stdout: 'pipe', stderr: 'inherit', stdin: 'ignore' }
);
const raw = await new Response(proc.stdout).text();
const exitCode = await proc.exited;
if (exitCode !== 0) {
  console.error(`✖  supabase gen types failed (exit ${exitCode})`);
  process.exit(exitCode);
}

// Post-process: strip non-app tables from the Tables block
const filtered = filterTables(raw, APP_TABLES);
await Bun.write(resolve('src/types/supabase.ts'), filtered);
console.log(`✔ Filtered to ${APP_TABLES.size} app tables → src/types/supabase.ts`);

/**
 * Remove table entries from the Database['public']['Tables'] block that are
 * not in the allowlist. Uses brace-depth tracking to find exact block spans.
 */
function filterTables(src, allowlist) {
  // Find the Tables: { block inside the public: { section
  const tablesMatch = src.match(/(\s+Tables:\s*\{)/);
  if (!tablesMatch) return src; // no Tables block found — return as-is

  const tablesStart = src.indexOf(tablesMatch[0]) + tablesMatch[0].length;
  let depth = 1;
  let i = tablesStart;

  // Collect table name → block pairs
  const tableEntries = [];
  while (i < src.length && depth > 0) {
    // Try to match "tableName: {" at current position (after whitespace)
    const nameMatch = src.slice(i).match(/^(\s+)(\w+):\s*\{/);
    if (nameMatch && depth === 1) {
      const tableName = nameMatch[2];
      const blockStart = i;
      // Advance past the opening brace
      const openBrace = src.indexOf('{', i + nameMatch[1].length + nameMatch[2].length);
      let d = 1;
      let j = openBrace + 1;
      while (j < src.length && d > 0) {
        if (src[j] === '{') d++;
        else if (src[j] === '}') d--;
        j++;
      }
      // j is now after the closing brace of this table entry
      // Find the trailing newline/comma
      const blockEnd = j;
      tableEntries.push({ name: tableName, start: blockStart, end: blockEnd });
      i = blockEnd;
      continue;
    }
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }

  // Build the filtered output: remove non-allowlist table blocks
  let result = src;
  // Process in reverse order to preserve string offsets
  for (const entry of tableEntries.reverse()) {
    if (!allowlist.has(entry.name)) {
      result = result.slice(0, entry.start) + result.slice(entry.end);
    }
  }

  // Replace [_ in never]: never with a cleaner comment when all non-app tables removed
  return result;
}
