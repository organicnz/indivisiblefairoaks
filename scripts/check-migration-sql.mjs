#!/usr/bin/env bun
/**
 * Static SQL validation for the migrations a change adds or edits.
 * Token-free, network-free, database-free.
 *
 *   BASE_MIGRATIONS_DIR=../trusted/supabase/migrations \
 *     bun scripts/check-migration-sql.mjs
 *
 * ## Why this exists
 *
 * The other schema checks answer questions about *history*: is this version
 * recorded, is an applied file unchanged. None of them reads the SQL. A
 * migration that drops a column, truncates a table or deletes every row is
 * therefore indistinguishable from a safe one until it is applied to a real
 * database — which is the one moment the decision cannot be taken back.
 *
 * This reads the statements this change introduces and fails on the ones that
 * destroy data. It is deliberately static: a live database on every run would
 * make the gate slower, unavailable on a fork PR, and unable to tell "this SQL
 * is destructive" from "this SQL is destructive to *this* project's data".
 *
 * ## What it checks
 *
 *   - **Destructive statements**: `DROP TABLE`, `DROP COLUMN`, `DROP SCHEMA`,
 *     `DROP DATABASE`, `TRUNCATE`, `DELETE FROM` with no `WHERE`, and `UPDATE`
 *     with no `WHERE`. The statement-level rules are anchored to the start of a
 *     statement, because the same words appear harmlessly mid-statement: a
 *     `BEFORE TRUNCATE` trigger event and a `REVOKE TRUNCATE` privilege list
 *     both read like destruction to a substring match. `DROP COLUMN` is matched
 *     in place because it only appears inside `ALTER TABLE`. The DML rules also
 *     read `WITH` statements, where a data-modifying CTE can put an unfiltered
 *     `DELETE` or `UPDATE` behind the CTE definitions; `DO UPDATE` (an upsert
 *     clause) and `FOR UPDATE` (a row lock) are excluded.
 *   - **Structure**: unterminated string, quoted identifier, block comment or
 *     dollar-quoted block, and unbalanced parentheses. These are the faults
 *     that make a migration fail at apply time with an error no history check
 *     can predict.
 *
 * Comments, string literals and dollar-quoted bodies are blanked before the
 * statements are split, so `COMMENT ON … IS 'DROP TABLE x'` and a `-- TRUNCATE`
 * note are not findings. The text of real comments is returned alongside the
 * blanked SQL, so the opt-out below is read from a comment and nowhere else.
 * That also means **SQL inside a dollar-quoted function body is not analysed**
 * — the trade is fewer false positives on the bodies that legitimately contain
 * dynamic SQL.
 *
 * ## Intentional destruction
 *
 * A migration that really must drop something opts out per file:
 *
 *     -- allow-destructive: dropping the abandoned staging table (see #123)
 *
 * The marker turns this file's destructive findings into warnings; structural
 * faults still fail. It is read from real SQL comments only (a `--` comment or
 * a block comment): the same text inside a string literal, a quoted identifier
 * or a dollar-quoted function body does not opt the file out. It lives in the
 * file, so the decision is visible in the diff and in review, rather than in a
 * list somewhere else.
 *
 * ## What it deliberately does NOT catch
 *
 *   - **Whether the SQL is right for this schema.** No catalogue is read; a
 *     reference to a missing column still passes here and fails on apply.
 *   - **Data-dependent danger.** `UPDATE … WHERE old_column IS NULL` may touch
 *     every row, and `DELETE FROM t USING u WHERE …` can still remove every row
 *     of `t`. A `WHERE` in the statement's own scope is the only line a static
 *     check can draw; a `WHERE` inside a subquery is not a filter on the outer
 *     verb's rows.
 *   - **SQL inside dollar-quoted function bodies**, as above.
 *   - **Lock and runtime cost.** `ALTER TABLE … SET NOT NULL` on a large table
 *     can be an outage; that is a planning question, not a text one.
 */

import { join } from 'node:path';
import { contentHash, listMigrations } from './check-migration-immutability.mjs';

const notice = (m) => console.log(`::notice::${m}`);
const error = (m) => console.log(`::error::${m}`);
const warn = (m) => console.log(`::warning::${m}`);

/**
 * Characters that can continue a PostgreSQL identifier. Unicode letters and
 * marks matter here: `café$tag$` is one identifier, not an identifier followed
 * by a dollar-quoted string.
 */
