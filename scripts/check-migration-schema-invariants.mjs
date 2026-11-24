#!/usr/bin/env bun
/**
 * Schema invariants, checked over the migration SQL the change introduces.
 * Token-free, network-free, database-free.
 *
 *   BASE_MIGRATIONS_DIR=../trusted/supabase/migrations \
 *     bun scripts/check-migration-schema-invariants.mjs
 *
 * ## Why this exists
 *
 * `check-schema-hygiene.mjs` reads `pg_catalog` on the hosted project, so it can
 * only see a problem **after** the migration has been applied — and it runs
 * after the `Supabase` workflow, which means the finding arrives when the change
 * is already live. Its three catalogue invariants are properties of the SQL that
 * created them, though, and all three are decidable from the text:
 *
 *   1. **No index duplicates or is covered by another.** A composite btree
 *      serves every lookup its leading columns serve, so a narrower non-unique
 *      index beside a wider one is dead weight on every write.
 *   2. **Every foreign key has a leading index.** The live check asks
 *      `pg_index.indkey[0] = pg_constraint.conkey[1]` — the *first* FK column
 *      must be the leading column of some index. A static check can ask the
 *      same question of the final migration state.
 *   3. **No public role holds a privilege RLS cannot govern.** `GRANT ALL`
 *      includes `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN`, none of
 *      which any policy can filter. This is the class `crm_direct_email_sends`
 *      shipped with: the table had policies, so the policy count looked right,
 *      and the grant outlived them.
 *
 * ## How it decides "introduced by this change"
 *
 * The whole migration history is replayed in filename order into a small model
 * of tables, indexes, foreign keys and privileges — `CREATE`, `ALTER …
 * ADD/DROP`, `DROP INDEX`, `DROP TABLE`, `GRANT`, `REVOKE`. The invariants are
 * then evaluated over the **final** state, so a migration that adds an index
 * and a later one that drops it does not leave a phantom, and a `REVOKE` retires
 * an earlier `GRANT ALL`. Primary-key and `UNIQUE` constraints are modelled as
 * the indexes Postgres builds for them, because they lead a foreign key just as
 * an explicit index does. A finding is reported only when the object it
 * names is defined in a file this change adds or edits, compared against the
 * base branch by content hash. That is what keeps the guard green on legacy
 * state and red on the PR that introduces the problem.
 *
 * ## What it deliberately does NOT do
 *
 *   - **Read a database.** A reference to a table that does not exist passes
 *     here and fails on apply; that is `check-migration-sql.mjs`'s structural
 *     job, not this one.
 *   - **Resolve quoted identifiers.** `sanitizeSql` blanks them, so a statement
 *     that quotes a table or column is treated as unparseable and contributes
 *     no facts. Unquoted identifiers (which Postgres lowercases anyway) are the
 *     supported form; this file says so rather than guessing.
 *   - **Handle `RENAME`, `SET SCHEMA`, partitioned indexes, or an index built
 *     from an expression.** Expression indexes are excluded from the prefix
 *     comparison exactly as the live check excludes them (`indkey` cannot
 *     represent them faithfully), and partial indexes are excluded from it too
 *     (`indpred IS NULL`), because a predicate makes a narrower index cheaper
 *     rather than redundant. A partial index still counts as leading coverage
 *     for a foreign key, matching the live query.
 *
 * ## Intentional findings
 *
 * The same shape as `check-migration-sql.mjs`: a file that must keep a finding
 * opts out in a real comment.
 *
 *     -- allow-schema-finding: the covering index lands in the next release
 *
 * It is read from comments only, so the marker inside a string does nothing.
 */

import { join } from 'node:path';
import { contentHash, listMigrations } from './check-migration-immutability.mjs';
import { lineAt, sanitizeSql, splitStatements } from './check-migration-sql.mjs';
import { RLS_UNCOVERABLE_PRIVILEGES } from './check-schema-hygiene.mjs';

const notice = (m) => console.log(`::notice::${m}`);
const error = (m) => console.log(`::error::${m}`);
const warn = (m) => console.log(`::warning::${m}`);

/** Roles whose privileges row-level security has to govern. */
const PUBLIC_ROLES = ['anon', 'authenticated', 'public'];

