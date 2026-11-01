// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  main as checkSchemaHygiene,
  findRedundantIndexes,
  findUngovernedGrants,
} from '../../../scripts/check-schema-hygiene.mjs';

/**
 * The schema hygiene gate's decision table.
 *
 * The gate exists because four separate audits each re-derived the same
 * catalogue queries by hand. That makes its *correctness* the whole point: a
 * check that reports clean while measuring nothing is worse than no check, since
 * it retires the vigilance that would otherwise have caught the problem. The
 * `AGENTS.md` record of `no-node-runtime --all` — a flag the tool did not
 * understand, treated as a filename, exiting 0 — is the exact failure this file
 * is written against.
 *
 * Three outcomes, and they must never collapse into one another:
 *
 *   clean     → exit 0, and the notice says what was checked
 *   findings  → exit 1, naming the table and the index/constraint involved
 *   cannot run→ exit 1, saying so in those words rather than implying clean
 *
 * The remote path is exercised with a stubbed `fetch`, so proving the decision
 * table needs no credential and no live project.
 */

/** A complete credential, or a partial one, as the case demands. */
function env(over: Record<string, string | undefined> = {}) {
  return {
    SUPABASE_PROJECT_REF: 'ref_test',
    SUPABASE_ACCESS_TOKEN: 'tok_test',
    ...over,
  };
}

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

/**
 * Rows per invariant, keyed by a fragment unique to each query.
 *
 * Keying on the query text rather than call order is deliberate: the order of
 * `CHECKS` is an implementation detail, and a test that depended on it would
 * break the moment someone added an invariant — which is the change most likely
 * to happen.
 */
function stubApi(rowsByFragment: Record<string, unknown[]>, bootOk = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
      if (!bootOk) return { ok: false, status: 500, text: async () => 'boom' };
      const { query } = JSON.parse(init.body) as { query: string };
      if (query.includes('AS ok'))
        return { ok: true, text: async () => JSON.stringify([{ ok: 1 }]) };
      for (const [fragment, rows] of Object.entries(rowsByFragment)) {
        if (query.includes(fragment)) return { ok: true, text: async () => JSON.stringify(rows) };
      }
      return { ok: true, text: async () => '[]' };
    })
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('check-schema-hygiene: clean schema', () => {
  it('exits 0 and states the invariants it evaluated', async () => {
    stubApi({});
    const out = captureOutput();

    const exit = await checkSchemaHygiene(env());

    expect(out.all()).toMatch(/Schema hygiene clean/);
    expect(out.all()).not.toMatch(/::error::/);
    out.restore();
    expect(exit).toBe(0);
  });
});

describe('check-schema-hygiene: findings', () => {
  it('fails and names both indexes when one duplicates another', async () => {
    stubApi({
      indisunique: [
        {
          table_name: 'products',
          index_name: 'idx_dup_slug',
          column_key: '1',
          is_unique: false,
        },
        {
          table_name: 'products',
          index_name: 'products_slug_key',
          column_key: '1',
          is_unique: false,
        },
      ],
    });
    const out = captureOutput();

    const exit = await checkSchemaHygiene(env());

    const said = out.all();
    // Both names must appear: the message is a question for a human, and
    // dropping the wrong one of the pair is a silent performance regression.
    expect(said).toMatch(/idx_dup_slug/);
    expect(said).toMatch(/products_slug_key/);
    expect(said).toMatch(/::error::/);
    out.restore();
    expect(exit).toBe(1);
  });

  it('fails when a public table has RLS disabled', async () => {
    stubApi({
      relrowsecurity: [{ table_name: 'orders', detail: 'relrowsecurity is false' }],
    });
    const out = captureOutput();

    const exit = await checkSchemaHygiene(env());

    expect(out.all()).toMatch(/orders/);
    out.restore();
    expect(exit).toBe(1);
  });

  it('fails when a service-only table still grants a public role', async () => {
    stubApi({
      aclexplode: [
        {
          table_name: 'search_rate_limit',
          role_name: 'anon',
          privilege: 'SELECT',
          has_policy: false,
        },
        {
          table_name: 'search_rate_limit',
          role_name: 'authenticated',
          privilege: 'SELECT',
          has_policy: false,
        },
      ],
    });
    const out = captureOutput();

    const exit = await checkSchemaHygiene(env());

    expect(out.all()).toMatch(/search_rate_limit/);
    expect(out.all()).toMatch(/anon, authenticated/);
    out.restore();
    expect(exit).toBe(1);
  });
});

