#!/usr/bin/env bun
/**
 * Store the Mobilize sync credential in Supabase Vault.
 *
 * The sync runs from `pg_cron` → `pg_net` → `sync-mobilize-events`, and the
 * scheduled command resolves its URL and service key from Vault at run time
 * (see `supabase/migrations/20261031120000_mobilize_events.sql`). That is
 * deliberate: interpolating the key into the migration would copy it into
 * `cron.job.command`, where it would sit in plaintext for the life of the job.
 *
 * Until this script runs, the scheduled job is a no-op — the command carries a
 * `where exists (select 1 from vault.decrypted_secrets …)`. Nothing fails
 * loudly and nothing syncs. **The admin "Sync now" button is unaffected**: it
 * authenticates from the Next server with `SUPABASE_SECRET_KEY`, so it works
 * before this has ever run.
 *
 *   bun scripts/seed-mobilize-cron.mjs            # apply
 *   bun scripts/seed-mobilize-cron.mjs --dry-run  # print the statement, key masked
 *
 * ## Two transports, because one of them needs a credential nobody has
 *
 *   1. `--db-url <postgres-url>` or `SUPABASE_DB_URL` — needs only the database
 *      password. This is the path that works with nothing else configured.
 *   2. `SUPABASE_ACCESS_TOKEN` — the Management API.
 *
 * The script used to require (2), which meant that on a machine with no
 * Management token the schedule could not be turned on at all, even though the
 * database password was sitting right there. The SQL is a single `do` block
 * precisely so it runs unchanged on both: `supabase db query` sends one query
 * at a time, and a multi-statement file is rejected with "cannot insert
 * multiple commands into a prepared statement".
 *
 * The service key comes from `SUPABASE_SECRET_KEY` and is never printed — not
 * on success, not on failure, and not in `--dry-run`, which masks it.
 */

import { runAsync } from './bun-exec.mjs';

const API = 'https://api.supabase.com';

function env(key) {
  return (Bun.env[key] ?? '').trim();
}

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

/** `--db-url <url>`, tolerating `--db-url=<url>`. */
function dbUrlFlag() {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--db-url') return argv[i + 1] ?? '';
    if (argv[i].startsWith('--db-url=')) return argv[i].slice('--db-url='.length);
  }
  return '';
}

const dbUrl = (dbUrlFlag() || env('SUPABASE_DB_URL')).trim();
const token = env('SUPABASE_ACCESS_TOKEN');
const secretKey = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
const supabaseUrl = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL');

function projectRef() {
  const explicit = env('SUPABASE_PROJECT_REF');
  if (explicit) return explicit;
  if (supabaseUrl) {
    try {
      return new URL(supabaseUrl).hostname.split('.')[0];
    } catch {
      return '';
    }
  }
  return '';
}

/** The ref also arrives inside a pooler username (`postgres.<ref>`), so a
 *  `--db-url` on its own is enough to name the project. */
function refFromDbUrl(url) {
  try {
    const user = decodeURIComponent(new URL(url).username);
    const candidate = user.includes('.') ? user.split('.').pop() : '';
    return candidate && candidate.length === 20 ? candidate : '';
  } catch {
    return '';
  }
}

const ref = projectRef() || refFromDbUrl(dbUrl);

if (!dryRun) {
  if (!dbUrl && !token) {
    console.error('ERROR: neither transport is configured.');
    console.error('  Pass --db-url <postgres-url> (or set SUPABASE_DB_URL), or');
    console.error('  set SUPABASE_ACCESS_TOKEN for the Management API.');
    process.exit(1);
  }
  if (!secretKey) {
    console.error('ERROR: SUPABASE_SECRET_KEY is required (the value stored in Vault).');
    process.exit(1);
  }
  if (!ref) {
    console.error('ERROR: set SUPABASE_PROJECT_REF (or SUPABASE_URL) so the project can be found.');
    process.exit(1);
  }
}

const projectUrl = supabaseUrl || (ref ? `https://${ref}.supabase.co` : '');

/** Single quotes are doubled, so a key containing one cannot break out. */
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

/**
 * One statement. `$seed$` wraps the block so the nested `$job$` tag cannot
 * collide with it, which is the usual way a nested dollar quote goes wrong.
 */
const sql = `
do $seed$
begin
  delete from vault.secrets
   where name in ('mobilize_project_url', 'mobilize_service_key');

  perform vault.create_secret(
    ${quote(projectUrl)},
    'mobilize_project_url',
    'Base URL for the Mobilize sync Edge Function (issue #153).'
  );

  perform vault.create_secret(
    ${quote(secretKey)},
    'mobilize_service_key',
    'Service-role key used by pg_cron to invoke sync-mobilize-events (issue #153).'
  );

  -- Re-scheduled so the job exists even if the migration ran before the
  -- secrets were in place; cron.schedule upserts on job_name.
  perform cron.schedule(
    'sync-mobilize-events',
    '*/30 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'mobilize_project_url')
             || '/functions/v1/sync-mobilize-events',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mobilize_service_key'),
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'mobilize_service_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    )
    where exists (
      select 1 from vault.decrypted_secrets where name = 'mobilize_service_key'
    );
    $job$
  );
end
$seed$;
`;

if (dryRun) {
  const masked = secretKey ? sql.replaceAll(secretKey, '<SUPABASE_SECRET_KEY>') : sql;
  console.log(`-- transport: ${dbUrl ? 'db-url' : token ? 'management-api' : 'none configured'}`);
  console.log(`-- project:   ${ref || '(unknown)'}`);
  console.log(`-- statements: 1 (do block)`);
  console.log(masked.trimStart());
  if (!secretKey) {
    console.log('\n-- NOTE: SUPABASE_SECRET_KEY is not set, so nothing was masked.');
  }
  process.exit(0);
}

/** `supabase db query` takes one statement, which is why the SQL above is a
 *  single `do` block rather than the four statements it replaces. */
async function viaDbUrl(url) {
  const cli = Bun.which('supabase');
  if (!cli) {
    console.error('ERROR: the supabase CLI is not on PATH.');
    process.exit(1);
  }
  // The statement is passed as an argument, not through a shell: no quoting
  // layer, and no chance of a value being re-parsed as syntax.
  const result = await runAsync([cli, 'db', 'query', '--db-url', url, sql]);
  if (result.exitCode !== 0) {
    // The CLI's own output is surfaced without the URL, which carries the
    // password.
    console.error(`ERROR: db query exited ${result.exitCode}.`);
    const detail = `${result.stderr}\n${result.stdout}`.replace(/:\/\/[^@\s]+@/g, '://***@').trim();
    if (detail) console.error(detail.slice(0, 600));
    process.exit(1);
  }
}

async function viaManagementApi() {
  const response = await fetch(`${API}/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) {
    const text = await response.text();
    // The Management API never echoes the statement back, so this is safe to
    // surface; the request body is never printed for the same reason.
    console.error(`Management API HTTP ${response.status}: ${text.slice(0, 400)}`);
    process.exit(1);
  }
}

if (dbUrl) {
  await viaDbUrl(dbUrl);
} else {
  await viaManagementApi();
}

console.log(`✅ Mobilize cron credential stored for project ${ref}`);
console.log('   Secret: supabase/functions/sync-mobilize-events (JWT verification on)');
console.log('   Schedule: every 30 minutes via pg_cron → pg_net');