/**
 * What `GRANT ALL` expands to. Stored expanded rather than as a sentinel so a
 * later `REVOKE TRUNCATE` can retire exactly that privilege, which is how the
 * hosted project ended up with DML-only grants on tables whose migrations said
 * `GRANT ALL`.
 */
const ALL_PRIVILEGES = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
  'REFERENCES',
  'TRIGGER',
  'MAINTAIN',
];

const ALLOW_FINDING = /^[ \t]*\*?[ \t]*allow-schema-finding:[ \t]*(\S[^\n]*)/im;

/**
 * @typedef {{ name: string, table: string, columns: string[] | null, unique: boolean, partial: boolean, file: string, line: number }} IndexFact
 * @typedef {{ name: string, table: string, columns: string[], file: string, line: number }} ForeignKeyFact
 * @typedef {{ table: string, role: string, privileges: Set<string>, file: string, line: number }} PrivilegeFact
 */

/** A quoted identifier was blanked by `sanitizeSql`; treat the statement as unparseable. */
const hasQuotedIdentifier = (text) => text.includes('"');

/** `public.foo` and `foo` are the same table; `auth.users` is not ours. */
function normalizeTable(raw) {
  const name = raw.replace(/"/g, '').trim().toLowerCase();
  return name.replace(/^public\./, '');
}

function isOurs(raw) {
  const name = raw.replace(/"/g, '').trim().toLowerCase();
  return !name.includes('.') || name.startsWith('public.');
}

function matchingParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split on commas that are not inside parentheses. */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '(') depth++;
    else if (body[i] === ')') depth--;
    else if (body[i] === ',' && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

/**
 * Column names in an index key or FK list, or `null` when the list cannot be
 * read as plain columns (an expression, a quoted identifier, an opclass that
 * contains punctuation).
 *
 * @param {string} body
 * @returns {string[] | null}
 */
function parseColumns(body) {
  if (hasQuotedIdentifier(body)) return null;
  const columns = [];
  for (const raw of splitTopLevel(body)) {
    const part = raw.trim();
    if (!part) continue;
    // `lower(name)`, `(a || b)` and similar are expressions, not columns.
    if (part.includes('(')) return null;
    const match = /^([A-Za-z_][A-Za-z0-9_$]*)/.exec(part);
    if (!match) return null;
    columns.push(match[1].toLowerCase());
  }
  return columns.length > 0 ? columns : null;
}

const CREATE_TABLE =
  /^create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)\s*\(/i;
const CREATE_INDEX =
  /^create\s+(unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([^\s(]+)\s+on\s+(?:only\s+)?([^\s(]+)\s*(?:using\s+[A-Za-z_][A-Za-z0-9_]*\s*)?\(/i;
const ALTER_TABLE = /^alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?([^\s]+)\s+([\s\S]+)$/i;
const DROP_INDEX = /^drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?([\s\S]+)$/i;
const DROP_TABLE = /^drop\s+table\s+(?:if\s+exists\s+)?([\s\S]+)$/i;
const GRANT = /^grant\s+([\s\S]+?)\s+on\s+([\s\S]+?)\s+to\s+([\s\S]+?)(?:\s+with\s+grant\s+option)?$/i;
const REVOKE = /^revoke\s+(?:grant\s+option\s+for\s+)?([\s\S]+?)\s+on\s+([\s\S]+?)\s+from\s+([\s\S]+)$/i;

const splitNames = (list) =>
  list
    .split(',')
    .map((name) => name.trim().split(/\s+/)[0])
    .filter(Boolean)
    .map(normalizeTable);

/**
 * Replay the migrations into a final-state model.
 *
 * Later statements win: a drop removes what an earlier create added, so the
 * model describes what the schema is after the last migration rather than what
 * each file said in isolation.
 *
 * @param {{ file: string, sql: string }[]} migrations
 */
export function buildSchemaState(migrations) {
  /** @type {Map<string, {file: string, line: number}>} */
  const tables = new Map();
  /** @type {Map<string, IndexFact>} */
  const indexes = new Map();
  /** @type {Map<string, ForeignKeyFact>} */
  const foreignKeys = new Map();
  /** @type {Map<string, { table: string, role: string, privileges: Set<string>, file: string, line: number }>} */
  const privileges = new Map();

  /** A `PRIMARY KEY` / `UNIQUE` constraint is backed by an index Postgres builds. */
  const addUniqueIndex = (table, columns, name, file, line) => {
    if (!columns) return;
    indexes.set(`${table}:${name}`, {
      name,
      table,
      columns,
      unique: true,
      partial: false,
      file,
      line,
    });
  };

  const addForeignKey = (fact) => {
    foreignKeys.set(`${fact.table}:${fact.name}`, fact);
  };

  for (const { file, sql } of migrations) {
    const { sanitized } = sanitizeSql(sql);

    for (const statement of splitStatements(sanitized)) {
      const text = statement.text.trim();
      if (!text) continue;
      const line = lineAt(sanitized, statement.offset + statement.text.length - statement.text.trimStart().length);

      // ── CREATE TABLE ────────────────────────────────────────────────────
      const table = CREATE_TABLE.exec(text);
      if (table) {
        if (!isOurs(table[1])) continue;
        const name = normalizeTable(table[1]);
        tables.set(name, { file, line });
        const open = text.indexOf('(', table[0].length - 1);
        const close = matchingParen(text, open);
        if (close === -1) continue;
        const body = text.slice(open + 1, close);
        for (const definition of splitTopLevel(body)) {
          const def = definition.trim();
          if (!def) continue;

          // Table-level FOREIGN KEY.
          const tableLevel =
            /^(?:constraint\s+([A-Za-z_][A-Za-z0-9_$]*)\s+)?foreign\s+key\s*\(([\s\S]*?)\)\s*references/i.exec(
              def
            );
          if (tableLevel) {
            const columns = parseColumns(tableLevel[2]);
            if (!columns) continue;
            addForeignKey({
              name: tableLevel[1] ?? `${name}_${columns.join('_')}_fkey`,
              table: name,
              columns,
              file,
              line,
            });
            continue;
          }

          // Table-level PRIMARY KEY / UNIQUE. Postgres builds an index for each,
          // and that index leads a foreign key on its first column — which is
          // exactly what the live check counts.
          const tableConstraint =
            /^(?:constraint\s+([A-Za-z_][A-Za-z0-9_$]*)\s+)?(primary\s+key|unique)\s*\(([\s\S]*?)\)/i.exec(
              def
            );
          if (tableConstraint) {
            const columns = parseColumns(tableConstraint[3]);
            const primary = /^primary/i.test(tableConstraint[2]);
            addUniqueIndex(
              name,
              columns,
              tableConstraint[1] ??
                (primary ? `${name}_pkey` : `${name}_${(columns ?? []).join('_')}_key`),
              file,
              line
            );
            continue;
          }
          if (/^(check|exclude|like)\b/i.test(def)) continue;

          // A column definition. `REFERENCES` makes a single-column foreign key;
          // `PRIMARY KEY` / `UNIQUE` makes an index that can lead one.
          const column = /^([A-Za-z_][A-Za-z0-9_$]*)\s+([\s\S]*)$/.exec(def);
          if (!column) continue;
          const columnName = column[1].toLowerCase();
          const rest = column[2];
          const primary = /\bprimary\s+key\b/i.test(rest);
          if (primary || /(^|\s)unique\b/i.test(rest)) {
            addUniqueIndex(
              name,
              [columnName],
              primary ? `${name}_pkey` : `${name}_${columnName}_key`,
              file,
              line
            );
          }
          if (/\breferences\b/i.test(rest)) {
            addForeignKey({
              name: `${name}_${columnName}_fkey`,
              table: name,
              columns: [columnName],
              file,
              line,
            });
          }
        }
        continue;
      }

      // ── CREATE INDEX ────────────────────────────────────────────────────
      const index = CREATE_INDEX.exec(text);
      if (index) {
        if (!isOurs(index[3])) continue;
        const tableName = normalizeTable(index[3]);
        const open = text.indexOf('(', index[0].length - 1);
        const close = matchingParen(text, open);
        if (close === -1) continue;
        const columns = parseColumns(text.slice(open + 1, close));
        const rest = text.slice(close + 1);
        indexes.set(`${tableName}:${normalizeTable(index[2])}`, {
          name: normalizeTable(index[2]),
          table: tableName,
          columns,
          unique: Boolean(index[1]),
          partial: /^\s*where\b/i.test(rest),
          file,
          line,
        });
        continue;
      }

      // ── ALTER TABLE ─────────────────────────────────────────────────────
      const alter = ALTER_TABLE.exec(text);
      if (alter) {
        if (!isOurs(alter[1])) continue;
        const tableName = normalizeTable(alter[1]);
        const action = alter[2].trim();

        const addConstraint =
          /^add\s+(?:constraint\s+([A-Za-z_][A-Za-z0-9_$]*)\s+)?foreign\s+key\s*\(([\s\S]*?)\)\s*references/i.exec(
            action
          );
        if (addConstraint) {
          const columns = parseColumns(addConstraint[2]);
          if (columns) {
            addForeignKey({
              name: addConstraint[1] ?? `${tableName}_${columns.join('_')}_fkey`,
              table: tableName,
              columns,
              file,
              line,
            });
          }
          continue;
        }

        const addKey =
          /^add\s+(?:constraint\s+([A-Za-z_][A-Za-z0-9_$]*)\s+)?(primary\s+key|unique)\s*\(([\s\S]*?)\)/i.exec(
            action
          );
        if (addKey) {
          const columns = parseColumns(addKey[3]);
          const primary = /^primary/i.test(addKey[2]);
          addUniqueIndex(
            tableName,
            columns,
            addKey[1] ??
              (primary ? `${tableName}_pkey` : `${tableName}_${(columns ?? []).join('_')}_key`),
            file,
            line
          );
          continue;
        }

        const addColumn =
          /^add\s+column\s+(?:if\s+not\s+exists\s+)?([A-Za-z_][A-Za-z0-9_$]*)\s+[\s\S]*\breferences\b/i.exec(
            action
          );
        if (addColumn) {
          addForeignKey({
            name: `${tableName}_${addColumn[1].toLowerCase()}_fkey`,
            table: tableName,
            columns: [addColumn[1].toLowerCase()],
            file,
            line,
          });
          continue;
        }

        const dropConstraint = /^drop\s+constraint\s+(?:if\s+exists\s+)?([A-Za-z_][A-Za-z0-9_$]*)/i.exec(
          action
        );
        if (dropConstraint) {
          foreignKeys.delete(`${tableName}:${dropConstraint[1].toLowerCase()}`);
          continue;
        }

        const dropColumn = /^drop\s+column\s+(?:if\s+exists\s+)?([A-Za-z_][A-Za-z0-9_$]*)/i.exec(
          action
        );
        if (dropColumn) {
          const column = dropColumn[1].toLowerCase();
          for (const [key, fact] of indexes) {
            if (fact.table === tableName && fact.columns?.includes(column)) indexes.delete(key);
          }
          for (const [key, fact] of foreignKeys) {
            if (fact.table === tableName && fact.columns.includes(column)) foreignKeys.delete(key);
          }
        }
        continue;
      }

      // ── DROP INDEX / DROP TABLE ─────────────────────────────────────────
      const dropIndex = DROP_INDEX.exec(text);
      if (dropIndex) {
        for (const name of splitNames(dropIndex[1])) {
          for (const [key, fact] of indexes) {
            if (fact.name === name) indexes.delete(key);
          }
        }
        continue;
      }

      const dropTable = DROP_TABLE.exec(text);
      if (dropTable) {
        for (const name of splitNames(dropTable[1].replace(/\s+(cascade|restrict)$/i, ''))) {
          tables.delete(name);
          for (const [key, fact] of indexes) if (fact.table === name) indexes.delete(key);
          for (const [key, fact] of foreignKeys) if (fact.table === name) foreignKeys.delete(key);
        }
        continue;
      }

      // ── GRANT / REVOKE ──────────────────────────────────────────────────
      const grant = GRANT.exec(text);
      const revoke = grant ? null : REVOKE.exec(text);
      const privilegeStatement = grant ?? revoke;
      if (privilegeStatement) {
        const privilegeList = privilegeStatement[1]
          .split(',')
          .map((p) => p.trim().toUpperCase())
          .filter(Boolean);
        const target = privilegeStatement[2].trim();
        const roles = privilegeStatement[3]
          .split(',')
          .map((role) => normalizeTable(role))
          .filter(Boolean);
        const grantsAll = privilegeList.some((p) => p === 'ALL' || p === 'ALL PRIVILEGES');
        const expanded = grantsAll ? ALL_PRIVILEGES : privilegeList;

        const schemaWide = /^all\s+tables\s+in\s+schema\s+([^\s]+)$/i.exec(target);
        /** @type {string[]} */
        let targets;
        if (schemaWide) {
          if (!isOurs(schemaWide[1])) continue;
          targets = [...tables.keys()];
        } else {
          const name = normalizeTable(target.replace(/^table\s+/i, ''));
          // A statement naming something that is not a table here (a sequence,
          // a function, a typo) is not one of these invariants; the live check
          // reads the catalogue and would not see it either.
          if (!tables.has(name)) continue;
          targets = [name];
        }

        for (const tableName of targets) {
          for (const role of roles) {
            const key = `${tableName}:${role}`;
            const entry = privileges.get(key);
            if (revoke) {
              if (!entry) continue;
              if (grantsAll) {
                privileges.delete(key);
              } else {
                for (const privilege of expanded) entry.privileges.delete(privilege);
                if (entry.privileges.size === 0) privileges.delete(key);
              }
              continue;
            }
            const current = entry ?? {
              table: tableName,
              role,
              privileges: new Set(),
              file,
              line,
            };
            for (const privilege of expanded) current.privileges.add(privilege);
            current.file = file;
            current.line = line;
            privileges.set(key, current);
          }
        }
      }
    }
  }

  return { tables, indexes, foreignKeys, privileges };
}

/**
 * Indexes whose columns are duplicated, or covered by a wider index's leading
 * columns — the same comparison `findRedundantIndexes` makes from `pg_index`,
 * with the same exclusions.
 *
 * @param {IndexFact[]} facts
 * @returns {{ fact: IndexFact, against: IndexFact, kind: 'identical' | 'prefix' }[]}
 */
export function findRedundantIndexes(facts) {
  const byTable = new Map();
  for (const fact of facts) {
    if (!fact.columns || fact.partial) continue;
    if (!byTable.has(fact.table)) byTable.set(fact.table, []);
    byTable.get(fact.table).push(fact);
  }

  const findings = [];
  for (const table of [...byTable.keys()].sort()) {
    const list = byTable
      .get(table)
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const same =
          a.columns.length === b.columns.length &&
          a.columns.every((c, k) => c === b.columns[k]);
        if (same) {
          // Two unique indexes each enforce their constraint; neither is dead.
          if (a.unique && b.unique) continue;
          const redundant = a.unique ? b : a;
          findings.push({ fact: redundant, against: redundant === a ? b : a, kind: 'identical' });
          continue;
        }
        const prefix = (short, long) =>
          short.columns.length < long.columns.length &&
          short.columns.every((c, k) => c === long.columns[k]);
        if (!a.unique && prefix(a, b)) {
          findings.push({ fact: a, against: b, kind: 'prefix' });
        } else if (!b.unique && prefix(b, a)) {
          findings.push({ fact: b, against: a, kind: 'prefix' });
        }
      }
    }
  }
  return findings;
}

/**
 * Foreign keys with no index whose leading column is the FK's first column.
 *
 * @param {ForeignKeyFact[]} facts
 * @param {IndexFact[]} indexes
 */
export function findUnindexedForeignKeys(facts, indexes) {
  const leading = new Set(
    indexes.filter((i) => i.columns).map((i) => `${i.table}:${i.columns[0]}`)
  );
  return facts.filter((fact) => !leading.has(`${fact.table}:${fact.columns[0]}`));
}

/**
 * Grants to a public role of a privilege RLS cannot govern. `ALL` covers them
 * all, which is why it is named explicitly rather than expanded.
 *
 * @param {GrantFact[]} facts
 */
export function findUngovernedGrants(entries) {
  return entries.filter(
    (entry) =>
      PUBLIC_ROLES.includes(entry.role) &&
      [...entry.privileges].some((p) => RLS_UNCOVERABLE_PRIVILEGES.includes(p))
  );
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<number>} process exit code
 */
export async function main(env = Bun.env) {
  const currentDir = env.MIGRATIONS_DIR ?? 'supabase/migrations';
  const baseDir = env.BASE_MIGRATIONS_DIR ?? '';

  if (!baseDir) {
    error('BASE_MIGRATIONS_DIR is not set — point it at the base branch checkout.');
    error('Refusing to pass without knowing which migrations this change introduces.');
    return 1;
  }

  const base = await listMigrations(baseDir);
  if (!base) {
    error(`No base migrations directory at ${baseDir}.`);
    error('Refusing a vacuous pass: the comparison needs the base checkout.');
    return 1;
  }

  const current = await listMigrations(currentDir);
  if (!current) {
    error(`No migrations directory at ${currentDir}.`);
    return 1;
  }

  const baseHashes = new Map();
  for (const file of base) baseHashes.set(file, await contentHash(join(baseDir, file)));

  const changed = new Set();
  for (const file of current) {
    const before = baseHashes.get(file);
    if (before === undefined || before !== (await contentHash(join(currentDir, file)))) {
      changed.add(file);
    }
  }

  if (changed.size === 0) {
    notice('No changed migrations to check.');
    return 0;
  }

  const migrations = [];
  for (const file of current) {
    migrations.push({ file, sql: await Bun.file(join(currentDir, file)).text() });
  }
  const state = buildSchemaState(migrations);

  const findings = [];

  for (const { fact, against, kind } of findRedundantIndexes([...state.indexes.values()])) {
    if (!changed.has(fact.file) && !changed.has(against.file)) continue;
    const introduced = changed.has(fact.file) ? fact : against;
    findings.push({
      file: introduced.file,
      line: introduced.line,
      message: `${fact.table}: index ${fact.name}(${fact.columns.join(', ')}) is ${
        kind === 'identical' ? 'identical to' : 'a prefix of'
      } ${against.name}(${against.columns.join(', ')}) — the wider index serves every lookup it does`,
    });
  }

  for (const fact of findUnindexedForeignKeys(
    [...state.foreignKeys.values()],
    [...state.indexes.values()]
  )) {
    if (!changed.has(fact.file)) continue;
    findings.push({
      file: fact.file,
      line: fact.line,
      message: `${fact.table}(${fact.columns.join(', ')}) — foreign key ${fact.name} has no index leading with ${fact.columns[0]}`,
    });
  }

  for (const fact of findUngovernedGrants([...state.privileges.values()])) {
    if (!changed.has(fact.file)) continue;
    const held = [...fact.privileges]
      .filter((p) => RLS_UNCOVERABLE_PRIVILEGES.includes(p))
      .sort();
    findings.push({
      file: fact.file,
      line: fact.line,
      message: `${fact.table}: ${held.join(', ')} granted to ${fact.role} — row-level security does not govern ${
        held.length === 1 ? 'this privilege' : 'these privileges'
      }`,
    });
  }

  if (findings.length === 0) {
    notice(
      `${changed.size} changed migration(s) checked; no redundant index, unindexed foreign key or ungovernable grant.`
    );
    return 0;
  }

  // Read the opt-out from each file once, so a marker in one file cannot
  // silence a finding in another.
  const allowances = new Map();
  for (const { file, sql } of migrations) {
    if (!changed.has(file)) continue;
    const { comments } = sanitizeSql(sql);
    for (const comment of comments) {
      const match = ALLOW_FINDING.exec(comment);
      if (match) {
        allowances.set(file, match[1].trim());
        break;
      }
    }
  }

  findings.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
  let failures = 0;
  for (const finding of findings) {
    const where = `${finding.file}:${finding.line}: ${finding.message}`;
    const allow = allowances.get(finding.file);
    if (allow) {
      warn(`${where} — allowed: ${allow}`);
    } else {
      error(`${where}. If this is intentional, add "-- allow-schema-finding: <reason>" to the migration.`);
      failures++;
    }
  }

  if (failures > 0) {
    error(
      `${failures} schema invariant(s) violated in ${changed.size} changed migration(s). ` +
        'Nothing here ran against a database; fix the SQL or record why the finding is intended.'
    );
    return 1;
  }

  notice(`${findings.length} finding(s) allowed in ${changed.size} changed migration(s).`);
  return 0;
}

const invokedDirectly = process.argv[1]?.endsWith('check-migration-schema-invariants.mjs');
if (invokedDirectly) {
  process.exit(await main());
}
