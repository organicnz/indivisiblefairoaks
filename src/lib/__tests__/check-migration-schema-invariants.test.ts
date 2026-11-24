// @vitest-environment node
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../../scripts/check-migration-schema-invariants.mjs';

/**
 * The static schema-invariant guard's decision table.
 *
 * It exists because the live hygiene check can only see a violation after the
 * migration is applied — the finding arrives when the change is already live.
 * Its three catalogue invariants are decidable from the SQL that creates them,
 * so this gate catches them on the PR instead.
 *
 * The negative cases matter as much as the positive ones: a primary key or a
 * `UNIQUE` constraint is backed by an index that leads a foreign key, a partial
 * index is not redundant with a wider one, a `REVOKE` retires an earlier
 * `GRANT ALL`, and a violation that already exists in the base branch is not
 * this PR's to fix.
 */

const BASE_FILE = '20260101000000_base.sql';
const NEW_FILE = '20260102000000_new.sql';

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

describe('check-migration-schema-invariants', () => {
  let root: string;
  let currentDir: string;
  let baseDir: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'schema-invariants-'));
    currentDir = join(root, 'current');
    baseDir = join(root, 'base');
    await mkdir(currentDir, { recursive: true });
    await mkdir(baseDir, { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  /** Write one file into a tree; an empty string still creates the file. */
  async function write(dir: string, file: string, sql: string) {
    await Bun.write(join(dir, file), sql);
  }

  async function check(current: Record<string, string>, base: Record<string, string> = {}) {
    // A PR checkout contains the base migrations too; the model replays the
    // whole history, so both trees get the base files.
    for (const [file, sql] of Object.entries(base)) {
      await write(baseDir, file, sql);
      await write(currentDir, file, sql);
    }
    for (const [file, sql] of Object.entries(current)) await write(currentDir, file, sql);
    const output = captureOutput();
    try {
      const code = await main({ MIGRATIONS_DIR: currentDir, BASE_MIGRATIONS_DIR: baseDir });
      return { code, output: output.all() };
    } finally {
      output.restore();
    }
  }

  describe('ungovernable grants', () => {
    it('fails GRANT ALL to authenticated, naming the table', async () => {
      const { code, output } = await check({
        [NEW_FILE]:
          'CREATE TABLE public.crm_notes (id uuid PRIMARY KEY);\nGRANT ALL ON TABLE public.crm_notes TO authenticated;\n',
      });
      expect(code).toBe(1);
      expect(output).toContain('crm_notes');
      expect(output).toContain('does not govern');
    });

    it('fails a named privilege RLS cannot govern', async () => {
      const { code, output } = await check({
        [NEW_FILE]:
          'CREATE TABLE public.crm_notes (id uuid PRIMARY KEY);\nGRANT TRUNCATE ON public.crm_notes TO anon;\n',
      });
      expect(code).toBe(1);
      expect(output).toContain('TRUNCATE');
    });

    it('passes the DML privileges a policy does govern', async () => {
      const { code } = await check({
        [NEW_FILE]:
          'CREATE TABLE public.crm_notes (id uuid PRIMARY KEY);\nGRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_notes TO authenticated;\n',
      });
      expect(code).toBe(0);
    });

    it('passes when a later REVOKE retires the ungovernable privileges', async () => {
      const { code } = await check({
        [BASE_FILE]:
          'CREATE TABLE public.crm_notes (id uuid PRIMARY KEY);\nGRANT ALL ON public.crm_notes TO authenticated;\n',
        [NEW_FILE]:
          'REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.crm_notes FROM authenticated;\n',
      });
      expect(code).toBe(0);
    });

    it('treats a schema-wide grant as reaching every table defined so far', async () => {
      const { code, output } = await check({
        [BASE_FILE]: 'CREATE TABLE public.crm_notes (id uuid PRIMARY KEY);\n',
        [NEW_FILE]: 'GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;\n',
      });
      expect(code).toBe(1);
      expect(output).toContain('crm_notes');
    });
  });

  describe('redundant indexes', () => {
    it('fails a narrower non-unique index beside a wider one', async () => {
      const { code, output } = await check({
        [BASE_FILE]:
          'CREATE TABLE public.t (a uuid, b uuid);\nCREATE INDEX t_ab_idx ON public.t (a, b);\n',
        [NEW_FILE]: 'CREATE INDEX t_a_idx ON public.t (a);\n',
      });
      expect(code).toBe(1);
      expect(output).toContain('t_a_idx');
      expect(output).toContain('prefix');
    });

    it('fails two identical non-unique indexes', async () => {
      const { code } = await check({
        [BASE_FILE]: 'CREATE TABLE public.t (a uuid);\nCREATE INDEX t_one_idx ON public.t (a);\n',
        [NEW_FILE]: 'CREATE INDEX t_two_idx ON public.t (a);\n',
      });
      expect(code).toBe(1);
    });

    it('passes two unique indexes on the same columns', async () => {
      const { code } = await check({
        [BASE_FILE]:
          'CREATE TABLE public.t (a uuid);\nCREATE UNIQUE INDEX t_one_idx ON public.t (a);\n',
        [NEW_FILE]: 'CREATE UNIQUE INDEX t_two_idx ON public.t (a);\n',
      });
      expect(code).toBe(0);
    });

    it('passes a narrower index when it is unique', async () => {
      const { code } = await check({
        [BASE_FILE]:
          'CREATE TABLE public.t (a uuid, b uuid);\nCREATE INDEX t_ab_idx ON public.t (a, b);\n',
        [NEW_FILE]: 'CREATE UNIQUE INDEX t_a_uidx ON public.t (a);\n',
      });
      expect(code).toBe(0);
    });

    it('passes a partial index that shares a wider index’s columns', async () => {
      const { code } = await check({
        [BASE_FILE]:
          'CREATE TABLE public.t (a uuid, opted_in boolean);\nCREATE INDEX t_a_idx ON public.t (a);\n',
        [NEW_FILE]: 'CREATE INDEX t_a_opted_idx ON public.t (a) WHERE opted_in;\n',
      });
      expect(code).toBe(0);
    });

    it('passes when the index is created and dropped in the same change', async () => {
      const { code } = await check({
        [BASE_FILE]:
          'CREATE TABLE public.t (a uuid, b uuid);\nCREATE INDEX t_ab_idx ON public.t (a, b);\n',
        [NEW_FILE]: 'CREATE INDEX t_a_idx ON public.t (a);\nDROP INDEX public.t_a_idx;\n',
      });
      expect(code).toBe(0);
    });
  });

  describe('foreign keys without a leading index', () => {
    it('fails an FK whose column no index leads', async () => {
      const { code, output } = await check({
        [BASE_FILE]: 'CREATE TABLE public.children (parent_id uuid);\n',
        [NEW_FILE]:
          'ALTER TABLE public.children ADD CONSTRAINT children_parent_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id);\n',
      });
      expect(code).toBe(1);
      expect(output).toContain('parent_id');
    });

    it('passes when an explicit index leads with the FK column', async () => {
      const { code } = await check({
        [BASE_FILE]:
          'CREATE TABLE public.children (parent_id uuid);\nCREATE INDEX children_parent_idx ON public.children (parent_id);\n',
        [NEW_FILE]:
          'ALTER TABLE public.children ADD CONSTRAINT children_parent_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id);\n',
      });
      expect(code).toBe(0);
    });

    it('passes when an inline primary key leads the FK column', async () => {
      const { code } = await check({
        [NEW_FILE]:
          'CREATE TABLE public.profiles (\n  id uuid PRIMARY KEY REFERENCES auth.users(id)\n);\n',
      });
      expect(code).toBe(0);
    });

    it('passes when a UNIQUE constraint leads the FK column', async () => {
      const { code } = await check({
        [NEW_FILE]:
          'CREATE TABLE public.documents (\n  asset_id uuid UNIQUE REFERENCES public.assets(id)\n);\n',
      });
      expect(code).toBe(0);
    });

    it('fails a composite FK whose first column is not the index lead', async () => {
      const { code } = await check({
        [BASE_FILE]:
          'CREATE TABLE public.links (page_id uuid, href text);\nCREATE INDEX links_href_idx ON public.links (href);\n',
        [NEW_FILE]:
          'ALTER TABLE public.links ADD CONSTRAINT links_page_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id);\n',
      });
      expect(code).toBe(1);
    });
  });

  describe('scope and escape hatch', () => {
    it('passes a violation that already exists in the base branch', async () => {
      const { code } = await check(
        { [NEW_FILE]: 'SELECT 1;\n' },
        {
          [BASE_FILE]:
            'CREATE TABLE public.crm_notes (id uuid PRIMARY KEY);\nGRANT ALL ON public.crm_notes TO authenticated;\n',
        }
      );
      expect(code).toBe(0);
    });

    it('downgrades findings to warnings when the file records a reason', async () => {
      const { code, output } = await check({
        [NEW_FILE]:
          '-- allow-schema-finding: the covering index lands with the backfill\nCREATE TABLE public.crm_notes (id uuid PRIMARY KEY);\nGRANT ALL ON public.crm_notes TO authenticated;\n',
      });
      expect(code).toBe(0);
      expect(output).toContain('allowed:');
    });

    it('refuses to pass without a base checkout', async () => {
      await write(currentDir, NEW_FILE, 'SELECT 1;\n');
      const output = captureOutput();
      try {
        expect(await main({ MIGRATIONS_DIR: currentDir })).toBe(1);
        expect(output.all()).toContain('BASE_MIGRATIONS_DIR');
      } finally {
        output.restore();
      }
    });

    it('passes when no migration changed', async () => {
      const sql = 'GRANT ALL ON public.crm_notes TO authenticated;\n';
      const { code, output } = await check({ [BASE_FILE]: sql }, { [BASE_FILE]: sql });
      expect(code).toBe(0);
      expect(output).toContain('No changed migrations');
    });
  });
});
