// @vitest-environment node
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyBaseline,
  compareMigrationTypes,
  main,
  parseGeneratedTypes,
  parseMigrationSql,
} from '../../../scripts/check-migration-types.mjs';
import { APP_TABLES, UNTYPED_TABLES } from '../../../scripts/schema-tables.mjs';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'migration-types-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeProject(migration: string, types: string) {
  await mkdir(join(dir, 'supabase/migrations'), { recursive: true });
  await mkdir(join(dir, 'src/types'), { recursive: true });
  await Bun.write(join(dir, 'supabase/migrations/20260101000000_test.sql'), migration);
  await Bun.write(join(dir, 'src/types/supabase.ts'), types);
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
          insert_only: string
        }
        Update: {
          id?: string
          tags?: string[]
          update_only: number
        }
        Relationships: []
      }
    }
    Views: {
      alpha_view: {
        Row: {
          id: string
          view_only: string | null
        }
        Insert: {
          id?: string
          view_only?: string | null
        }
        Update: {
          id?: string
          view_only?: string | null
        }
        Relationships: []
      }
    }
  }
}
`;

describe('parseMigrationSql', () => {
  it('tracks creates and added columns while ignoring comments, functions and drops', () => {
    const tables = parseMigrationSql([
      {
        sql: `
          -- CREATE TABLE ignored (id uuid);
          CREATE TABLE IF NOT EXISTS public.alpha (
            id uuid PRIMARY KEY,
            note text DEFAULT 'a;b',
            tags text[] NOT NULL DEFAULT '{}'::text[],
            CONSTRAINT alpha_note_key UNIQUE (note)
          );
          ALTER TABLE public.alpha
            ADD COLUMN IF NOT EXISTS age integer,
            ADD COLUMN last_name text;
          CREATE TABLE public.old_table (id uuid);
          DROP TABLE IF EXISTS public.old_table CASCADE;
          CREATE TABLE auth.ignored (id uuid);
          CREATE FUNCTION public.noop() RETURNS void AS $$
            BEGIN
              CREATE TABLE public.from_function (id uuid);
            END;
          $$ LANGUAGE plpgsql;
        `,
      },
    ]);

    expect([...tables.keys()]).toEqual(['alpha']);
    expect([...(tables.get('alpha') ?? [])].sort()).toEqual([
      'age',
      'id',
      'last_name',
      'note',
      'tags',
    ]);
  });

  it('fails closed on unsupported column or table changes', () => {
    const before = 'CREATE TABLE public.alpha (name text);\n';
    for (const sql of [
      'ALTER TABLE public.alpha DROP COLUMN name;',
      'ALTER TABLE public.alpha RENAME COLUMN name TO title;',
      'ALTER TABLE public.alpha RENAME TO beta;',
      'CREATE TABLE public.alpha AS SELECT 1;',
      'CREATE TABLE public."alpha" (name text);',
      'CREATE TABLE "alpha" (name text);',
      'ALTER TABLE public."alpha" ADD COLUMN quoted text;',
      'DROP TABLE public."alpha";',
    ]) {
      expect(() => parseMigrationSql([{ sql: before + sql }])).toThrow(/Unsupported/);
    }
  });
});

describe('parseGeneratedTypes', () => {
  it('extracts table names and Row columns, not Insert, Update, or Views entries', () => {
    const types = parseGeneratedTypes(TYPES_WITH_ALPHA);
    const columns = [...(types.get('alpha') ?? [])];

    expect([...types.keys()]).toEqual(['alpha']);
    expect(columns.sort()).toEqual(['id', 'tags']);
    expect(columns).not.toContain('insert_only');
    expect(columns).not.toContain('update_only');
    expect(types.has('alpha_view')).toBe(false);
  });
});

describe('compareMigrationTypes', () => {
  it('reports missing and stale tables, columns, and classifications', () => {
    const findings = compareMigrationTypes({
      migrationTables: new Map([
        ['alpha', new Set(['id', 'new_column'])],
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
    expect(findings.missingTypeColumns).toEqual(['alpha.new_column']);
    expect(findings.staleTypeColumns).toEqual(['alpha.removed']);
    expect(findings.unclassifiedTables).toEqual(['new_table']);
    expect(findings.extraTypeTables).toEqual(['not_in_app']);
    expect(findings.staleUntypedTables).toEqual(['retired_manual_table']);
    expect(findings.overlappingTables).toEqual(['alpha']);
  });
});

describe('applyBaseline', () => {
  it('separates accepted drift from new drift and flags stale entries', () => {
    const findings = {
      missingTypeColumns: ['alpha.old', 'alpha.new'],
      missingMigrations: [],
    };
    const split = applyBaseline(findings, {
      missingTypeColumns: ['alpha.old', 'alpha.gone'],
      missingMigrations: ['retired'],
    });

    expect(split.newFindings.missingTypeColumns).toEqual(['alpha.new']);
    expect(split.knownFindings.missingTypeColumns).toEqual(['alpha.old']);
    expect(split.staleBaseline).toEqual([
      'missingMigrations: retired',
      'missingTypeColumns: alpha.gone',
    ]);
  });
});

describe('main', () => {
  it('returns 0 with findings in advisory mode and 1 in strict mode', async () => {
    await writeProject('CREATE TABLE public.alpha (id uuid, new_column text);', TYPES_WITH_ALPHA);

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
    await writeProject('CREATE TABLE public.alpha (id uuid, tags text[]);', TYPES_WITH_ALPHA);

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
