// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  compareMigrationTypes,
  main,
  parseGeneratedTypes,
  parseMigrationSql,
  splitSqlStatements,
} from '../../../scripts/check-migration-types.mjs';
import { APP_TABLES, UNTYPED_TABLES } from '../../../scripts/schema-tables.mjs';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'migration-types-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeProject(migration: string, types: string) {
  mkdirSync(join(dir, 'supabase/migrations'), { recursive: true });
  mkdirSync(join(dir, 'src/types'), { recursive: true });
  writeFileSync(join(dir, 'supabase/migrations/20260101000000_test.sql'), migration);
  writeFileSync(join(dir, 'src/types/supabase.ts'), types);
}

function capture() {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    log: (message: string) => logs.push(message),
    error: (message: string) => errors.push(message),
  };
}

const TYPES_WITH_ALPHA = `
export type Database = {
  public: {
    Tables: {
      alpha: {
        Row: {
          id: string
          tags: string[]
        }
        Insert: {
          id?: string
          tags?: string[]
        }
        Update: {
          id?: string
          tags?: string[]
        }
        Relationships: []
      }
    }
  }
}
`;

describe('splitSqlStatements', () => {
  it('keeps quoted semicolons and skips comments and dollar-quoted bodies', () => {
    const statements = splitSqlStatements(`
      -- CREATE TABLE ignored (id uuid);
      CREATE TABLE public.alpha (
        id uuid,
        note text DEFAULT 'a;b'
      );
      CREATE FUNCTION public.noop() RETURNS void AS $$
        BEGIN
          -- this semicolon does not end the statement
          PERFORM 1;
        END;
      $$ LANGUAGE plpgsql;
      ALTER TABLE public.alpha ADD COLUMN tags text[];
    `);

    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain("DEFAULT 'a;b'");
    expect(statements[2]).toMatch(/ADD COLUMN tags/);
  });
});

describe('parseMigrationSql', () => {
  it('tracks create, add, drop and rename without treating constraints as columns', () => {
    const tables = parseMigrationSql([
      {
        sql: `
          CREATE TABLE IF NOT EXISTS public.alpha (
            id uuid PRIMARY KEY,
            name text NOT NULL CHECK (name <> ''),
            tags text[] NOT NULL DEFAULT '{}'::text[],
            CONSTRAINT alpha_name_key UNIQUE (name)
          );
          ALTER TABLE public.alpha
            ADD COLUMN IF NOT EXISTS age integer,
            ADD COLUMN "nick.name" text;
          ALTER TABLE public.alpha DROP COLUMN name;
          ALTER TABLE public.alpha RENAME COLUMN age TO years;
          CREATE TABLE auth.ignored (id uuid);
        `,
      },
    ]);

    expect([...tables.keys()]).toEqual(['alpha']);
    expect([...(tables.get('alpha') ?? [])].sort()).toEqual(['id', 'nick.name', 'tags', 'years']);
  });

  it('applies DROP TABLE so a retired table does not stay in the schema', () => {
    const tables = parseMigrationSql([
      {
        sql: `
          CREATE TABLE public.old_table (id uuid);
          DROP TABLE IF EXISTS public.old_table CASCADE;
        `,
      },
    ]);

    expect(tables.has('old_table')).toBe(false);
  });
});

describe('parseGeneratedTypes', () => {
  it('extracts table names and Row columns, not Insert or Update fields', () => {
    const types = parseGeneratedTypes(TYPES_WITH_ALPHA);

    expect([...types.keys()]).toEqual(['alpha']);
    expect([...(types.get('alpha') ?? [])].sort()).toEqual(['id', 'tags']);
  });
});

describe('compareMigrationTypes', () => {
  it('reports a migrated column missing from the generated Row type', () => {
    const findings = compareMigrationTypes({
      migrationTables: new Map([['alpha', new Set(['id', 'tags', 'new_column'])]]),
      typeTables: new Map([['alpha', new Set(['id', 'tags'])]]),
      appTables: new Set(['alpha']),
      untypedTables: new Set(),
    });

    expect(findings.missingTypeColumns).toEqual(['alpha.new_column']);
    expect(findings.staleTypeColumns).toEqual([]);
  });

  it('reports stale type columns, missing tables, and unclassified migration tables', () => {
    const findings = compareMigrationTypes({
      migrationTables: new Map([
        ['alpha', new Set(['id'])],
        ['missing_from_types', new Set(['id'])],
        ['new_table', new Set(['id'])],
      ]),
      typeTables: new Map([
        ['alpha', new Set(['id', 'removed'])],
        ['missing_from_migration', new Set(['id'])],
        ['not_in_app', new Set(['id'])],
      ]),
      appTables: new Set(['alpha', 'missing_from_migration', 'missing_from_types']),
      untypedTables: new Set(['retired_manual_table', 'alpha']),
    });

    expect(findings.missingMigrations).toEqual(['missing_from_migration']);
    expect(findings.missingTypeTables).toEqual(['missing_from_types']);
    expect(findings.unclassifiedTables).toEqual(['new_table']);
    expect(findings.extraTypeTables).toEqual(['not_in_app']);
    expect(findings.staleTypeColumns).toEqual(['alpha.removed']);
    expect(findings.staleUntypedTables).toEqual(['retired_manual_table']);
    expect(findings.overlappingTables).toEqual(['alpha']);
  });
});

describe('main', () => {
  it('returns 0 with findings in advisory mode and 1 in strict mode', async () => {
    writeProject('CREATE TABLE public.alpha (id uuid, new_column text);', TYPES_WITH_ALPHA);

    const advisory = capture();
    expect(
      await main({
        root: dir,
        advisory: true,
        appTables: new Set(['alpha']),
        untypedTables: new Set(),
        ...advisory,
      })
    ).toBe(0);
    expect(advisory.logs.join('\n')).toMatch(/advisory — not blocking/);
    expect(advisory.logs.join('\n')).toMatch(/alpha\.new_column/);
    expect(advisory.errors).toEqual([]);

    const strict = capture();
    expect(
      await main({
        root: dir,
        appTables: new Set(['alpha']),
        untypedTables: new Set(),
        ...strict,
      })
    ).toBe(1);
    expect(strict.errors.join('\n')).toMatch(/alpha\.new_column/);
  });

  it('returns 0 when migrations and generated types agree', async () => {
    writeProject('CREATE TABLE public.alpha (id uuid, tags text[]);', TYPES_WITH_ALPHA);

    const output = capture();
    expect(
      await main({
        root: dir,
        appTables: new Set(['alpha']),
        untypedTables: new Set(),
        ...output,
      })
    ).toBe(0);
    expect(output.logs.join('\n')).toMatch(/agree/);
    expect(output.errors).toEqual([]);
  });

  it("classifies every table in this repository's migrations", async () => {
    const output = capture();

    expect(
      await main({
        root: process.cwd(),
        advisory: true,
        appTables: APP_TABLES,
        untypedTables: UNTYPED_TABLES,
        ...output,
      })
    ).toBe(0);

    const text = output.logs.join('\n');
    expect(text).not.toMatch(/Migration tables not classified/);
    expect(text).not.toMatch(/Generated-type tables not in APP_TABLES/);
    expect(text).not.toMatch(/APP_TABLES entries with no CREATE TABLE/);
    expect(text).not.toMatch(/UNTYPED_TABLES entries with no migration/);
    expect(output.errors).toEqual([]);
  });
});
