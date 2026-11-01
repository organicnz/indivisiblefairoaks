#!/usr/bin/env bun
/**
 * Schema hygiene check — read-only, hosted project.
 *
 *   bun scripts/check-schema-hygiene.mjs
 *
 * ## Why this exists
 *
 * Four separate audits of this database each re-derived the same catalogue
 * queries by hand, and each found something the previous ones had missed:
 * three indexes duplicating a sibling, a service-only table whose privileges
 * were still granted to `anon` and `authenticated`, and a corpus of foreign
 * keys that had to be checked one by one to confirm they were all indexed.
 *
 * Those are not one-off findings. They are properties of the schema that drift
 * back as migrations accumulate, and the cost of re-deriving them by hand is
 * why they went unchecked between audits. A property worth checking twice is
 * worth a command.
 *
 * ## What it checks — four invariants, all from `pg_catalog`
 *
 *   1. **Every table has RLS enabled.** A table created outside the migration
 *      flow — by a dashboard, a restore, an ad-hoc session — is invisible to
 *      `rls-table-guard.mjs`, which only reads staged migration SQL.
 *
 *   2. **No index duplicates or is covered by another.** An exact duplicate
 *      costs a write on every INSERT/UPDATE and buys nothing; an index whose
 *      columns are a prefix of a wider one is the same deal, because a
 *      composite btree serves every lookup the leading columns served. The
 *      comparison runs in `findRedundantIndexes`, not in the query: a
 *      self-join that deduplicated pairs by index *name* reported the pair only
 *      when the shorter index's name happened to sort first, so two identical
 *      schemas disagreed depending on what the indexes were called.
 *
 *   3. **Every foreign key has a leading index.** Without one, each parent
 *      delete and each join resolves the child by scanning it, and with RLS the
 *      check runs per row.
 *
 *   4. **No public role holds a privilege row-level security cannot govern,**
 *      and a service-only table grants the public roles nothing at all. RLS
 *      filters rows for SELECT/INSERT/UPDATE/DELETE. It does not govern
 *      TRUNCATE, REFERENCES, TRIGGER or MAINTAIN, so the policy count on the
 *      table is irrelevant to those four — which is why `search_rate_limit`
 *      needed a REVOKE rather than a policy. The earlier version of this check
 *      only looked at tables with zero policies, i.e. the one set where the
 *      grants had already been revoked, and was blind to the same privilege on
 *      every table it considered protected.
 *
 * ## What this deliberately does NOT check — read before trusting a green
 *
 *   - **`auth` and `storage` schemas.** Their duplicate indexes are real (GoTrue
 *     and Storage ship several) and are not ours to drop. Only `public` is
 *     checked, because only `public` is ours.
 *   - **Whether a flagged index is actually unused.** `idx_scan = 0` is not
 *     evidence: a feature that ships tomorrow needs its index today, and this
 *     project has CRM tables with no traffic yet. Duplication is a schema fact;
 *     usage is a traffic fact, and only the first belongs in a gate.
 *   - **Query performance.** No EXPLAIN runs here. A missing index is a defect;
 *     a slow query may be a plan problem, a stat problem, or a cold catalogue.
 *   - **Partitioned tables and indexes on expressions.** The prefix comparison
 *     reads `indkey`, which does not represent expression indexes faithfully, so
 *     those are excluded rather than mis-reported. `indpred IS NULL` does the
 *     same job for partial indexes — and that exclusion is load-bearing:
 *     `idx_crm_contacts_opted_in_id` and `crm_broadcasts_recent_idx` share keys
 *     with wider indexes and are *not* redundant, because their predicates make
 *     them far smaller. A naive key comparison flagged both.
 *
 * A finding here is a question, not a verdict: two indexes with the same columns
 * and different operator classes are not interchangeable, and the message names
 * both so a human can look. Dropping the wrong one is a performance regression
 * nobody notices until the data grows.
 */

/**
 * Privileges that row-level security does not govern.
 *
 * RLS intercepts SELECT, INSERT, UPDATE and DELETE. TRUNCATE empties a table
 * with no policy consulted at all; REFERENCES lets a role build a foreign key
 * onto rows it cannot read; TRIGGER lets it attach a trigger to the table; and
 * MAINTAIN (new in Postgres 17) covers VACUUM, ANALYZE and CLUSTER. A grant of
 * any of these survives every policy, so the policy count on the table is not
 * evidence about it.
 */
export const RLS_UNCOVERABLE_PRIVILEGES = ['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'];

const API = 'https://api.supabase.com';

const notice = (m) => console.log(`::notice::${m}`);
const error = (m) => console.log(`::error::${m}`);

/**
 * @param {string} query
 * @param {{ref: string, token: string}} creds
 * @returns {Promise<Record<string, unknown>[]>}
 */