describe('check-schema-hygiene: a finding cannot depend on an index name', () => {
  it('reports the same prefix pair whichever name sorts first', () => {
    // The bug this pins: the pair was handed to the predicate in name order, and
    // the prefix test is asymmetric, so `zzz_short` beside `aaa_wide` produced no
    // finding while `aaa_short` beside `zzz_wide` did — the same schema, the same
    // defect, two different verdicts.
    const pair = (shortName: string, wideName: string) => [
      { table_name: 'orders', index_name: shortName, column_key: '1', is_unique: false },
      { table_name: 'orders', index_name: wideName, column_key: '1 2', is_unique: false },
    ];

    const sortsFirst = findRedundantIndexes(pair('aaa_short', 'zzz_wide'));
    const sortsLast = findRedundantIndexes(pair('zzz_short', 'aaa_wide'));

    expect(sortsFirst).toHaveLength(1);
    expect(sortsLast).toHaveLength(1);
    expect(sortsFirst[0]).toMatch(/aaa_short.*zzz_wide.*columns are a prefix/);
    expect(sortsLast[0]).toMatch(/zzz_short.*aaa_wide.*columns are a prefix/);

    // The wider index is never the one to drop: it serves every lookup the
    // shorter one does, so naming it would be the performance regression the
    // check exists to prevent.
    expect(sortsFirst[0]).not.toMatch(/^orders: zzz_wide/);
    expect(sortsLast[0]).not.toMatch(/^orders: aaa_wide/);
  });
});

describe('check-schema-hygiene: privileges RLS cannot govern', () => {
  it('flags a policy-bearing table that grants only TRUNCATE', () => {
    // The blind spot: the old invariant required zero policies, so the one
    // privilege set that no policy restricts was checked only on tables whose
    // grants had already been revoked. TRUNCATE is the clearest case — it
    // empties the table without consulting a policy at all.
    const truncateOnly = [
      { table_name: 'audit_log', role_name: 'anon', privilege: 'TRUNCATE', has_policy: true },
      {
        table_name: 'audit_log',
        role_name: 'authenticated',
        privilege: 'TRUNCATE',
        has_policy: true,
      },
    ];

    const findings = findUngovernedGrants(truncateOnly);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatch(/audit_log: TRUNCATE granted to anon, authenticated/);

    // The guard against over-firing: a policy-bearing table granting the four
    // row-governed privileges is the normal, correct shape — every readable
    // table in this project looks like this, and flagging them would make the
    // check noise nobody reads.
    const governed = [
      { table_name: 'orders', role_name: 'anon', privilege: 'SELECT', has_policy: true },
      { table_name: 'orders', role_name: 'authenticated', privilege: 'INSERT', has_policy: true },
    ];
    expect(findUngovernedGrants(governed)).toEqual([]);
  });
});

describe('check-schema-hygiene: what it must never claim', () => {
  it('reports a missing credential as a configuration fault, not a clean schema', async () => {
    const out = captureOutput();

    const exit = await checkSchemaHygiene(
      env({ SUPABASE_PROJECT_REF: undefined, SUPABASE_ACCESS_TOKEN: undefined })
    );

    const said = out.all();
    expect(said).toMatch(/configuration fault on our side/);
    expect(said).not.toMatch(/Schema hygiene clean/);
    out.restore();
    expect(exit).toBe(1);
  });

  it('treats an unreachable API as "did not run", never as clean', async () => {
    stubApi({}, false);
    const out = captureOutput();

    const exit = await checkSchemaHygiene(env());

    expect(out.all()).toMatch(/did not run/);
    expect(out.all()).not.toMatch(/Schema hygiene clean/);
    out.restore();
    expect(exit).toBe(1);
  });

  it('treats a failed individual query as "did not run", not as that invariant passing', async () => {
    // The subtle one: a later invariant cannot be assumed clean because an
    // earlier query errored. Partial evaluation must stop the run.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
        const { query } = JSON.parse(init.body) as { query: string };
        if (query.includes('AS ok'))
          return { ok: true, text: async () => JSON.stringify([{ ok: 1 }]) };
        if (query.includes('contype'))
          return { ok: false, status: 400, text: async () => 'bad sql' };
        return { ok: true, text: async () => '[]' };
      })
    );
    const out = captureOutput();

    const exit = await checkSchemaHygiene(env());

    expect(out.all()).toMatch(/did not run/);
    expect(out.all()).not.toMatch(/Schema hygiene clean/);
    out.restore();
    expect(exit).toBe(1);
  });
});
