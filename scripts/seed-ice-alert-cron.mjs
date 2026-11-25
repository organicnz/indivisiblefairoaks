#!/usr/bin/env bun
/**
 * Install the ICE surge notification and subscriber-retention jobs.
 *
 * Vercel's free tier does not run sub-daily cron. This uses Supabase
 * `pg_cron` -> `pg_net` to POST `/api/ice-rapid/notify` every five minutes and
 * `/api/ice-rapid/purge` daily. The app URL and bearer secret live in Supabase
 * Vault, not in `cron.job.command`, so a database reader cannot recover the
 * secret.
 *
 *   bun scripts/seed-ice-alert-cron.mjs            # apply
 *   bun scripts/seed-ice-alert-cron.mjs --dry-run  # print the statement, masked
 *
 * Requires CRON_SECRET (same value configured on the Next deployment) and
 * either:
 *   - `--db-url <postgres-url>` or `SUPABASE_DB_URL`, or
 *   - `SUPABASE_ACCESS_TOKEN` for the Management API.
 *
 * The app URL defaults to NEXT_PUBLIC_SITE_URL. Until this runs (or if the
 * migration is not applied), neither job exists.
 */

import { runAsync } from './bun-exec.mjs';

const API = 'https://api.supabase.com';

function env(key) {
  return (Bun.env[key] ?? '').trim();
}

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

function dbUrlFlag() {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--db-url') return argv[i + 1] ?? '';
    if (argv[i].startsWith('--db-url=')) return argv[i].slice('--db-url='.length);
  }
  return '';
}

const dbUrl = (dbUrlFlag() || env('SUPABASE_DB_URL')).trim();
const token = env('SUPABASE_ACCESS_TOKEN');
const supabaseUrl = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL');
const appUrl = (
  env('ICE_ALERT_APP_URL') ||
  env('APP_URL') ||
  env('NEXT_PUBLIC_SITE_URL')
).replace(/\/+$/, '');
const cronSecret = env('CRON_SECRET') || env('ICE_ALERT_CRON_SECRET');

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
  if (!appUrl || !/^https?:\/\//.test(appUrl)) {
    console.error('ERROR: set ICE_ALERT_APP_URL, APP_URL, or NEXT_PUBLIC_SITE_URL.');
    process.exit(1);
  }
  if (!cronSecret || cronSecret.length < 16) {
    console.error('ERROR: CRON_SECRET must be set (16+ characters).');
    process.exit(1);
  }
  if (!ref) {
    console.error('ERROR: set SUPABASE_PROJECT_REF (or SUPABASE_URL) so the project can be found.');
    process.exit(1);
  }
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

const sql = `
do $seed$
begin
  delete from vault.secrets
   where name in ('ice_alert_app_url', 'ice_alert_cron_secret');

  perform vault.create_secret(
    ${quote(appUrl)},
    'ice_alert_app_url',
    'Public origin used by pg_cron to call ICE alert routes.'
  );

  perform vault.create_secret(
    ${quote(cronSecret)},
    'ice_alert_cron_secret',
    'Bearer secret for ICE alert cron routes.'
  );

  perform cron.schedule(
    'ice-rapid-surge-notify',
    '*/5 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'ice_alert_app_url')
             || '/api/ice-rapid/notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ice_alert_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
    where exists (
      select 1 from vault.decrypted_secrets where name = 'ice_alert_cron_secret'
    );
    $job$
  );

  -- Crawl one approved public source every ten minutes. A 60-second function
  -- budget only fits a bounded tick; mode=sources skips nationwide discovery
  -- (which has its own job) and limit=2 doubles coverage per tick while the
  -- route shares its wall-clock budget between the two sources. The frontier
  -- makes a source safely resumable, so a short slice is progress, not loss.
  -- Ordering by last_crawled_at rotates the set, so every enabled source is
  -- refreshed roughly every (sources x 10) minutes, and a new source goes first.
  perform cron.schedule(
    'ice-source-crawl',
    '*/10 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'ice_alert_app_url')
             || '/api/ice-crawl/run?mode=sources&limit=2',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ice_alert_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    )
    where exists (
      select 1 from vault.decrypted_secrets where name = 'ice_alert_cron_secret'
    );
    $job$
  );

  -- Nationwide discovery runs hourly on its own route, so the ten-minute crawl
  -- tick no longer pays for it. Candidates land in the ice_crawl_discoveries
  -- table, and the intake job below admits a bounded, AI-screened batch as
  -- attributed summary reports. Full text and rights promotion stay an admin
  -- action.
  perform cron.schedule(
    'ice-nationwide-discovery',
    '23 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'ice_alert_app_url')
             || '/api/ice-crawl/discover',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ice_alert_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    )
    where exists (
      select 1 from vault.decrypted_secrets where name = 'ice_alert_cron_secret'
    );
    $job$
  );

  -- Discovery intake runs every ten minutes, offset from the crawl tick so the
  -- two routes do not contend for the same Vercel invocation. It drains the
  -- oldest pending candidates first and is capped inside the route.
  perform cron.schedule(
    'ice-discovery-intake',
    '5-59/10 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'ice_alert_app_url')
             || '/api/ice-crawl/intake?limit=8',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ice_alert_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    )
    where exists (
      select 1 from vault.decrypted_secrets where name = 'ice_alert_cron_secret'
    );
    $job$
  );

  -- Pending and unsubscribed subscriber rows are retained for 7 and 30 days
  -- respectively. The route owns the cutoffs so the windows stay testable.
  perform cron.schedule(
    'ice-rapid-subscriber-retention',
    '17 4 * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'ice_alert_app_url')
             || '/api/ice-rapid/purge',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ice_alert_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
    where exists (
      select 1 from vault.decrypted_secrets where name = 'ice_alert_cron_secret'
    );
    $job$
  );
end
$seed$;
`;

if (dryRun) {
  const masked = cronSecret
    ? sql.replaceAll(cronSecret, '<CRON_SECRET>')
    : sql;
  console.log(`-- transport: ${dbUrl ? 'db-url' : token ? 'management-api' : 'none configured'}`);
  console.log(`-- project:   ${ref || '(unknown)'}`);
  console.log(`-- app:       ${appUrl || '(unknown)'}`);
  console.log(masked.trimStart());
  if (!cronSecret) {
    console.log('\n-- NOTE: CRON_SECRET is not set, so nothing was masked.');
  }
  process.exit(0);
}

async function viaDbUrl(url) {
  const cli = Bun.which('supabase');
  if (!cli) {
    console.error('ERROR: the supabase CLI is not on PATH.');
    process.exit(1);
  }
  const result = await runAsync([cli, 'db', 'query', '--db-url', url, sql]);
  if (result.exitCode !== 0) {
    console.error(`ERROR: db query exited ${result.exitCode}.`);
    const detail = `${result.stderr}\n${result.stdout}`
      .replace(/:\/\/[^@\s]+@/g, '://***@')
      .trim();
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
    console.error(`Management API HTTP ${response.status}: ${text.slice(0, 400)}`);
    process.exit(1);
  }
}

if (dbUrl) {
  await viaDbUrl(dbUrl);
} else {
  await viaManagementApi();
}

console.log(`✅ ICE surge cron installed for project ${ref}`);
console.log('   Endpoints: /api/ice-rapid/notify, /api/ice-rapid/purge');
console.log('   Schedules: notify every 5 minutes; retention daily at 04:17 via pg_cron → pg_net');