async function api(query, { ref, token }) {
  const res = await fetch(`${API}/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API HTTP ${res.status}: ${text.slice(0, 300)}`);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Management API returned non-JSON');
  }
  if (Array.isArray(parsed)) return parsed;
  for (const key of ['result', 'data', 'rows', 'results']) {
    if (Array.isArray(parsed?.[key])) return parsed[key];
  }
  throw new Error(`Unrecognized API response shape (keys: ${Object.keys(parsed ?? {}).join(',')})`);
}

/**
 * @typedef {{ table_name: string, index_name: string, is_unique: boolean, column_key: string }} IndexFact
 * @typedef {{ table_name: string, role_name: string, privilege: string, has_policy: boolean }} GrantFact
 */

/** Postgres booleans arrive as `true`/`false` through the API, but `'t'`/`'f'` is common enough to accept. */
const truthy = (value) => value === true || value === 't';

const sameColumns = (a, b) =>
  a.columns.length === b.columns.length && a.columns.every((c, i) => c === b.columns[i]);

const isStrictPrefix = (short, long) =>
  short.length < long.length && short.every((c, i) => c === long[i]);

/**
 * Indexes whose columns are duplicated, or covered by a sibling's leading columns.
 *
 * Every unordered pair is considered once, and the prefix test is asked in both
 * directions. That is the whole fix. The previous SQL applied
 * `a.name < b.name` around the *entire* predicate, so the asymmetric prefix
 * branch only ever saw the pair with the lexicographically earlier index on the
 * left: `zzz_short` beside `aaa_wide` produced no finding, while the same pair
 * named `aaa_short`/`zzz_wide` did.
 *
 * @param {IndexFact[]} rows
 * @returns {string[]}
 */