const IDENTIFIER_CHAR = /[A-Za-z0-9_$\p{L}\p{M}\p{N}]/u;

/**
 * Per-file opt-out, matched against a real comment's own text.
 *
 * The marker must begin a comment line, so prose that merely mentions it does
 * not opt the file out; the optional `*` accepts a block comment's decoration.
 * The reason is required.
 */
const ALLOW_DESTRUCTIVE = /^[ \t]*\*?[ \t]*allow-destructive:[ \t]*(\S[^\n]*)/im;

/**
 * Statements that destroy data, with the claim each one makes.
 *
 * `requiresWhere` is for the two DML forms, where the difference between safe
 * and catastrophic is one clause. `requiresSet` keeps `UPDATE` from matching a
 * statement that merely mentions it (`FOR UPDATE`, `GRANT UPDATE`), and
 * `notAfter` excludes the upsert and row-lock forms that put `UPDATE` behind
 * `DO` or `FOR`.
 *
 * The DML rules have a second form for statements that start with `WITH`: a
 * data-modifying CTE is valid SQL and can put several verbs behind the CTE
 * definitions. Matching only at the start would skip them; matching the plain
 * pattern everywhere would fire on DML words in unrelated statements. The
 * `ctePattern` is used only for a `WITH` statement.
 */
const DESTRUCTIVE_RULES = [
  { pattern: /^drop\s+table\b/i, message: 'DROP TABLE destroys a table and every row in it' },
  // `DROP COLUMN` is only ever inside `ALTER TABLE`, so it is matched in place.
  { pattern: /\bdrop\s+column\b/i, message: 'DROP COLUMN destroys a column and its values' },
  { pattern: /^drop\s+schema\b/i, message: 'DROP SCHEMA destroys every object in the schema' },
  { pattern: /^drop\s+database\b/i, message: 'DROP DATABASE is not a migration step' },
  { pattern: /^truncate\b/i, message: 'TRUNCATE removes every row' },
  {
    pattern: /^delete\s+from\b/i,
    ctePattern: /\bdelete\s+from\b/i,
    message: 'DELETE without WHERE removes every row',
    requiresWhere: true,
  },
  {
    pattern: /^update\b/i,
    ctePattern: /\bupdate\b/i,
    message: 'UPDATE without WHERE rewrites every row',
    requiresWhere: true,
    requiresSet: true,
    // `… DO UPDATE SET` is an upsert clause and `… FOR UPDATE` / `… FOR NO KEY
    // UPDATE` are row locks; none of them updates the table the way a top-level
    // UPDATE does.
    notAfter: /\b(?:do|for(?:\s+no\s+key)?)$/i,
  },
];

/** 1-based line number for an offset in `text`. */
export function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

/**
 * Blank comments, string literals, quoted identifiers and dollar-quoted
 * bodies, preserving every newline so offsets still map to source lines.
 *
 * This is the whole reason the rules can be regexes: once the prose and the
 * data are gone, `drop table` in the remaining text is a statement, not a
 * sentence.
 *
 * Real comments are collected separately, so a caller can read a directive
 * from them without mistaking text that was blanked inside a string or body.
 *
 * @param {string} sql
 * @returns {{
 *   sanitized: string,
 *   problems: { line: number, message: string }[],
 *   comments: string[],
 * }}
 */
