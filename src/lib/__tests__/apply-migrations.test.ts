// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main as applyMigrations } from '../../../scripts/apply-migrations.mjs';

/**
 * Why this suite exists, when `check-migrations.mjs` already reads the history
 * table.
 *
 * `check-migrations` *observes*; this *mutates*. The defect it guards is one no
 * read-only check can see, and it was latent in the delivery path rather than
 * hypothetical: the migration and the row recording it were two separate HTTP
 * requests.
 *
 * If the second failed, the schema was applied and unrecorded. The next run
 * therefore re-applied a migration that had already succeeded. That is harmless
 * for migrations written with `IF NOT EXISTS` guards and fatal for any that is
 * not — an `ALTER TABLE … ADD COLUMN` re-run raises `42701`, the history row is
 * still never written, and the failure repeats identically on every attempt. The
 * operator is left retrying forever against a schema that is already correct,
 * with every later migration queued behind a statement that cannot succeed
 * twice. The contact form is this exact shape: `20261005010000` changes
 * `submit_contact_submission`'s arity via `DROP FUNCTION` / `CREATE FUNCTION`.
 *
 * So the invariant is narrow and mechanical: **one migration, one request,
 * explicitly transactional.** No live Supabase project is needed to prove it,
 * and nothing here should need a credential — the point is that the delivery
 * path is wrong in a way only a test can see.
 *
 * Environment is passed as an object rather than by mutating `process.env`,
 * which would leak between test files sharing a worker.
 */

const REF = 'ref_test';
const TOKEN = 'tok_test';

let dir: string;

/** Every query string the script sent, in order. */
interface Sent {
  queries: string[];
}

/**
 * Stub the Management API.
 *
 * `historyCalls` gives the answer to each successive read of the history table,
 * so a caller can model a schema that changed while its history row did not —
 * which is exactly the state a torn write leaves behind.
 */
function stubApi(opts: { history?: string[]; historyCalls?: string[][] } = {}) {
  const sent: Sent = { queries: [] };
  let historyReads = 0;
  // The stub records what it is told, the way a real database does. A static
  // history would make the script's own verify pass fail on every success —
  // which says nothing about the script and everything about the double.
  const applied = new Set(opts.history ?? []);
  const seeded = !opts.historyCalls;

  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const query = String(JSON.parse(String(init.body)).query);
      sent.queries.push(query);

      const ok = (rows: unknown[]) => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(rows),
      });

      // A mutation, not a read. Ordering matters: the combined batch contains
      // both an INSERT and the ALTER, and it must not be mistaken for a read.
      const recorded = query.match(
        /INSERT INTO supabase_migrations\.schema_migrations[\s\S]*?VALUES \('(\d+)'/
      );
      if (recorded) {
        if (seeded) applied.add(recorded[1]);
        return ok([]);
      }
      if (query.includes('SELECT version FROM supabase_migrations')) {
        const reads = opts.historyCalls?.[historyReads];
        historyReads += 1;
        if (reads) return ok(reads.map((version) => ({ version })));
        return ok([...applied].map((version) => ({ version })));
      }
      if (query.includes('information_schema')) return ok([{ column_name: 'version' }]);
      if (query.includes('SELECT 1')) return ok([{ ok: 1 }]);
      return ok([]);
    })
  );
  return sent;
}

/** Queries that actually change the database, i.e. exclude the reads. */
function mutations(queries: string[]) {
  return queries.filter((q) => !q.trimStart().startsWith('SELECT'));
}

