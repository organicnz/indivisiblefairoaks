// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listMigrations,
  main,
} from '../../../scripts/check-migration-immutability.mjs';

/**
 * The applied-migration immutability gate's decision table.
 *
 * `schema_migrations` records a version, not the bytes that were run, so every
 * version-based check is blind to an edited file — the one history divergence
 * that makes development and production stop sharing a schema while the gate
 * stays green. The base checkout is the only reference a PR cannot rewrite.
 *
 * Two properties matter more than the messages:
 *
 *  1. **Merged means applied.** A file in the base tree is treated as recorded,
 *     even if its deploy never ran, because a PR editing it is wrong either way.
 *  2. **No base is not a pass.** A missing or empty base checkout would compare
 *     nothing; the check refuses rather than reporting green.
 *
 * The tree pair is built in a temporary directory, the way the workflow
 * materialises `trusted/` and `pr/`, so the test exercises the same layout the
 * job does.
 */

const APPLIED = '20260101000000_add_widgets.sql';
const NEW = '20260102000000_add_gadgets.sql';

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

describe('check-migration-immutability', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'migration-immutability-'));
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
    for (const [name, contents] of Object.entries(base)) {
      writeFileSync(join(baseDir, name), contents);
    }
    for (const [name, contents] of Object.entries(current)) {
      writeFileSync(join(currentDir, name), contents);
    }
    return { BASE_MIGRATIONS_DIR: baseDir, MIGRATIONS_DIR: currentDir };
  }

  it('passes unchanged applied migrations and allows new ones', async () => {
    const out = captureOutput();

    const exit = await main(
      trees({ [APPLIED]: 'select 1;\n' }, { [APPLIED]: 'select 1;\n', [NEW]: 'select 2;\n' })
    );

    expect(exit).toBe(0);
    expect(out.all()).toContain('1 applied migration(s) are unchanged.');
    out.restore();
  });

  it('fails when an applied migration is edited', async () => {
    const out = captureOutput();

    expect(
      await main(trees({ [APPLIED]: 'select 1;\n' }, { [APPLIED]: 'select 1; -- edited\n' }))
    ).toBe(1);
    expect(out.all()).toContain('Applied migration modified');
    expect(out.all()).toContain(APPLIED);
    expect(out.all()).toContain('revert the edit');
    out.restore();
  });

  it('fails on a whitespace-only edit, because the comparison is byte-exact', async () => {
    const out = captureOutput();

    expect(await main(trees({ [APPLIED]: 'select 1;\n' }, { [APPLIED]: 'select 1;   \n' }))).toBe(
      1
    );
    expect(out.all()).toContain('content hash changed');
    out.restore();
  });

  it('fails when an applied migration is deleted', async () => {
    const out = captureOutput();

    expect(await main(trees({ [APPLIED]: 'select 1;\n' }, {}))).toBe(1);
    expect(out.all()).toContain('Applied migration deleted');
    expect(out.all()).toContain(APPLIED);
    out.restore();
  });

  it('fails when an applied migration is renamed without changing its version', async () => {
    const out = captureOutput();
    const renamed = '20260101000000_add_widgets_v2.sql';

    expect(await main(trees({ [APPLIED]: 'select 1;\n' }, { [renamed]: 'select 1;\n' }))).toBe(1);
    expect(out.all()).toContain('Applied migration renamed');
    expect(out.all()).toContain(renamed);
    out.restore();
  });

  it('refuses to pass without a base reference configured', async () => {
    const out = captureOutput();

    expect(await main({ MIGRATIONS_DIR: join(root, 'pr/supabase/migrations') })).toBe(1);
    expect(out.all()).toContain('BASE_MIGRATIONS_DIR is not set');
    out.restore();
  });

  it('refuses a vacuous pass when the base checkout is missing', async () => {
    const out = captureOutput();

    expect(
      await main({
        BASE_MIGRATIONS_DIR: join(root, 'missing'),
        MIGRATIONS_DIR: join(root, 'pr/supabase/migrations'),
      })
    ).toBe(1);
    expect(out.all()).toContain('Refusing a vacuous pass');
    out.restore();
  });

  it('refuses a vacuous pass when the base has no migrations', async () => {
    const out = captureOutput();

    expect(await main(trees({}, { [APPLIED]: 'select 1;\n' }))).toBe(1);
    expect(out.all()).toContain('Refusing a vacuous pass');
    out.restore();
  });

  it('lists only SQL files, sorted', async () => {
    const { MIGRATIONS_DIR } = trees({}, {});
    writeFileSync(join(MIGRATIONS_DIR, 'b.sql'), '');
    writeFileSync(join(MIGRATIONS_DIR, 'a.sql'), '');
    writeFileSync(join(MIGRATIONS_DIR, 'notes.txt'), '');

    expect(await listMigrations(MIGRATIONS_DIR)).toEqual(['a.sql', 'b.sql']);
  });
});
