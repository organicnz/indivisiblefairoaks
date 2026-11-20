// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { PROJECT_REF } from '../../../scripts/hooks/_project-ref.mjs';
import { main as postCommit } from '../../../scripts/hooks/post-commit-regen-types.mjs';
import { main as postMerge } from '../../../scripts/hooks/post-merge-regen-types.mjs';
import {
  migrationVersionsFromFiles,
  regenerateTypesIfApplied,
  typeGenerationCommand,
} from '../../../scripts/hooks/regen-types-guard.mjs';
import { APPLIED_MIGRATIONS_QUERY } from '../../../scripts/migration-history.mjs';
import { resolveProjectRef } from '../../../scripts/project-ref.mjs';

/**
 * The failure this pins is destructive and silent:
 *
 * `gen-types` reads the hosted schema. If a post-commit or post-merge hook
 * runs before the migration is applied, it writes the pre-migration schema over
 * `src/types/supabase.ts`. The commit still looks successful, and the generated
 * file no longer describes the schema the migration is about to create.
 *
 * So the decision is intentionally conservative: regenerate only when every
 * local version, including the changed ones, is recorded as applied. Missing
 * credentials, an unreadable or timed-out history, or an unrecognised filename
 * all skip and leave the committed types alone.
 */

const REF = 'ref_test';
const VERSION = '20261119000000';
const OLD_VERSION = '20260101000000';
const MIGRATION = `supabase/migrations/${VERSION}_add_widgets.sql`;

type GuardOptions = Parameters<typeof regenerateTypesIfApplied>[0];
type Capture = ReturnType<typeof capture>;

function capture() {
  const lines: string[] = [];
  return {
    lines,
    log: (...args: unknown[]) => lines.push(args.map(String).join(' ')),
    all: () => lines.join('\n'),
  };
}

/** A successful Management API history read. */
function applied(versions: string[]) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(versions.map((version) => ({ version }))),
  }));
}

/** A failed Management API read. */
function failed(status: number, body: string) {
  return vi.fn(async () => ({
    ok: false,
    status,
    text: async () => body,
  }));
}

function options(over: Partial<GuardOptions> = {}): GuardOptions & { out: Capture } {
  const out = capture();
  return {
    mode: 'commit',
    changedFiles: [MIGRATION],
    localVersions: [VERSION],
    accessToken: 'tok_test',
    projectRef: REF,
    generate: vi.fn(() => 0),
    fetchImpl: applied([VERSION]) as unknown as typeof fetch,
    log: out.log,
    ...over,
    out,
  };
}

describe('migration filename parsing', () => {
  it('extracts unique versions from full migration paths', () => {
    expect(
      migrationVersionsFromFiles([MIGRATION, `supabase/migrations/${VERSION}_second_name.sql`])
    ).toEqual([VERSION]);
  });

  it('rejects the whole set when any changed path is not a migration', () => {
    expect(
      migrationVersionsFromFiles([MIGRATION, 'supabase/migrations/not_a_migration.sql'])
    ).toBeNull();
  });
});

describe('project ref resolution', () => {
  it('lets an explicit project ref override conflicting environment values', () => {
    expect(
      resolveProjectRef({
        argv: ['bun', 'gen-types.mjs', '--project-ref', 'ref_explicit'],
        env: {
          SUPABASE_PROJECT_REF: 'ref_env',
          NEXT_PUBLIC_SUPABASE_URL: 'https://ref_url.supabase.co',
        },
      })
    ).toBe('ref_explicit');
  });

  it('falls back to the dedicated variable, then the public URL', () => {
    expect(
      resolveProjectRef({
        argv: ['bun', 'gen-types.mjs'],
        env: {
          SUPABASE_PROJECT_REF: 'ref_env',
          NEXT_PUBLIC_SUPABASE_URL: 'https://ref_url.supabase.co',
        },
      })
    ).toBe('ref_env');
    expect(
      resolveProjectRef({
        argv: ['bun', 'gen-types.mjs'],
        env: { NEXT_PUBLIC_SUPABASE_URL: 'https://ref_url.supabase.co' },
      })
    ).toBe('ref_url');
  });

  it('rejects a missing --project-ref value', () => {
    expect(() =>
      resolveProjectRef({ argv: ['bun', 'gen-types.mjs', '--project-ref'], env: {} })
    ).toThrow(/requires a project ref/);
  });

  it('pins generation to the explicit project ref', () => {
    expect(typeGenerationCommand(REF)).toEqual([
      'bun',
      'scripts/gen-types.mjs',
      '--project-ref',
      REF,
    ]);
  });
});

