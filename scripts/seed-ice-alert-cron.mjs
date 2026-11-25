#!/usr/bin/env bun
/**
 * Install the ICE alert, approved-source crawl and Supabase edge scan jobs.
 *
 * Vercel's free tier does not run sub-daily cron. The scan itself now lives in
 * the `ice-scan` Supabase Edge Function, so pg_cron drives the edge endpoint
 * directly and the Next.js discovery/intake routes become manual fallbacks.
 * Every URL and credential is read from Supabase Vault at run time, never
 * embedded in `cron.job.command`.
 *
 * The script is idempotent and self-healing: Vault secrets are updated in
 * place (never delete-then-create), old duplicate Vercel jobs are removed, and
 * the run fails loudly if any secret or job is missing afterwards. That is the
 * failure this script exists to prevent: a schedule that still runs while its
 * Vault secret is absent looks alive in cron and does nothing.
 *
 *   bun scripts/seed-ice-alert-cron.mjs            # apply
 *   bun scripts/seed-ice-alert-cron.mjs --dry-run  # print the statement, masked
 *
 * Requires:
 *   - CRON_SECRET (the same value configured on the Next deployment),
 *   - SUPABASE_SECRET_KEY (service-role key; edge scan auth + Vault),
 *   - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL),
 *   - NEXT_PUBLIC_SITE_URL (or APP_URL / ICE_ALERT_APP_URL),
 *   - either `--db-url <postgres-url>` / SUPABASE_DB_URL, or
 *     SUPABASE_ACCESS_TOKEN for the Management API.
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
const supabaseUrl = (env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')).replace(/\/+$/, '');
const functionsUrl = supabaseUrl ? `${supabaseUrl}/functions/v1` : '';
const appUrl = (
  env('ICE_ALERT_APP_URL') ||
  env('APP_URL') ||
  env('NEXT_PUBLIC_SITE_URL')
).replace(/\/+$/, '');
const cronSecret = env('CRON_SECRET') || env('ICE_ALERT_CRON_SECRET');
const serviceKey = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');

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
  if (!supabaseUrl || !/^https?:\/\//.test(supabaseUrl)) {
    console.error('ERROR: set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.');
    process.exit(1);
  }
  if (!cronSecret || cronSecret.length < 16) {
    console.error('ERROR: CRON_SECRET must be set (16+ characters).');
    process.exit(1);
  }
  if (!serviceKey || serviceKey.length < 20) {
    console.error('ERROR: SUPABASE_SECRET_KEY must be set (service-role key).');
    process.exit(1);
  }
  if (!dbUrl && !token) {
    console.error('ERROR: set SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN to apply the schedule.');
    process.exit(1);
  }
  if (!ref) {
    console.error('ERROR: set SUPABASE_PROJECT_REF (or SUPABASE_URL) so the project can be found.');
    process.exit(1);
  }
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

/**
 * Vault upsert. `update_secret` keeps the secret id and avoids the window in
 * which a delete-then-create leaves pg_cron reading a missing secret.
 */
const vaultUpsert = (name, value, description) => `
  select id into secret_id from vault.secrets where name = ${quote(name)} limit 1;
  if secret_id is null then
    perform vault.create_secret(${quote(value)}, ${quote(name)}, ${quote(description)});
  else
    perform vault.update_secret(secret_id, ${quote(value)}, ${quote(name)}, ${quote(description)});
    -- Vault does not enforce a unique name. Remove any legacy duplicate after
    -- the update so a scheduled scalar subquery cannot return two rows.
    delete from vault.secrets where name = ${quote(name)} and id <> secret_id;
  end if;`;

