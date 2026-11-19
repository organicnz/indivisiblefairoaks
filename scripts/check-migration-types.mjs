#!/usr/bin/env bun
/**
 * Static migration ↔ generated-type consistency guard.
 *
 * The live check (`check-supabase-types.mjs`) needs SUPABASE_ACCESS_TOKEN and
 * network access, so it cannot run in pre-commit or on a fork PR. This guard
 * reads the checked-in migrations and `src/types/supabase.ts` instead:
 *
 *   - every table created or altered by a migration must be classified in
 *     `scripts/schema-tables.mjs` as either typed (`APP_TABLES`) or explicitly
 *     untyped (`UNTYPED_TABLES`), so a new table cannot silently disappear;
 *   - every `APP_TABLES` entry must exist in both the migrations and the
 *     generated types;
 *   - every column added by a migration to an `APP_TABLES` table must exist in
 *     that table's `Row` type;
 *   - columns that exist only in the generated types are reported too, which
 *     catches a stale file after a column is dropped or renamed.
 *
 * It starts advisory: findings are printed and annotated, but the caller gets
 * exit 0. `--strict` (the default for a direct run) turns them into a failure.
 * The hook and PR job pass `--advisory` until the drift is cleared.
 *
 * Usage:
 *   bun scripts/check-migration-types.mjs             # strict
 *   bun scripts/check-migration-types.mjs --advisory  # never fails on drift
 */
import path from 'node:path';
import { APP_TABLES, UNTYPED_TABLES } from './schema-tables.mjs';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');

/** Read a quoted SQL/TypeScript token, handling doubled quote escapes. */
function skipQuoted(text, start) {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === quote) {
      if (text[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i++;
  }
  return i;
}

/** Find the matching closing delimiter, ignoring delimiters inside quotes. */
function findClosing(text, openIndex, open, close) {
  let depth = 0;
  for (let i = openIndex; i < text.length; ) {
    const ch = text[i];
    if (ch === "'" || ch === '"') {
      i = skipQuoted(text, i);
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/** Split on a delimiter that is not inside parentheses, strings or identifiers. */
function splitTopLevel(text) {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < text.length; ) {
    const ch = text[i];
    if (ch === "'" || ch === '"') {
      i = skipQuoted(text, i);
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  parts.push(text.slice(start));
  return parts;
}

/**
 * Strip SQL comments and split statements without treating a function body as
 * DDL. Dollar-quoted bodies are replaced with a space so a semicolon inside a
 * plpgsql function cannot end the statement early.
 */
export function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let depth = 0;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === '-' && next === '-') {
      i += 2;
      while (i < sql.length && sql[i] !== '\n') i++;
      current += '\n';
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i += 2;
      current += ' ';
      continue;
    }

    if (ch === "'" || ch === '"') {
      const end = skipQuoted(sql, i);
      current += sql.slice(i, end);
      i = end;
      continue;
    }

    if (ch === '$') {
      const tag = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        if (end === -1) break;
        i = end + tag[0].length;
        current += ' ';
        continue;
      }
    }

    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
}

/** Read a column or table identifier from the start of a SQL fragment. */
function readIdentifier(text) {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('"')) {
    let value = '';
    let i = 1;
    while (i < trimmed.length) {
      if (trimmed[i] === '"') {
        if (trimmed[i + 1] === '"') {
          value += '"';
          i += 2;
          continue;
        }
        return value;
      }
      value += trimmed[i];
      i++;
    }
    return value;
  }

  const match = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(trimmed);
  return match ? match[0].toLowerCase() : null;
}

/** Resolve `public.foo`, `"public"."foo"` and unqualified `foo` to a table name. */
function publicTableName(token) {
  const parts = token.match(/"(?:[^"]|"")*"|[^.]+/g) ?? [];
  const names = parts.map((part) =>
    part.startsWith('"') ? part.slice(1, -1).replace(/""/g, '"') : part.toLowerCase()
  );
  if (names.length === 1) return names[0];
  if (names.length === 2 && names[0] === 'public') return names[1];
  return null;
}

function createTableColumns(body) {
  const columns = new Set();
  for (const part of splitTopLevel(body)) {
    const text = part.trim();
    if (!text) continue;
    if (/^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|EXCLUDE|LIKE)\b/i.test(text)) {
      continue;
    }
    const name = readIdentifier(text);
    if (name) columns.add(name);
  }
  return columns;
}

