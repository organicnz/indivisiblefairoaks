#!/usr/bin/env bun
/**
 * SQL: new tables must have RLS enabled.
 *
 * Every new CREATE TABLE in a migration must be followed by
 * ALTER TABLE <name> ENABLE ROW LEVEL SECURITY within the same file.
 * Tables without RLS expose all rows to the anon/authenticated roles.
 */

const files = process.argv.slice(2);
const violations = [];

for (const file of files) {
  let content;
  try {
    content = await Bun.file(file).text();
  } catch {
    continue;
  }

  const tableRegex = /CREATE TABLE (IF NOT EXISTS )?([a-z_".]+)/gi;
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    let table = match[2].replace(/"/g, '');
    table = table.replace(/^.*\./, '');

    const rlsRegex = new RegExp(
      `ALTER TABLE.*${table}.*ENABLE ROW LEVEL SECURITY|ENABLE ROW LEVEL SECURITY.*${table}`,
      'i'
    );
    if (!rlsRegex.test(content)) {
      violations.push(`  ${file} → table: ${table}`);
    }
  }
}

if (violations.length > 0) {
  console.log('');
  console.log('✖  New table(s) missing ENABLE ROW LEVEL SECURITY:');
  for (const v of violations) console.log(v);
  console.log('');
  console.log('   Every table must explicitly enable RLS, even if no policies are');
  console.log('   added yet. Add to the migration:');
  console.log('   ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;');
  console.log('');
  console.log('   Bypass: LEFTHOOK_EXCLUDE=rls-table-guard git commit');
  console.log('');
  process.exit(1);
}
