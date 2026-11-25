#!/usr/bin/env bun
/**
 * Read the Supabase-side truth for the ICE scanner and optionally trigger one
 * bounded run.
 *
 * This is the watchdog, not a synthetic "is the function deployed" probe. It
 * reads `ice_scan_health` (run freshness, pending backlog, evidence count) and
 * `ice_cron_health` (the actual pg_cron job state), so a schedule that silently
 * stopped firing is a failure even while the HTTP endpoint still answers.
 *
 *   bun scripts/check-ice-scan-health.mjs
 *   bun scripts/check-ice-scan-health.mjs --trigger
 *   bun scripts/check-ice-scan-health.mjs --trigger --max-age-min 60
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (service role).
 * Exit 0 = healthy; exit 1 = stale, missing schedule, failed run or trigger
 * failure. No secret is ever printed.
 */

const supabaseUrl = (Bun.env.NEXT_PUBLIC_SUPABASE_URL ?? Bun.env.SUPABASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '');
const serviceKey = (Bun.env.SUPABASE_SECRET_KEY ?? Bun.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

const args = process.argv.slice(2);
const trigger = args.includes('--trigger');
const jsonOutput = args.includes('--json');
const requireRuns = args.includes('--require-runs');

function numberFlag(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const maxAgeMin = numberFlag('--max-age-min', 45);
const intakeAgeMin = numberFlag('--intake-age-min', 20);

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
  process.exit(1);
}

const headers = {
  // New `sb_secret_` keys are not JWTs; `ice-scan` reads this header directly
  // and performs its own constant-time check.
  apikey: serviceKey,
  'Content-Type': 'application/json',
};

async function rest(path, init = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path}: HTTP ${response.status}${text ? ` ${text.slice(0, 200)}` : ''}`);
  }
  return response.json();
}

function ageMinutes(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / 60_000);
}

function formatAge(minutes) {
  if (minutes === null) return 'never';
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 24) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 60 / 24).toFixed(1)}d`;
}

async function triggerOnce() {
  const response = await fetch(`${supabaseUrl}/functions/v1/ice-scan?mode=both&limit=6`, {
    method: 'POST',
    headers,
    body: '{}',
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // The status and a bounded body are enough to diagnose a gateway error.
  }
  if (!response.ok) {
    throw new Error(
      `ice-scan trigger failed: HTTP ${response.status}${text ? ` ${text.slice(0, 300)}` : ''}`,
    );
  }
  return body ?? { raw: text.slice(0, 300) };
}

/** A fresh deployment can answer 404/503 for a few seconds while the gateway
 *  propagates the new function route. Retry only that startup window. */
async function triggerScan() {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await triggerOnce();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  throw lastError;
}

const failures = [];
const warnings = [];

let health = null;
let cron = [];
let runs = [];
let triggerResult = null;

try {
  if (trigger) {
    triggerResult = await triggerScan();
    if (triggerResult?.ok === false) {
      failures.push(`scan trigger returned ok=false: ${triggerResult.error ?? 'unknown error'}`);
    }
    if (triggerResult?.intake?.skipped) {
      warnings.push(`intake skipped: ${triggerResult.intake.skipped}`);
    }
    if (triggerResult?.discovery?.skipped) {
      warnings.push(`discovery skipped: ${triggerResult.discovery.skipped}`);
    }
  }

  [health] = await rest('ice_scan_health?select=*');
  cron = await rest('ice_cron_health?select=*&order=jobname.asc');
  runs = await rest(
    'ice_scan_runs?select=id,job,mode,status,started_at,finished_at,duration_ms,found,queued,processed,reports,images,remaining&order=started_at.desc&limit=6',
  );
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (!health) {
  failures.push('ice_scan_health returned no row (migration missing?)');
}

const lastFinishedAge = ageMinutes(health?.last_finished_at);
const lastDiscoveryAge = ageMinutes(health?.last_discovery_at);
const lastIntakeAge = ageMinutes(health?.last_intake_at);

if (requireRuns || trigger) {
  if (lastFinishedAge === null) {
    failures.push('no successful scan run has ever been recorded');
  } else if (lastFinishedAge > maxAgeMin) {
    failures.push(`last successful scan is ${formatAge(lastFinishedAge)} old (limit ${maxAgeMin}m)`);
  }
}

if (lastDiscoveryAge !== null && lastDiscoveryAge > maxAgeMin * 2) {
  warnings.push(`discovery has not finished for ${formatAge(lastDiscoveryAge)}`);
}
if ((health?.pending_discoveries ?? 0) > 0) {
  if (lastIntakeAge === null || lastIntakeAge > intakeAgeMin) {
    failures.push(
      `${health.pending_discoveries} pending discoveries and intake last finished ${formatAge(lastIntakeAge)} ago`,
    );
  }
}

const requiredJobs = ['ice-scan-discover', 'ice-scan-intake'];
for (const name of requiredJobs) {
  const job = cron.find((row) => row.jobname === name);
  if (!job) {
    failures.push(`pg_cron job ${name} is missing`);
    continue;
  }
  if (job.active !== true) failures.push(`pg_cron job ${name} is inactive`);
  if (job.last_status === 'failed') {
    failures.push(`pg_cron job ${name} last run failed: ${job.last_message || 'no message'}`);
  }
}

if (jsonOutput) {
  console.log(
    JSON.stringify(
      {
        ok: failures.length === 0,
        failures,
        warnings,
        health,
        cron,
        runs,
        trigger: triggerResult,
      },
      null,
      2,
    ),
  );
} else {
  console.log('ICE scan health');
  console.log(`  last successful run : ${formatAge(lastFinishedAge)} (${health?.last_finished_at ?? 'never'})`);
  console.log(`  discovery           : ${formatAge(lastDiscoveryAge)}`);
  console.log(`  intake              : ${formatAge(lastIntakeAge)}`);
  console.log(`  pending discoveries : ${health?.pending_discoveries ?? '?'}`);
  console.log(`  unconfirmed reports : ${health?.unconfirmed_reports ?? '?'}`);
  console.log(`  evidence images     : ${health?.evidence_images ?? '?'} (last ${formatAge(ageMinutes(health?.last_image_at))})`);
  console.log('  pg_cron:');
  for (const job of cron) {
    console.log(
      `    ${job.jobname.padEnd(30)} active=${job.active} last=${job.last_status ?? 'never'} ${job.last_start ?? ''}`,
    );
  }
  console.log('  recent runs:');
  for (const run of runs) {
    console.log(
      `    ${run.started_at} ${run.mode.padEnd(8)} ${run.status.padEnd(8)} found=${run.found} queued=${run.queued} processed=${run.processed} reports=${run.reports} images=${run.images} remaining=${run.remaining ?? '?'}`,
    );
  }
  if (triggerResult) {
    console.log(
      `  trigger: discovery found=${triggerResult.discovery?.found ?? 0} queued=${triggerResult.discovery?.queued ?? 0}; intake processed=${triggerResult.intake?.processed ?? 0} reports=${triggerResult.intake?.reports ?? 0}`,
    );
  }
  for (const warning of warnings) console.log(`  warn: ${warning}`);
  for (const failure of failures) console.error(`  FAIL: ${failure}`);
}

process.exit(failures.length === 0 ? 0 : 1);