function applyAlterAction(action, columns) {
  let match = action.match(/^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]+)$/i);
  if (match) {
    const name = readIdentifier(match[1]);
    if (
      !name ||
      /^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN|EXCLUDE|TRIGGER|POLICY|RULE|GENERATED)$/i.test(
        name
      )
    ) {
      return;
    }
    columns.add(name);
    return;
  }

  match = action.match(/^DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?([^\s,;]+)/i);
  if (match) {
    const name = readIdentifier(match[1]);
    if (name) columns.delete(name);
    return;
  }

  match = action.match(/^RENAME\s+COLUMN\s+([^\s]+)\s+TO\s+([^\s]+)/i);
  if (match) {
    const from = readIdentifier(match[1]);
    const to = readIdentifier(match[2]);
    if (from && to && columns.delete(from)) columns.add(to);
  }
}

function applyStatement(statement, tables) {
  let match = statement.match(
    /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/i
  );
  if (match) {
    const table = publicTableName(match[1]);
    if (!table) return;
    const open = statement.indexOf('(', match[0].length);
    if (open === -1) return;
    const close = findClosing(statement, open, '(', ')');
    if (close === -1) return;
    tables.set(table, createTableColumns(statement.slice(open + 1, close)));
    return;
  }

  match = statement.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([\s\S]+)$/i);
  if (match) {
    for (const part of splitTopLevel(match[1])) {
      const token = part.trim().split(/\s+/)[0];
      const table = publicTableName(token);
      if (table) tables.delete(table);
    }
    return;
  }

  match = statement.match(
    /^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?([^\s]+)\s+([\s\S]+)$/i
  );
  if (!match) return;
  const table = publicTableName(match[1]);
  if (!table) return;
  const columns = tables.get(table);
  if (!columns) return;
  for (const action of splitTopLevel(match[2])) {
    applyAlterAction(action.trim(), columns);
  }
}

/**
 * Parse migration sources into table → columns.
 *
 * @param {{ path?: string, sql: string }[]} sources
 * @returns {Map<string, Set<string>>}
 */
export function parseMigrationSql(sources) {
  const tables = new Map();
  for (const source of sources) {
    for (const statement of splitSqlStatements(source.sql)) {
      applyStatement(statement, tables);
    }
  }
  return tables;
}

