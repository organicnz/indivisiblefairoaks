// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main as checkMigrations } from '../../../scripts/check-migrations.mjs';

/**
 * The pre-merge migration gate's decision table.
 *
 * The gate exists because `supabase.yml`'s `migrate` cannot be a required
 * status check: it triggers on `supabase/**` pushes, so it never reports on a
 * pull request, and a required check that skips would block every PR not
 * touching that path.
 *
 * Two properties matter more than the individual messages, and both are about
 * the check never overstating what it knows:
 *
 *  1. **Local faults need no credentials.** A malformed filename is a fact
 *     about the checkout, so reporting it must not depend on a token — otherwise
 *     the check answers "cannot check" for a repository it could have diagnosed.
 *  2. **An unreadable history is not a clean history.** If the Management API
 *     cannot be read, that is a fault, not a pass.
 *
 * The remote path is exercised with a stubbed `fetch` rather than a live project:
 * nothing here should need a credential to prove the decision table.
 *
 * Environment is passed as an *object* rather than by mutating `process.env`.
 * Two reasons: the script takes `env` as a parameter precisely so this is
 * possible, and mutating the process environment leaks between test files in the
 * same worker — which is how a suite ends up passing on another suite's setup.
 */

const REAL_DIR = 'supabase/migrations';

/** A complete credential, or a partial one, as the case demands. */
function env(over: Record<string, string | undefined> = {}) {
  return {
    MIGRATIONS_DIR: REAL_DIR,
    SUPABASE_PROJECT_REF: 'ref_test',
    SUPABASE_ACCESS_TOKEN: 'tok_test',
    ...over,
  };
}

/** Collect what the script printed, so assertions can read its own report. */
function captureOutput() {
  const lines: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.join(' '));
  });
  return {
    lines,
    all: () => lines.join('\n'),
    restore: () => vi.restoreAllMocks(),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('check-migrations: local invariants', () => {
  it("accepts this repository's migrations and reports the file count", async () => {
    const out = captureOutput();

    // No credentials, so this stops after the local checks — which is the point:
    // proving the 24 committed migrations are locally well-formed needs no
    // token and no network, and must not silently depend on either.
    const exit = await checkMigrations(
      env({ SUPABASE_PROJECT_REF: undefined, SUPABASE_ACCESS_TOKEN: undefined })
    );

    expect(out.all()).toMatch(/locally well-formed/);
    expect(out.all()).not.toMatch(/Malformed|Duplicate|Empty/);
    out.restore();
    expect(exit).toBe(1);
  });

  it('fails on a missing migrations directory', async () => {
    const out = captureOutput();

    expect(
      await checkMigrations(env({ MIGRATIONS_DIR: 'supabase/migrations-does-not-exist' }))
    ).toBe(1);
    expect(out.all()).toMatch(/No migrations directory/);
    out.restore();
  });
});

describe('check-migrations: what it must never claim', () => {
  it('reports a credential gap as a configuration fault, not as a migration fault', async () => {
    // The distinction that matters operationally: this is ours to fix, and
    // reporting it as a bad migration sends someone to edit a SQL file that is
    // fine.
    const out = captureOutput();

    await checkMigrations(
      env({ SUPABASE_PROJECT_REF: undefined, SUPABASE_ACCESS_TOKEN: undefined })
    );

    const said = out.all();
    expect(said).toMatch(/configuration fault on our side/);
    expect(said).not.toMatch(/::error::Version|::error::Malformed/);
    out.restore();
  });

  it('treats an unreadable history as a fault, never as a clean history', async () => {
    // A 500 is not "no history". Collapsing the two would let a broken API read
    // as "migrations are fine" — the same class as treating a failed read as an
    // empty store.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'boom',
      })
    );
    const out = captureOutput();

    expect(await checkMigrations(env())).toBe(1);
    expect(out.all()).toMatch(/Could not read migration history/);
    expect(out.all()).toMatch(/NOT evidence about the migrations/);
    out.restore();
  });

  it('accepts a project with no history table as genuinely unapplied', async () => {
    // "does not exist" is a real state, and it means nothing is applied — which
    // is not a fault. It must be stated, though, because "nothing applied" and
    // "we could not read" are different.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'relation "supabase_migrations.schema_migrations" does not exist',
      })
    );
    const out = captureOutput();

    expect(await checkMigrations(env())).toBe(0);
    expect(out.all()).toMatch(/treating as nothing applied/);
    out.restore();
  });
});

describe('check-migrations: history cross-checks', () => {
  /** Answer the single `SELECT version …` call the script makes. */
  function stubHistory(versions: string[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(versions.map((version) => ({ version }))),
      })
    );
  }

  it('passes when local files are a superset of what is applied', async () => {
    // A realistic split: the four 20261005* migrations this branch introduces
    // are pending, the earlier history is applied.
    stubHistory(['00000000000000', '20260904120000', '20260922000000', '20260923140000']);
    const out = captureOutput();

    expect(await checkMigrations(env())).toBe(0);
    expect(out.all()).toMatch(/Migration history is coherent/);
    out.restore();
  });

  it('warns — does not fail — on a migration numbered below the highest applied', async () => {
    // The distinction this pins, and it is the difference between a useful gate
    // and one that wedges every PR. The same condition means either "someone
    // added this late" (real) or "the remote history table does not list it"
    // (completely normal — the canonical schema is bookkeeping, some migrations
    // predate the table). Telling those apart needs the PR's changed-file set,
    // which this script must not guess at. So it reports, and `db push` catches
    // the real divergence at delivery.
    stubHistory(['00000000000000', '20260923140000']);
    const out = captureOutput();

    const exit = await checkMigrations(env());
    const said = out.all();

    expect(exit).toBe(0);
    expect(said).toMatch(/::warning::.*numbered below/);
    // Never promoted to an error — that is the whole point.
    expect(said).not.toMatch(/::error::.*numbered below/);
    out.restore();
  });

  it('does not warn about the all-zeros canonical baseline', async () => {
    // `00000000000000_canonical_schema.sql` exists to sort first. Treating it as
    // a late addition would report the repository's own baseline as a problem.
    stubHistory(['20260923140000']);
    const out = captureOutput();

    await checkMigrations(env());
    expect(out.all()).not.toMatch(/canonical_schema\.sql` is numbered below/);
    out.restore();
  });

  it('fails when an applied version has no local file', async () => {
    // A migration deleted or renamed after it shipped. `db push` will refuse,
    // and the refusal names a version rather than the file you removed. Unlike
    // the ordering warning this is unambiguous, so it is a hard failure.
    stubHistory(['20260922000000', '20990101000000']);
    const out = captureOutput();

    expect(await checkMigrations(env())).toBe(1);
    expect(out.all()).toMatch(/20990101000000 is recorded as applied/);
    expect(out.all()).toMatch(/deleted or renamed/);
    out.restore();
  });

  it('reports an empty history as unapplied, not as coherent-by-omission', async () => {
    // An empty history against a non-empty local set is the one input where a
    // silent pass would be worst: the gate would report "coherent" for a project
    // it had not actually compared against anything.
    stubHistory([]);
    const out = captureOutput();

    await checkMigrations(env());

    const said = out.all();
    expect(said).toMatch(/0 applied on the hosted project/);
    // Not a failure — nothing applied is legitimate — but it must be stated,
    // and it must not be reported as "nothing pending" when 24 are pending.
    expect(said).not.toMatch(/nothing pending/);
    out.restore();
  });
});
