/**
 * Read the hosted project's applied migration versions.
 *
 * This is the one Management API read shared by `check-migrations.mjs` and the
 * post-commit / post-merge type-regeneration guards. It is read-only: no CLI,
 * no direct database connection, no writes.
 *
 * The API has returned the rows in a few different shapes over time (`array`,
 * `{result}`, `{data}`, ...). Callers get a Set of version strings and do not
 * have to know which shape answered.
 */

const API = 'https://api.supabase.com';

/**
 * A commit or pull must not wait indefinitely on the Management API. Five
 * seconds is enough for this single read on a healthy connection; the
 * regeneration guard catches a timeout as unreadable history and skips.
 */
export const MIGRATION_HISTORY_TIMEOUT_MS = 5_000;

export const APPLIED_MIGRATIONS_QUERY =
  'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;';

/**
 * @param {object} options
 * @param {string} options.ref
 * @param {string} options.token
 * @param {typeof fetch} [options.fetchImpl]
 * @param {number} [options.timeoutMs] Abort the request after this long.
 * @returns {Promise<Set<string>>}
 */
export async function readAppliedMigrationVersions({
  ref,
  token,
  fetchImpl = fetch,
  timeoutMs = MIGRATION_HISTORY_TIMEOUT_MS,
}) {
  const res = await fetchImpl(`${API}/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: APPLIED_MIGRATIONS_QUERY }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API HTTP ${res.status}: ${text.slice(0, 300)}`);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Management API returned non-JSON');
  }

  let rows;
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else {
    for (const key of ['result', 'data', 'rows', 'results']) {
      if (Array.isArray(parsed?.[key])) {
        rows = parsed[key];
        break;
      }
    }
  }
  if (!rows) {
    throw new Error(
      `Unrecognized API response shape (keys: ${Object.keys(parsed ?? {}).join(',')})`
    );
  }

  return new Set(rows.map((row) => String(row.version ?? row[0])));
}