export function sanitizeSql(sql) {
  const out = [];
  const problems = [];
  const comments = [];
  let i = 0;

  const copy = (ch) => out.push(ch);
  const blank = (ch) => out.push(ch === '\n' ? '\n' : ' ');

  while (i < sql.length) {
    const ch = sql[i];

    // Line comment.
    if (ch === '-' && sql[i + 1] === '-') {
      const start = i + 2;
      while (i < sql.length && sql[i] !== '\n') {
        blank(sql[i]);
        i++;
      }
      comments.push(sql.slice(start, i));
      continue;
    }

    // Block comment. Postgres allows them nested, so depth is tracked rather
    // than scanning for the first `*/`.
    if (ch === '/' && sql[i + 1] === '*') {
      const start = i;
      let depth = 0;
      while (i < sql.length) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth++;
          blank(sql[i]);
          blank(sql[i + 1]);
          i += 2;
          continue;
        }
        if (sql[i] === '*' && sql[i + 1] === '/') {
          depth--;
          blank(sql[i]);
          blank(sql[i + 1]);
          i += 2;
          if (depth === 0) break;
          continue;
        }
        blank(sql[i]);
        i++;
      }
      if (depth > 0) {
        problems.push({ line: lineAt(sql, start), message: 'unterminated block comment' });
      } else {
        comments.push(sql.slice(start + 2, i - 2));
      }
      continue;
    }

    // String literal or quoted identifier. Doubling the quote escapes it. An
    // `E'…'` string also treats a backslash as an escape, which is handled
    // below so the closing quote is not found early.
    if (ch === "'" || ch === '"') {
      const quote = ch;
      const start = i;
      const escapeString =
        quote === "'" && /[eE]/.test(sql[i - 1] ?? '') && !IDENTIFIER_CHAR.test(sql[i - 2] ?? '');
      blank(ch);
      i++;
      let closed = false;

      while (i < sql.length) {
        if (escapeString && sql[i] === '\\') {
          blank(sql[i]);
          if (i + 1 < sql.length) blank(sql[i + 1]);
          i += 2;
          continue;
        }
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            blank(sql[i]);
            blank(sql[i + 1]);
            i += 2;
            continue;
          }
          blank(sql[i]);
          i++;
          closed = true;
          break;
        }
        blank(sql[i]);
        i++;
      }

      if (!closed) {
        problems.push({
          line: lineAt(sql, start),
          message:
            quote === "'" ? 'unterminated string literal' : 'unterminated quoted identifier',
        });
      }
      continue;
    }

    // Dollar-quoted body. Positional parameters (`$1`) do not match: the tag
    // must be followed by a closing `$`. A tag immediately after an identifier
    // character belongs to that identifier (`foo$bar$`); treating it as an
    // opening tag would blank everything up to the next matching tag and hide
    // any statement in between.
    if (ch === '$') {
      const previous = sql[i - 1] ?? '';
      const opening = IDENTIFIER_CHAR.test(previous)
        ? null
        : /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (opening) {
        const start = i;
        const tag = opening[0];
        const closeAt = sql.indexOf(tag, i + tag.length);
        if (closeAt === -1) {
          for (; i < sql.length; i++) blank(sql[i]);
          problems.push({ line: lineAt(sql, start), message: 'unterminated dollar-quoted string' });
        } else {
          for (; i < closeAt + tag.length; i++) blank(sql[i]);
        }
        continue;
      }
    }

    copy(ch);
    i++;
  }

  return { sanitized: out.join(''), problems, comments };
}

/**
 * The reason from the first real comment that opts this migration out, or
 * `null` when no comment carries one.
 *
 * Only comments reach this function: text inside strings, quoted identifiers
 * and dollar-quoted bodies was blanked and is not collected, so copying the
 * marker into SQL data cannot disable the check.
 *
 * @param {string[]} comments
 * @returns {string | null}
 */
function allowDestructiveReason(comments) {
  for (const comment of comments) {
    const match = ALLOW_DESTRUCTIVE.exec(comment);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Split sanitized SQL into statements, keeping each one's offset so a finding
 * can name the line it came from.
 *
 * @param {string} sanitized
 * @returns {{ text: string, offset: number }[]}
 */
export function splitStatements(sanitized) {
  const statements = [];
  let start = 0;
  for (let i = 0; i <= sanitized.length; i++) {
    const atEnd = i === sanitized.length;
    if (!atEnd && sanitized[i] !== ';') continue;
    const text = sanitized.slice(start, i);
    if (text.trim()) statements.push({ text, offset: start });
    start = i + 1;
  }
  return statements;
}

/**
 * Whether the matched verb has a `WHERE` in its own scope.
 *
 * A `WHERE` inside a subquery filters that subquery, not the rows the outer
 * verb touches. A data-modifying CTE's verb sits at a deeper parenthesis depth
 * than the statement, and its scope ends at the `)` that closes that CTE; a
 * sibling CTE's `WHERE` must not count. The verb's depth is measured from the
 * start of the statement, then the scan stops when the scope closes.
 *
 * @param {string} statement
 * @param {number} verbIndex
 * @returns {boolean}
 */
function hasFilteringWhere(statement, verbIndex) {
  let depth = 0;
  for (let i = 0; i < verbIndex; i++) {
    if (statement[i] === '(') depth++;
    else if (statement[i] === ')') depth--;
  }

  const scope = depth;
  for (let i = verbIndex; i < statement.length; i++) {
    const ch = statement[i];
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth < scope) return false;
    } else if (depth === scope && /^where\b/i.test(statement.slice(i, i + 6))) {
      return true;
    }
  }
  return false;
}

