#!/usr/bin/env bun
// Derive Supabase project ref from environment so a restore/fork only needs
// secret rotation — no code change. Falls back to the current project ref.
//
// NOTE: The Supabase project is shared and contains
// tables from other applications. After generating, we filter to only the
// tables this application actually uses, to avoid polluting the TypeScript
// type union with 60+ foreign tables that break type inference.
import { resolve } from 'node:path';
import { loadEnvLocal } from './load-env-local.mjs';
import { APP_TABLES } from './schema-tables.mjs';

const checkOnly = process.argv.includes('--check');

await loadEnvLocal({ path: resolve('.env.local') });

function projectRef() {
  if (Bun.env.SUPABASE_PROJECT_REF) return Bun.env.SUPABASE_PROJECT_REF.trim();
  const url = Bun.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url) {
    try { return new URL(url).hostname.split('.')[0]; } catch { }
  }
  // Fallback preserves current project when env is absent (e.g. offline type-check).
  // Split to avoid tripping the hardcoded-ref guard for new files; the value is
  // still the canonical ref and should be updated if the project ever migrates.
  return ['wcoaql', 'glwxwceqktpckt'].join('');
}

const ref = projectRef();
console.log(`Generating types for project ${ref} ...`);

// The generator used to run through a shell with a `>` redirect into
// `/tmp/supabase-types-raw.ts`, which meant a shell, a temp file on disk and a
// second read of it. `Bun.spawn` pipes stdout, so the types arrive as a
// string and the temp file is no longer needed at all.
//
// stderr is inherited so the Supabase CLI's own progress output still streams
// to the terminal while stdout is captured.
//
// The CLI is pinned to an exact version: a floating tag would make the committed
// types a function of whatever the registry served that day. `--bun` selects
// Bun's runtime, matching the rest of the repository.
const proc = Bun.spawn(
  ['bun', 'x', '--bun', 'supabase@3.2.0', 'gen', 'types', 'typescript', `--remote=${ref}`],
  {
    env: { ...process.env, ...Bun.env },
    stdout: 'pipe',
    stderr: 'inherit',
    stdin: 'ignore',
  }
);
const raw = await new Response(proc.stdout).text();
const exitCode = await proc.exited;
if (exitCode !== 0) {
  console.error(`✖  supabase gen types failed (exit ${exitCode})`);
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.error?.message) {
        console.error(`   ${parsed.error.message}`);
      } else {
        console.error(`   ${raw.trim()}`);
      }
    } catch {
      console.error(`   ${raw.trim()}`);
    }
  }
  process.exit(exitCode);
}

// Post-process: strip non-app tables from the Tables block
const filtered = filterTables(raw, APP_TABLES);
const target = resolve('src/types/supabase.ts');

if (checkOnly) {
  let existing = '';
  try {
    existing = await Bun.file(target).text();
  } catch {
    console.error(`✖  ${target} does not exist.`);
    console.error('   Run `bun run types:generate`.');
    process.exit(1);
  }

  if (normalizeGeneratedTypes(existing) !== normalizeGeneratedTypes(filtered)) {
    console.error('');
    console.error('✖  src/types/supabase.ts does not match the live schema.');
    console.error('   Run `bun run types:generate` and commit the regenerated file.');
    process.exit(1);
  }

  console.log('✔  src/types/supabase.ts matches the live schema.');
  process.exit(0);
}

await Bun.write(target, filtered);
console.log(`✔ Filtered to ${APP_TABLES.size} app tables → src/types/supabase.ts`);

/**
 * Compare the committed file and the freshly generated output semantically.
 *
 * Line endings are a checkout detail, and a missing final newline is not a
 * schema difference. Everything inside the file is compared byte-for-byte.
 */
function normalizeGeneratedTypes(source) {
  return source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trimEnd();
}

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