export function findRedundantIndexes(rows) {
  /** @type {Map<string, {name: string, columns: string[], unique: boolean}[]>} */
  const byTable = new Map();
  for (const row of rows) {
    const table = String(row.table_name);
    const columns = String(row.column_key ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    // Expression and whole-row indexes are excluded by the query; a row with no
    // columns anyway cannot be compared, and guessing would be worse.
    if (columns.length === 0) continue;
    if (!byTable.has(table)) byTable.set(table, []);
    byTable.get(table).push({
      name: String(row.index_name),
      columns,
      unique: truthy(row.is_unique),
    });
  }

  const findings = [];
  for (const table of [...byTable.keys()].sort()) {
    const indexes = byTable
      .get(table)
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (let i = 0; i < indexes.length; i += 1) {
      for (let j = i + 1; j < indexes.length; j += 1) {
        const a = indexes[i];
        const b = indexes[j];
        if (sameColumns(a, b)) {
          // Two unique indexes on the same columns each enforce the constraint,
          // so neither is redundant. Otherwise name the one that is not carrying
          // a guarantee; with neither unique the choice is arbitrary, so it is
          // pinned to the name ordering rather than to query order.
          if (a.unique && b.unique) continue;
          const redundant = a.unique ? b : a;
          const kept = redundant === a ? b : a;
          findings.push(`${table}: ${redundant.name} vs ${kept.name} (identical columns)`);
        } else if (!a.unique && isStrictPrefix(a.columns, b.columns)) {
          findings.push(`${table}: ${a.name} vs ${b.name} (columns are a prefix)`);
        } else if (!b.unique && isStrictPrefix(b.columns, a.columns)) {
          findings.push(`${table}: ${b.name} vs ${a.name} (columns are a prefix)`);
        }
      }
    }
  }
  return findings;
}

/**
 * Grants held by `anon` or `authenticated` that RLS cannot take back, plus any
 * grant at all on a table with no policies.
 *
 * @param {GrantFact[]} rows
 * @returns {string[]}
 */
export function findUngovernedGrants(rows) {
  /** @type {Map<string, {hasPolicy: boolean, grants: {role: string, privilege: string}[]}>} */
  const byTable = new Map();
  for (const row of rows) {
    const table = String(row.table_name);
    const entry = byTable.get(table) ?? { hasPolicy: truthy(row.has_policy), grants: [] };
    entry.grants.push({ role: String(row.role_name), privilege: String(row.privilege) });
    byTable.set(table, entry);
  }

  const findings = [];
  for (const table of [...byTable.keys()].sort()) {
    const { hasPolicy, grants } = byTable.get(table);
    const roles = [...new Set(grants.map((g) => g.role))].sort().join(', ');
    const privileges = [...new Set(grants.map((g) => g.privilege))].sort();

    if (!hasPolicy) {
      findings.push(
        `${table}: grants to ${roles} (${privileges.join(', ')}) — no policies, so every row is denied, but the grants outlive the policy count`
      );
      continue;
    }

    const ungoverned = privileges.filter((p) => RLS_UNCOVERABLE_PRIVILEGES.includes(p));
    if (ungoverned.length > 0) {
      findings.push(
        `${table}: ${ungoverned.join(', ')} granted to ${roles} — row-level security does not govern ${
          ungoverned.length === 1 ? 'this privilege' : 'these privileges'
        }`
      );
    }
  }
  return findings;
}

/**
 * The four invariants. Two return only violations and describe a row; two return
 * facts and hand them to `decide`, because their rule is a comparison between
 * rows and belongs somewhere it can be tested without a database.
 *
 * Keeping them as separate queries rather than one UNION is deliberate: a
 * failure should name the invariant, because "index hygiene is red" is a
 * different message from "a table is readable without RLS", and the person
 * reading the log is usually reading only the failing line.
 */
const CHECKS = [
  {
    name: 'RLS enabled on every public table',
    query: `
      SELECT c.relname AS table_name,
             'relrowsecurity is false' AS detail
      FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity
      ORDER BY 1;`,
    describe: (r) => `${r.table_name}: ${r.detail}`,
  },
  {
    name: 'no duplicate or prefix-covered indexes',
    // The query returns facts and the comparison happens in JS. Expressed as a
    // SQL self-join, the pair had to be handed to the predicate in one
    // orientation, and the prefix test is asymmetric — so the answer depended
    // on which index name sorted first, and half of all name orderings hid the
    // duplicate.
    query: `
      SELECT c.relname AS table_name,
             i.indexrelid::regclass::text AS index_name,
             i.indisunique AS is_unique,
             i.indkey::text AS column_key
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      WHERE i.indisvalid
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND c.relnamespace = 'public'::regnamespace
        AND c.relkind = 'r'
      ORDER BY 1, 2;`,
    decide: findRedundantIndexes,
  },
  {
    name: 'every foreign key has a leading index',
    query: `
      SELECT c.conrelid::regclass::text AS table_name,
             string_agg(a.attname, ', ' ORDER BY a.attnum) AS columns,
             c.conname AS constraint_name
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f'
        AND c.connamespace = 'public'::regnamespace
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]
        )
      GROUP BY c.conrelid::regclass::text, c.conname
      ORDER BY 1;`,
    describe: (r) => `${r.table_name}(${r.columns}) — ${r.constraint_name}`,
  },
  {
    name: 'no grant to a public role that row-level security cannot govern',
    // Per-grant facts, one row per table/role/privilege, because the decision
    // depends on the privilege *and* on whether the table has policies — and
    // the previous query made the policy count a filter, which excluded exactly
    // the tables where an ungoverned grant survives.
    query: `
      SELECT c.relname AS table_name,
             r.rolname AS role_name,
             p.privilege_type AS privilege,
             EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = c.oid) AS has_policy
      FROM pg_class c
      CROSS JOIN LATERAL aclexplode(c.relacl) p
      JOIN pg_roles r ON r.oid = p.grantee
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relkind = 'r'
        AND r.rolname IN ('anon', 'authenticated')
      ORDER BY 1, 2, 3;`,
    decide: findUngovernedGrants,
  },
];

/**
 * @param {Record<string, string | undefined>} [env]
 *   Partial-record annotation is load-bearing: an unannotated `env = Bun.env`
 *   infers `ProcessEnv`, which requires `NODE_ENV` and so rejects any caller
 *   passing only the keys this reads.
 * @returns {Promise<number>} process exit code
 */
export async function main(env = Bun.env) {
  const ref = env.SUPABASE_PROJECT_REF ?? '';
  const token = env.SUPABASE_ACCESS_TOKEN ?? '';

  if (!ref || !token) {
    error('SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN are not set — schema hygiene not checked.');
    error('This is a configuration fault on our side, not evidence about the schema.');
    return 1;
  }

  const creds = { ref, token };
  // Boot check first: it separates "auth/network is broken" from "the schema has
  // findings", which are the same exit code but not the same problem.
  try {
    await api('SELECT 1 AS ok;', creds);
  } catch (e) {
    error(`Management API unreachable: ${String(e?.message ?? e).slice(0, 300)}`);
    error('The check did not run. This is NOT evidence about the schema.');
    return 1;
  }

  /** @type {{check: string, message: string}[]} */
  const findings = [];

  for (const check of CHECKS) {
    let rows;
    try {
      rows = await api(check.query, creds);
    } catch (e) {
      error(`Could not evaluate "${check.name}": ${String(e?.message ?? e).slice(0, 300)}`);
      error('The check did not run. This is NOT evidence about the schema.');
      return 1;
    }
    const messages = check.decide ? check.decide(rows) : rows.map((row) => check.describe(row));
    for (const message of messages) findings.push({ check: check.name, message });
  }

  if (findings.length > 0) {
    for (const f of findings) error(`${f.check}: ${f.message}`);
    error(
      `${findings.length} schema hygiene finding(s). Each is a question, not a verdict — ` +
        'read the definitions before dropping or revoking anything.'
    );
    return 1;
  }

  notice(`Schema hygiene clean across ${CHECKS.length} invariants on project ${ref}.`);
  return 0;
}

// Auto-run only when invoked directly — importing this from a test must not
// execute a query against the hosted project. `main` is exported so its
// decision table (configuration fault vs. finding vs. clean) can be pinned.
if (process.argv[1]?.endsWith('check-schema-hygiene.mjs')) {
  process.exit(await main());
}