const sql = `
do $seed$
declare
  secret_id uuid;
  job_record record;
begin
  ${vaultUpsert(
    'ice_alert_app_url',
    appUrl,
    'Public origin used by pg_cron to call ICE alert and crawl routes.',
  )}

  ${vaultUpsert(
    'ice_alert_cron_secret',
    cronSecret,
    'Bearer secret for the Next.js ICE alert and approved-source crawl routes.',
  )}

  ${vaultUpsert(
    'supabase_functions_url',
    functionsUrl,
    'Supabase Edge Functions base URL used by pg_cron.',
  )}

  ${vaultUpsert(
    'ice_scan_service_key',
    serviceKey,
    'Service-role bearer used by pg_cron to invoke the ice-scan edge function.',
  )}

  if not exists (select 1 from vault.decrypted_secrets where name = 'ice_alert_app_url') then
    raise exception 'Vault secret ice_alert_app_url was not installed';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'ice_alert_cron_secret') then
    raise exception 'Vault secret ice_alert_cron_secret was not installed';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'supabase_functions_url') then
    raise exception 'Vault secret supabase_functions_url was not installed';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'ice_scan_service_key') then
    raise exception 'Vault secret ice_scan_service_key was not installed';
  end if;
  if exists (
    select name from vault.secrets
     where name in ('ice_alert_app_url', 'ice_alert_cron_secret', 'supabase_functions_url', 'ice_scan_service_key')
     group by name
    having count(*) > 1
  ) then
    raise exception 'duplicate Vault secrets remain';
  end if;

  -- These two jobs called the Next.js discovery/intake routes. The edge scan
  -- now owns that work; keeping both would double-spend model calls.
  for job_record in
    select jobname from cron.job
     where jobname in ('ice-nationwide-discovery', 'ice-discovery-intake')
  loop
    perform cron.unschedule(job_record.jobname);
  end loop;

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
    );
    $job$
  );

  -- Crawl one approved public source every ten minutes. A 60-second function
  -- budget only fits a bounded tick; the frontier makes a source resumable.
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
    );
    $job$
  );

  -- Nationwide discovery runs in Supabase, against Supabase. Fifteen minutes
  -- keeps GDELT inside its published rate limit while the rotating regional
  -- query widens local coverage across the day.
  perform cron.schedule(
    'ice-scan-discover',
    '*/15 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_functions_url')
             || '/ice-scan?mode=discover',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'ice_scan_service_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 110000
    );
    $job$
  );

  -- Intake drains the oldest pending candidates first, with a bounded batch
  -- and a Postgres lease. Five-minute cadence is the "always on" loop; the
  -- function itself refuses overlapping work, so a slow publisher cannot stack
  -- runs on top of each other.
  perform cron.schedule(
    'ice-scan-intake',
    '2-59/5 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_functions_url')
             || '/ice-scan?mode=intake&limit=9',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'ice_scan_service_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 110000
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
    );
    $job$
  );

  if (
    select count(*) from cron.job
     where jobname in ('ice-scan-discover', 'ice-scan-intake')
  ) <> 2 then
    raise exception 'ICE scan jobs were not scheduled';
  end if;
end
$seed$;
`;

if (dryRun) {
  const masked = sql
    .replaceAll(cronSecret || '\u0000', '<CRON_SECRET>')
    .replaceAll(serviceKey || '\u0000', '<SUPABASE_SECRET_KEY>');
  console.log(`-- transport: ${dbUrl ? 'db-url' : token ? 'management-api' : 'none configured'}`);
  console.log(`-- project:   ${ref || '(unknown)'}`);
  console.log(`-- app:       ${appUrl || '(unknown)'}`);
  console.log(`-- functions: ${functionsUrl || '(unknown)'}`);
  console.log(masked.trimStart());
  if (!cronSecret || !serviceKey) {
    console.log('\n-- NOTE: a secret is unset, so the statement was not fully masked.');
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

console.log(`✅ ICE scan and alert cron installed for project ${ref}`);
console.log('   Edge scan:    /functions/v1/ice-scan (discover */15, intake 2-59/5)');
console.log('   Next routes:  /api/ice-rapid/notify (*/5), /api/ice-crawl/run (*/10), /api/ice-rapid/purge (daily)');
console.log('   Secrets:      Supabase Vault (app URL, cron secret, functions URL, service key)');