/** Parse the generated `Database['public']['Tables']` block. */
export function parseGeneratedTypes(source) {
  const tables = new Map();
  const tablesMatch = /\bTables:\s*\{/.exec(source);
  if (!tablesMatch) return tables;

  const open = tablesMatch.index + tablesMatch[0].length - 1;
  const close = findClosing(source, open, '{', '}');
  if (close === -1) return tables;
  const body = source.slice(open + 1, close);

  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{/.exec(body.slice(i));
    if (!match) {
      const next = body.indexOf('\n', i);
      if (next === -1) break;
      i = next + 1;
      continue;
    }

    const entryOpen = i + match[0].length - 1;
    const entryClose = findClosing(body, entryOpen, '{', '}');
    if (entryClose === -1) break;
    const entryBody = body.slice(entryOpen + 1, entryClose);
    const rowMatch = /\bRow:\s*\{/.exec(entryBody);
    const columns = new Set();
    if (rowMatch) {
      const rowOpen = rowMatch.index + rowMatch[0].length - 1;
      const rowClose = findClosing(entryBody, rowOpen, '{', '}');
      if (rowClose !== -1) {
        for (const line of entryBody.slice(rowOpen + 1, rowClose).split('\n')) {
          const field = /^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:/.exec(line);
          if (field) columns.add(field[1]);
        }
      }
    }
    tables.set(match[1], columns);
    i = entryClose + 1;
  }

  return tables;
}

function sorted(set) {
  return [...set].sort();
}

/** Compare parsed migration tables with parsed generated types. */
export function compareMigrationTypes({
  migrationTables,
  typeTables,
  appTables = APP_TABLES,
  untypedTables = UNTYPED_TABLES,
}) {
  const findings = {
    missingMigrations: [],
    missingTypeTables: [],
    missingTypeColumns: [],
    staleTypeColumns: [],
    unclassifiedTables: [],
    extraTypeTables: [],
    staleUntypedTables: [],
    overlappingTables: [],
  };

  for (const table of sorted(appTables)) {
    if (!migrationTables.has(table)) findings.missingMigrations.push(table);
    if (!typeTables.has(table)) findings.missingTypeTables.push(table);

    if (migrationTables.has(table) && typeTables.has(table)) {
      const migrated = migrationTables.get(table);
      const typed = typeTables.get(table);
      for (const column of sorted(migrated)) {
        if (!typed.has(column)) findings.missingTypeColumns.push(`${table}.${column}`);
      }
      for (const column of sorted(typed)) {
        if (!migrated.has(column)) findings.staleTypeColumns.push(`${table}.${column}`);
      }
    }
  }

  for (const table of migrationTables.keys()) {
    if (!appTables.has(table) && !untypedTables.has(table)) {
      findings.unclassifiedTables.push(table);
    }
  }

  for (const table of typeTables.keys()) {
    if (!appTables.has(table)) findings.extraTypeTables.push(table);
  }

  for (const table of untypedTables) {
    if (!migrationTables.has(table)) findings.staleUntypedTables.push(table);
    if (appTables.has(table)) findings.overlappingTables.push(table);
  }

  for (const key of Object.keys(findings)) findings[key].sort();
  return findings;
}

function findingCount(findings) {
  return Object.values(findings).reduce((total, values) => total + values.length, 0);
}

function printFindings(findings, advisory, log, error) {
  const total = findingCount(findings);
  if (total === 0) return;

  const out = advisory ? log : error;
  out('');
  out(
    advisory
      ? `⚠  Migration ↔ type drift: ${total} finding${total === 1 ? '' : 's'} (advisory — not blocking).`
      : `✖  Migration ↔ type drift: ${total} finding${total === 1 ? '' : 's'}.`
  );

  const groups = [
    ['APP_TABLES entries with no CREATE TABLE in migrations:', findings.missingMigrations],
    ['APP_TABLES entries missing from src/types/supabase.ts:', findings.missingTypeTables],
    [
      'Migration tables not classified in APP_TABLES or UNTYPED_TABLES:',
      findings.unclassifiedTables,
    ],
    ['Generated-type tables not in APP_TABLES:', findings.extraTypeTables],
    ['Columns in migrations missing from src/types/supabase.ts:', findings.missingTypeColumns],
    ['Columns in src/types/supabase.ts but not in migrations:', findings.staleTypeColumns],
    ['UNTYPED_TABLES entries with no migration:', findings.staleUntypedTables],
    ['Tables in both APP_TABLES and UNTYPED_TABLES:', findings.overlappingTables],
  ];

  for (const [label, values] of groups) {
    if (values.length === 0) continue;
    out(`  ${label}`);
    for (const value of values) out(`    ${value}`);
  }

  out('');
  out('  Run `bun run types:generate` (needs SUPABASE_ACCESS_TOKEN) and commit');
  out('  src/types/supabase.ts. New tables must be classified in');
  out('  scripts/schema-tables.mjs; tables intentionally outside generated types');
  out('  belong in UNTYPED_TABLES with a reason.');
  if (advisory) {
    out('::warning::Migration/type consistency is advisory in this run.');
  }
}

async function readMigrationSources(root) {
  const directory = path.join(root, 'supabase/migrations');
  const glob = new Bun.Glob('*.sql');
  const names = [];
  for await (const name of glob.scan({ cwd: directory })) names.push(name);
  names.sort();
  if (names.length === 0) throw new Error(`No migrations found in ${directory}`);

  const sources = [];
  for (const name of names) {
    sources.push({
      path: path.join('supabase/migrations', name),
      sql: await Bun.file(path.join(directory, name)).text(),
    });
  }
  return sources;
}

/**
 * @param {object} [options]
 * @param {string} [options.root] Project root containing supabase/ and src/.
 * @param {boolean} [options.advisory] Return 0 after printing findings.
 * @param {Set<string>} [options.appTables]
 * @param {Set<string>} [options.untypedTables]
 * @param {(message: string) => void} [options.log]
 * @param {(message: string) => void} [options.error]
 * @returns {Promise<number>} Process exit code.
 */
export async function main({
  root = PROJECT_ROOT,
  advisory = false,
  appTables = APP_TABLES,
  untypedTables = UNTYPED_TABLES,
  log = console.log,
  error = console.error,
} = {}) {
  try {
    const sources = await readMigrationSources(root);
    const migrationTables = parseMigrationSql(sources);
    const typeSource = await Bun.file(path.join(root, 'src/types/supabase.ts')).text();
    const typeTables = parseGeneratedTypes(typeSource);
    const findings = compareMigrationTypes({
      migrationTables,
      typeTables,
      appTables,
      untypedTables,
    });

    if (findingCount(findings) === 0) {
      log(
        `✔  Static schema/types guard: ${appTables.size} app tables, ` +
          `${untypedTables.size} explicit untyped tables and ${sources.length} migrations agree.`
      );
      return 0;
    }

    printFindings(findings, advisory, log, error);
    return advisory ? 0 : 1;
  } catch (cause) {
    error(`✖  Static schema/types guard could not run: ${cause.message}`);
    error('   This is a check failure, not a clean result.');
    return 1;
  }
}

if (process.argv[1]?.endsWith('check-migration-types.mjs')) {
  process.exit(await main({ advisory: process.argv.includes('--advisory') }));
}