function env(over: Record<string, string | undefined> = {}) {
  return {
    SUPABASE_PROJECT_REF: REF,
    SUPABASE_ACCESS_TOKEN: TOKEN,
    MIGRATIONS_DIR: dir,
    ...over,
  };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  // Real fixtures in a real directory: `localMigrations` reads and sorts actual
  // filenames, and a stubbed `readdir` would not test the sort it depends on.
  //
  // `mkdtempSync` stays on `node:fs` — Bun has no temp-directory primitive
  // (`Bun.tempdir` does not exist), and a hand-rolled mkdir-plus-random-name
  // is a worse mkdtemp than the one in the standard library.
  dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  await Bun.write(
    join(dir, '20260102000000_second.sql'),
    'ALTER TABLE public.second ADD COLUMN b text;'
  );
  await Bun.write(
    join(dir, '20260101000000_first.sql'),
    'ALTER TABLE public.first ADD COLUMN a text;'
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

describe('apply-migrations: the apply and the record are one unit', () => {
  it('sends each migration and its history row in a single request', async () => {
    const sent = stubApi({ history: ['20260101000000'] });

    await applyMigrations(env());

    // One mutation per migration. Two requests — the migration, then the
    // record — is the defect this suite exists for.
    const muts = mutations(sent.queries);
    expect(muts).toHaveLength(1);

    const mut = muts[0];
    expect(mut).toContain('ALTER TABLE');
    expect(mut).toContain('INSERT INTO supabase_migrations.schema_migrations');
  });

  it('wraps that request in an explicit transaction, committed last', async () => {
    const sent = stubApi({ history: ['20260101000000'] });

    await applyMigrations(env());

    const mut = mutations(sent.queries)[0];
    expect(mut.trimStart().startsWith('BEGIN;')).toBe(true);
    expect(mut.trimEnd().endsWith('COMMIT;')).toBe(true);
    // COMMIT must follow the INSERT. The reverse would record a migration whose
    // schema change has just been rolled back — a history row for work that
    // never happened, which `check-migrations` would then report as converged.
    expect(mut.indexOf('COMMIT;')).toBeGreaterThan(mut.indexOf('INSERT INTO'));
  });

  it('applies pending migrations in filename order, one request each', async () => {
    const sent = stubApi({ history: [] });

    await applyMigrations(env());

    const versions = mutations(sent.queries).map((m) => m.match(/VALUES \('(\d+)'/)?.[1]);
    // Filename order, not lexicographic-by-anything-else: 20260101000000 must
    // precede 20260102000000, or a later migration can reference a table the
    // earlier one has not created.
    expect(versions).toEqual(['20260101000000', '20260102000000']);
  });

  it('never issues a schema change without its history row', async () => {
    // Formulated as "no query ever contains ALTER without INSERT" rather than as
    // a request count, because the count would still pass if the script were
    // changed to send one batch per statement — the invariant is about the two
    // travelling together, not about how many calls there are.
    const sent = stubApi({ history: [] });

    await applyMigrations(env());

    for (const q of mutations(sent.queries)) {
      if (q.includes('ALTER TABLE') || q.includes('CREATE')) {
        expect(q).toContain('INSERT INTO supabase_migrations.schema_migrations');
      }
    }
  });

  it('sends nothing at all when the schema has already converged', async () => {
    const sent = stubApi({ history: ['20260101000000', '20260102000000'] });

    await applyMigrations(env());

    expect(mutations(sent.queries)).toHaveLength(0);
  });

  it('refuses without credentials rather than reporting a clean run', async () => {
    // A missing token must be a fault. Answering "converged, nothing to do"
    // because the reads silently returned nothing would report a schema as
    // correct that was never inspected.
    const sent = stubApi();

    await expect(applyMigrations(env({ SUPABASE_ACCESS_TOKEN: undefined }))).rejects.toThrow(
      /SUPABASE_ACCESS_TOKEN/
    );
    expect(sent.queries).toHaveLength(0);
  });

  it('fails when the verify pass shows a migration still missing', async () => {
    // The re-read after applying. If it still shows pending, something did not
    // take, and succeeding would hand the operator a schema they believe is
    // live.
    const sent = stubApi({ historyCalls: [['20260101000000'], ['20260101000000']] });

    await expect(applyMigrations(env())).rejects.toThrow(/verify failed/);
    expect(sent.queries.some((q) => q.includes('SELECT version FROM'))).toBe(true);
  });

  it('fails when the migration cannot be applied at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const query = String(JSON.parse(String(init.body)).query);
        if (query.includes('SELECT version FROM')) {
          return { ok: true, status: 200, text: async () => JSON.stringify([]) };
        }
        if (query.includes('information_schema')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify([{ column_name: 'version' }]),
          };
        }
        if (query.includes('SELECT 1')) {
          return { ok: true, status: 200, text: async () => JSON.stringify([{ ok: 1 }]) };
        }
        return { ok: false, status: 400, text: async () => 'syntax error at or near "ALTER"' };
      })
    );

    await expect(applyMigrations(env())).rejects.toThrow(/400|syntax error/);
  });

  it('refuses an empty migration file rather than recording it as applied', async () => {
    // The trap: an empty batch would still INSERT the history row, so the
    // migration would be recorded as delivered having changed nothing, and
    // never retried.
    await Bun.write(join(dir, '20260101000000_first.sql'), '');
    const sent = stubApi({ history: ['20260102000000'] });

    await expect(applyMigrations(env())).rejects.toThrow(/empty/);
    expect(mutations(sent.queries)).toHaveLength(0);
  });
});