describe('regenerateTypesIfApplied', () => {
  it('skips without touching the API or types when no migration changed', async () => {
    const fetchImpl = applied([]);
    const generate = vi.fn(() => 0);
    const opts = options({
      changedFiles: [],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      generate,
    });

    const result = await regenerateTypesIfApplied(opts);

    expect(result).toMatchObject({ status: 'skipped', reason: 'no-migrations' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it('skips before the API when the token is absent', async () => {
    const fetchImpl = applied([]);
    const generate = vi.fn(() => 0);
    const opts = options({
      accessToken: '',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      generate,
    });

    const result = await regenerateTypesIfApplied(opts);

    expect(result).toMatchObject({ status: 'skipped', reason: 'no-token' });
    expect(opts.out.all()).toMatch(/SUPABASE_ACCESS_TOKEN is not set/);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it('skips when the changed migration is not applied', async () => {
    const fetchImpl = applied([OLD_VERSION]);
    const generate = vi.fn(() => 0);
    const opts = options({ fetchImpl: fetchImpl as unknown as typeof fetch, generate });

    const result = await regenerateTypesIfApplied(opts);

    expect(result).toMatchObject({
      status: 'skipped',
      reason: 'not-applied',
      pending: [VERSION],
    });
    expect(opts.out.all()).toMatch(new RegExp(`${VERSION}.*not applied`));
    expect(opts.out.all()).toMatch(/skipping TypeScript type regeneration/);
    expect(generate).not.toHaveBeenCalled();
  });

  it('requires every changed migration, not just one of them', async () => {
    const next = '20261119000001';
    const fetchImpl = applied([VERSION]);
    const generate = vi.fn(() => 0);
    const opts = options({
      changedFiles: [MIGRATION, `supabase/migrations/${next}_second.sql`],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      generate,
    });

    const result = await regenerateTypesIfApplied(opts);

    expect(result).toMatchObject({ status: 'skipped', reason: 'not-applied', pending: [next] });
    expect(generate).not.toHaveBeenCalled();
  });

  it('skips when an older local migration is still pending', async () => {
    const fetchImpl = applied([VERSION]);
    const generate = vi.fn(() => 0);
    const opts = options({
      localVersions: [OLD_VERSION, VERSION],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      generate,
    });

    const result = await regenerateTypesIfApplied(opts);

    expect(result).toMatchObject({
      status: 'skipped',
      reason: 'not-applied',
      pending: [OLD_VERSION],
    });
    expect(opts.out.all()).toMatch(new RegExp(`${OLD_VERSION}.*not applied`));
    expect(generate).not.toHaveBeenCalled();
  });

  it('skips when the hosted history cannot be read', async () => {
    const generate = vi.fn(() => 0);
    const opts = options({
      fetchImpl: failed(500, 'boom') as unknown as typeof fetch,
      generate,
    });

    const result = await regenerateTypesIfApplied(opts);

    expect(result).toMatchObject({ status: 'skipped', reason: 'history-unreadable' });
    expect(opts.out.all()).toMatch(/could not read the hosted migration history/);
    expect(generate).not.toHaveBeenCalled();
  });

  it('skips when the hosted history read times out', async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      (_url: string, init: { signal?: AbortSignal } = {}) =>
        new Promise<never>((_resolve, reject) => {
          const requestSignal = init.signal;
          if (!requestSignal) {
            reject(new Error('missing abort signal'));
            return;
          }
          signal = requestSignal;
          if (requestSignal.aborted) {
            reject(requestSignal.reason);
            return;
          }
          requestSignal.addEventListener('abort', () => reject(requestSignal.reason), {
            once: true,
          });
        })
    );
    const generate = vi.fn(() => 0);
    const opts = options({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      generate,
      historyTimeoutMs: 50,
    });

    const result = await regenerateTypesIfApplied(opts);

    expect(result).toMatchObject({ status: 'skipped', reason: 'history-unreadable' });
    expect(result.error).toMatch(/timeout|timed out/i);
    expect(opts.out.all()).toMatch(/could not read the hosted migration history/);
    expect(generate).not.toHaveBeenCalled();
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(true);
  });

  it('skips when the history table is absent', async () => {
    const generate = vi.fn(() => 0);
    const opts = options({
      fetchImpl: failed(
        400,
        'relation "supabase_migrations.schema_migrations" does not exist'
      ) as unknown as typeof fetch,
      generate,
    });

    const result = await regenerateTypesIfApplied(opts);

    expect(result).toMatchObject({ status: 'skipped', reason: 'history-missing' });
    expect(opts.out.all()).toMatch(/could not find the hosted migration history/);
    expect(generate).not.toHaveBeenCalled();
  });

  it('skips when no version can be read from the changed file', async () => {
    const fetchImpl = applied([]);
    const generate = vi.fn(() => 0);
    const opts = options({
      changedFiles: ['supabase/migrations/not_a_migration.sql'],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      generate,
    });

    const result = await regenerateTypesIfApplied(opts);

    expect(result).toMatchObject({ status: 'skipped', reason: 'unrecognized-migration' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it('skips the whole set when one changed migration filename is unrecognized', async () => {
    const fetchImpl = applied([VERSION]);
    const generate = vi.fn(() => 0);
    const opts = options({
      changedFiles: [MIGRATION, 'supabase/migrations/not_a_migration.sql'],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      generate,
    });

    const result = await regenerateTypesIfApplied(opts);

    expect(result).toMatchObject({ status: 'skipped', reason: 'unrecognized-migration' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it('regenerates only after the changed migration is applied', async () => {
    const fetchImpl = applied([VERSION]);
    const generate = vi.fn(() => 0);
    const opts = options({ fetchImpl: fetchImpl as unknown as typeof fetch, generate });

    const result = await regenerateTypesIfApplied(opts);

    expect(result).toMatchObject({
      status: 'generated',
      reason: 'applied',
      versions: [VERSION],
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith(REF);
    expect(opts.out.all()).toMatch(/src\/types\/supabase\.ts updated/);
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://api.supabase.com/v1/projects/${REF}/database/query`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer tok_test',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: APPLIED_MIGRATIONS_QUERY }),
      })
    );
  });

  it('reports a generation failure without throwing', async () => {
    const opts = options({ generate: vi.fn(() => 1) });

    const result = await regenerateTypesIfApplied(opts);

    expect(result).toMatchObject({ status: 'failed', reason: 'generate-failed' });
    expect(opts.out.all()).toMatch(/Type generation failed/);
  });
});

describe('both regeneration hooks', () => {
  it.each([
    ['post-commit', postCommit],
    ['post-merge', postMerge],
  ])('%s leaves types untouched when the migration is not applied', async (_name, hook) => {
    const fetchImpl = applied([OLD_VERSION]);
    const generate = vi.fn(() => 0);
    const out = capture();

    const result = await hook({
      changedFiles: [MIGRATION],
      localVersions: [VERSION],
      accessToken: 'tok_test',
      generate,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      log: out.log,
    });

    expect(result).toMatchObject({ status: 'skipped', reason: 'not-applied' });
    expect(out.all()).toMatch(/not applied/);
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    ['post-commit', postCommit],
    ['post-merge', postMerge],
  ])('%s pins the generator to the canonical project ref', async (_name, hook) => {
    const fetchImpl = applied([VERSION]);
    const generate = vi.fn(() => 0);

    const result = await hook({
      changedFiles: [MIGRATION],
      localVersions: [VERSION],
      accessToken: 'tok_test',
      generate,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toMatchObject({ status: 'generated' });
    expect(generate).toHaveBeenCalledWith(PROJECT_REF);
  });
});
