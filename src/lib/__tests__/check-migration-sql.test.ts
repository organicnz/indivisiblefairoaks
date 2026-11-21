// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../../scripts/check-migration-sql.mjs';

/**
 * The static SQL gate's decision table.
 *
 * The gate exists because every other schema check answers a question about
 * *history*; none of them reads the SQL. A migration that drops a column is
 * indistinguishable from a safe one until it runs against a real database, so
 * the destructive statements are caught from the text, before merge, with no
 * database or credential.
 *
 * The tests that matter most are the negative ones: destructive **words** in
 * comments, string literals and dollar-quoted bodies must not fire, because a
 * gate that cries wolf on prose gets bypassed. The opt-out is also pinned —
 * a marker without a reason is not an opt-out.
 */

const OLD = '20260101000000_old.sql';
const NEW = '20260102000000_new.sql';

function captureOutput() {
  const lines: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.join(' '));
  });
  return {
    all: () => lines.join('\n'),
    restore: () => vi.restoreAllMocks(),
  };
}

describe('check-migration-sql', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'migration-sql-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  /** The two checkouts the workflow materialises: trusted base and PR tree. */
  function trees(base: Record<string, string>, current: Record<string, string>) {
    const baseDir = join(root, 'trusted/supabase/migrations');
    const currentDir = join(root, 'pr/supabase/migrations');
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(currentDir, { recursive: true });
    for (const [name, sql] of Object.entries(base)) writeFileSync(join(baseDir, name), sql);
    for (const [name, sql] of Object.entries(current)) writeFileSync(join(currentDir, name), sql);
    return { BASE_MIGRATIONS_DIR: baseDir, MIGRATIONS_DIR: currentDir };
  }

  it('passes a benign new migration', async () => {
    const out = captureOutput();
    const exit = await main(
      trees(
        { [OLD]: 'select 1;\n' },
        { [OLD]: 'select 1;\n', [NEW]: 'create table widgets (id int);\n' }
      )
    );

    expect(exit).toBe(0);
    expect(out.all()).toContain('1 changed migration(s) validated');
    out.restore();
  });

  it('ignores destructive words in comments, strings and quoted identifiers', async () => {
    const out = captureOutput();
    const sql = [
      '-- DROP TABLE widgets;',
      '/* TRUNCATE widgets; */',
      "COMMENT ON TABLE widgets IS 'DROP TABLE widgets';",
      'SELECT \'DELETE FROM widgets\', "drop table" FROM widgets;',
      '',
    ].join('\n');

    const exit = await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }));

    expect(exit).toBe(0);
    expect(out.all()).not.toContain('DROP TABLE destroys');
    out.restore();
  });

  it('flags every destructive verb with its line', async () => {
    const out = captureOutput();
    const sql = [
      'DROP TABLE widgets;',
      'ALTER TABLE gadgets DROP COLUMN name;',
      'TRUNCATE events;',
      'DROP SCHEMA private;',
      'DROP DATABASE prod;',
      '',
    ].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(1);
    expect(out.all()).toContain(`${NEW}:1: DROP TABLE destroys`);
    expect(out.all()).toContain(`${NEW}:2: DROP COLUMN destroys`);
    expect(out.all()).toContain(`${NEW}:3: TRUNCATE removes`);
    expect(out.all()).toContain(`${NEW}:4: DROP SCHEMA destroys`);
    expect(out.all()).toContain(`${NEW}:5: DROP DATABASE is not`);
    out.restore();
  });

  it('flags DELETE and UPDATE only when there is no WHERE', async () => {
    const out = captureOutput();
    const sql = [
      'DELETE FROM widgets;',
      'UPDATE widgets SET archived = true;',
      'DELETE FROM widgets WHERE id = 1;',
      'UPDATE widgets SET archived = true WHERE id = 2;',
      '',
    ].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(1);
    expect(out.all().match(/DELETE without WHERE/g)).toHaveLength(1);
    expect(out.all().match(/UPDATE without WHERE/g)).toHaveLength(1);
    out.restore();
  });

  it('finds an unfiltered DELETE behind a WITH clause', async () => {
    const out = captureOutput();
    const sql = [
      'WITH doomed AS (',
      '  DELETE FROM widgets RETURNING *',
      ')',
      'SELECT * FROM doomed;',
      '',
    ].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(1);
    expect(out.all()).toContain(`${NEW}:2: DELETE without WHERE`);
    out.restore();
  });

  it('finds an unfiltered UPDATE behind a WITH clause', async () => {
    const out = captureOutput();
    const sql = [
      'WITH changed AS (',
      '  UPDATE widgets SET archived = true RETURNING *',
      ')',
      'SELECT * FROM changed;',
      '',
    ].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(1);
    expect(out.all()).toContain(`${NEW}:2: UPDATE without WHERE`);
    out.restore();
  });

  it('respects a WHERE inside a data-modifying CTE', async () => {
    const out = captureOutput();
    const sql = [
      'WITH changed AS (',
      '  UPDATE widgets SET archived = true WHERE id = 1 RETURNING *',
      ')',
      'SELECT * FROM changed;',
      '',
    ].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(0);
    expect(out.all()).not.toContain('UPDATE without WHERE');
    out.restore();
  });

  it('does not let a sibling CTE WHERE filter an earlier CTE DELETE', async () => {
    const out = captureOutput();
    const sql = [
      'WITH first AS (',
      '  DELETE FROM widgets RETURNING *',
      '),',
      'second AS (',
      '  DELETE FROM gadgets WHERE id = 1 RETURNING *',
      ')',
      'SELECT * FROM first, second;',
      '',
    ].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(1);
    expect(out.all().match(/DELETE without WHERE/g)).toHaveLength(1);
    expect(out.all()).toContain(`${NEW}:2: DELETE without WHERE`);
    out.restore();
  });

  it('does not treat a WHERE inside a subquery as a filter on the outer UPDATE', async () => {
    const out = captureOutput();
    const sql = 'UPDATE widgets SET archived = (SELECT true WHERE 1 = 1);\n';

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(1);
    expect(out.all()).toContain(`${NEW}:1: UPDATE without WHERE`);
    out.restore();
  });

  it('does not misread INSERT ... ON CONFLICT DO UPDATE as an unfiltered UPDATE', async () => {
    const out = captureOutput();
    const sql = 'INSERT INTO widgets (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET seen = true;\n';

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(0);
    out.restore();
  });

  it('does not misread DO UPDATE inside a WITH statement', async () => {
    const out = captureOutput();
    const sql =
      'WITH source AS (SELECT 1 AS id) ' +
      'INSERT INTO widgets (id) SELECT id FROM source ' +
      'ON CONFLICT (id) DO UPDATE SET seen = true;\n';

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(0);
    expect(out.all()).not.toContain('UPDATE without WHERE');
    out.restore();
  });

  it('does not misread FOR UPDATE inside a WITH statement', async () => {
    for (const lock of ['FOR UPDATE', 'FOR NO KEY UPDATE']) {
      const out = captureOutput();
      const sql = [
        'WITH locked AS (',
        `  SELECT * FROM widgets ${lock}`,
        '),',
        'changed AS (',
        '  UPDATE gadgets SET archived = true WHERE id = 1 RETURNING *',
        ')',
        'SELECT * FROM locked, changed;',
        '',
      ].join('\n');

      expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(0);
      expect(out.all()).not.toContain('UPDATE without WHERE');
      out.restore();
    }
  });

  it('does not flag TRUNCATE as a trigger event or a revoked privilege', async () => {
    const out = captureOutput();
    const sql = [
      'create trigger audit_no_truncate',
      '    before truncate on public.audit_log',
      '    for each statement execute function public.reject_admin_audit_log_mutation();',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public',
      '  REVOKE TRUNCATE, REFERENCES ON TABLES FROM anon;',
      '',
    ].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(0);
    expect(out.all()).not.toContain('TRUNCATE removes');
    out.restore();
  });

  it('does not analyse SQL inside a dollar-quoted function body', async () => {
    const out = captureOutput();
    const sql = [
      'CREATE FUNCTION wipe() RETURNS void AS $$',
      'BEGIN',
      '  DELETE FROM widgets;',
      '  DROP TABLE widgets;',
      'END;',
      '$$ LANGUAGE plpgsql;',
      '',
    ].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(0);
    out.restore();
  });

  it('does not treat a dollar tag inside an identifier as a dollar-quoted string', async () => {
    const out = captureOutput();
    // `foo$q$` is a valid identifier. If its tag opened a dollar-quoted
    // string, the scanner would blank through the next `$q$` and hide the
    // DROP in between.
    const sql = ['SELECT foo$q$;', 'DROP TABLE widgets;', 'SELECT $q$ harmless $q$;', ''].join(
      '\n'
    );

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(1);
    const said = out.all();
    expect(said).toContain(`${NEW}:2: DROP TABLE destroys`);
    expect(said).not.toContain('unterminated dollar-quoted');
    out.restore();
  });

  it('does not treat a dollar tag after a Unicode identifier character as a string', async () => {
    const out = captureOutput();
    // `café$q$` is one identifier in Postgres; the `$q$` must not open a
    // dollar-quoted string and hide the DROP.
    const sql = ['SELECT café$q$;', 'DROP TABLE widgets;', 'SELECT $q$ harmless $q$;', ''].join(
      '\n'
    );

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(1);
    const said = out.all();
    expect(said).toContain(`${NEW}:2: DROP TABLE destroys`);
    expect(said).not.toContain('unterminated dollar-quoted');
    out.restore();
  });

  it('flags an unterminated string literal', async () => {
    const out = captureOutput();

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: "SELECT 'oops;\n" }))).toBe(1);
    expect(out.all()).toContain('unterminated string literal');
    out.restore();
  });

  it('flags an unterminated dollar-quoted block', async () => {
    const out = captureOutput();

    expect(
      await main(
        trees(
          { [OLD]: 'select 1;\n' },
          { [NEW]: 'CREATE FUNCTION f() RETURNS void AS $$ BEGIN SELECT 1;\n' }
        )
      )
    ).toBe(1);
    expect(out.all()).toContain('unterminated dollar-quoted string');
    out.restore();
  });

  it('flags unbalanced parentheses', async () => {
    const out = captureOutput();

    expect(
      await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: 'CREATE TABLE t (id int;\n' }))
    ).toBe(1);
    expect(out.all()).toContain('unbalanced parentheses');
    out.restore();
  });

  it('checks parentheses per statement', async () => {
    const out = captureOutput();
    const sql = ['CREATE TABLE t (id int;', 'SELECT 1);', ''].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(1);
    expect(out.all().match(/unbalanced parentheses/g)).toHaveLength(2);
    out.restore();
  });

  it('validates nothing when every file matches the base', async () => {
    const out = captureOutput();
    const exit = await main(
      trees({ [OLD]: 'DROP TABLE widgets;\n' }, { [OLD]: 'DROP TABLE widgets;\n' })
    );

    expect(exit).toBe(0);
    expect(out.all()).toContain('No changed migrations to validate.');
    out.restore();
  });

  it('honours allow-destructive with a reason', async () => {
    const out = captureOutput();
    const sql = [
      '-- allow-destructive: dropping the abandoned staging table (#123)',
      'DROP TABLE staging_old;',
      '',
    ].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(0);
    expect(out.all()).toContain('allowed: dropping the abandoned staging table (#123)');
    out.restore();
  });

  it('honours allow-destructive in a block comment', async () => {
    const out = captureOutput();
    const sql = [
      '/*',
      ' * allow-destructive: dropping the abandoned staging table',
      ' */',
      'DROP TABLE staging_old;',
      '',
    ].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(0);
    expect(out.all()).toContain('allowed: dropping the abandoned staging table');
    out.restore();
  });

  it('does not accept an allow-destructive marker without a reason', async () => {
    const out = captureOutput();
    const sql = ['-- allow-destructive:', 'DROP TABLE staging_old;', ''].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(1);
    expect(out.all()).toContain('DROP TABLE destroys');
    out.restore();
  });

  it('ignores an allow-destructive marker inside a string literal or dollar-quoted body', async () => {
    const out = captureOutput();
    // The DROP is the only real statement. The two markers are SQL data: one in
    // a string, one in a function body. Neither is a comment, so neither may
    // turn the finding into a warning.
    const sql = [
      "SELECT '-- allow-destructive: hidden in a string';",
      'DROP TABLE widgets;',
      'CREATE FUNCTION wipe() RETURNS void AS $$',
      '  -- allow-destructive: hidden in a function body',
      '  DELETE FROM widgets;',
      '$$ LANGUAGE plpgsql;',
      '',
    ].join('\n');

    expect(await main(trees({ [OLD]: 'select 1;\n' }, { [NEW]: sql }))).toBe(1);
    const said = out.all();
    expect(said).toContain(`${NEW}:2: DROP TABLE destroys`);
    expect(said).not.toContain('allowed:');
    out.restore();
  });

  it('refuses to run without a base reference', async () => {
    const out = captureOutput();

    expect(await main({ MIGRATIONS_DIR: join(root, 'pr/supabase/migrations') })).toBe(1);
    expect(out.all()).toContain('BASE_MIGRATIONS_DIR is not set');
    out.restore();
  });
});