/**
 * Destructive findings in one sanitized statement, each with the offset of the
 * matched keyword within the statement. A data-modifying CTE can put several
 * verbs in one statement, so a rule can produce more than one finding.
 *
 * @param {string} statement
 * @returns {{ index: number, message: string }[]}
 */
export function findDestructive(statement) {
  const trimmed = statement.replace(/^\s+/, '');
  const findings = [];
  const isWith = /^with\b/i.test(trimmed);

  for (const rule of DESTRUCTIVE_RULES) {
    const pattern = isWith && rule.ctePattern ? rule.ctePattern : rule.pattern;
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    for (const match of trimmed.matchAll(new RegExp(pattern.source, flags))) {
      if (rule.notAfter) {
        const before = trimmed.slice(0, match.index).trimEnd();
        if (rule.notAfter.test(before)) continue;
      }
      if (rule.requiresSet && !/\bset\b/i.test(trimmed)) continue;
      if (rule.requiresWhere && hasFilteringWhere(trimmed, match.index)) continue;
      findings.push({ index: match.index, message: rule.message });
    }
  }

  return findings;
}

/**
 * The first unbalanced parenthesis in one sanitized statement, or `null`.
 *
 * It is checked per statement: one statement's stray `(` must not be balanced
 * by another statement's stray `)`, which would let both through.
 *
 * @param {string} statement
 * @returns {{ index: number } | null}
 */
export function unbalancedParenthesis(statement) {
  let depth = 0;
  let opening = -1;
  for (let i = 0; i < statement.length; i++) {
    if (statement[i] === '(') {
      if (depth === 0) opening = i;
      depth++;
    } else if (statement[i] === ')') {
      depth--;
      if (depth < 0) return { index: i };
    }
  }
  return depth > 0 ? { index: opening } : null;
}

/**
 * @param {Record<string, string | undefined>} [env]
 *   Defaults to `Bun.env`, and taken as a parameter so the decision table is
 *   testable without mutating the process environment.
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

  // An empty base is allowed here, unlike the immutability check: it means
  // "validate everything", which is what a local run against a fresh tree
  // does. A missing directory is still a configuration fault above.
  const baseHashes = new Map();
  for (const file of base) {
    baseHashes.set(file, await contentHash(join(baseDir, file)));
  }

  const changed = [];
  for (const file of current) {
    const before = baseHashes.get(file);
    if (before === undefined || before !== (await contentHash(join(currentDir, file)))) {
      changed.push(file);
    }
  }

  if (changed.length === 0) {
    notice('No changed migrations to validate.');
    return 0;
  }

  let failures = 0;
  for (const file of changed) {
    const sql = await Bun.file(join(currentDir, file)).text();
    const { sanitized, problems, comments } = sanitizeSql(sql);
    const allow = allowDestructiveReason(comments);

    for (const problem of problems) {
      error(`${file}:${problem.line}: ${problem.message}`);
      failures++;
    }

    for (const statement of splitStatements(sanitized)) {
      const paren = unbalancedParenthesis(statement.text);
      if (paren) {
        error(
          `${file}:${lineAt(sanitized, statement.offset + paren.index)}: unbalanced parentheses`
        );
        failures++;
      }

      const leading = statement.text.length - statement.text.trimStart().length;
      for (const finding of findDestructive(statement.text)) {
        const line = lineAt(sanitized, statement.offset + leading + finding.index);
        if (allow !== null) {
          warn(`${file}:${line}: ${finding.message} — allowed: ${allow}`);
        } else {
          error(
            `${file}:${line}: ${finding.message}. If this is intentional, add ` +
              '"-- allow-destructive: <reason>" to the migration.'
          );
          failures++;
        }
      }
    }
  }

  if (failures > 0) {
    error(
      `${failures} problem(s) in ${changed.length} changed migration(s). ` +
        'Nothing here ran against a database; fix the SQL or record why the destruction is intended.'
    );
    return 1;
  }

  notice(`${changed.length} changed migration(s) validated; no destructive or malformed SQL found.`);
  return 0;
}

// Auto-run only when invoked directly; importing this from a test must not
// execute the check.
const invokedDirectly = process.argv[1]?.endsWith('check-migration-sql.mjs');
if (invokedDirectly) {
  process.exit(await main());
}
