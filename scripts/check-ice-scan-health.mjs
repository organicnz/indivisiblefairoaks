#!/usr/bin/env bun
/**
 * Read the Supabase-side truth for the ICE pipeline, optionally trigger one
 * bounded edge scan, and record/resolve durable operational alerts.
 *
 * This is the watchdog, not a synthetic "is the function deployed" probe. It
 * reads `ice_scan_health` (edge scan freshness, pending backlog, evidence
 * count), `ice_crawl_health` (last successful approved-source crawl and
 * discovery ticks) and `ice_cron_health` (the actual pg_cron job state), so a
 * schedule that silently stopped firing is a failure even while the HTTP
 * endpoint still answers.
 *
 * Stale source-crawl or discovery schedules are upserted into
 * `ice_operational_alerts` with a stable fingerprint. A fresh schedule resolves
 * its alert. The same alert is shown by `/api/health`.
 *
 *   bun scripts/check-ice-scan-health.mjs
 *   bun scripts/check-ice-scan-health.mjs --trigger
 *   bun scripts/check-ice-scan-health.mjs --trigger --max-age-min 60
 *   bun scripts/check-ice-scan-health.mjs --no-alerts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (service role).
 * Exit 0 = healthy; exit 1 = stale, missing schedule, failed run, failed
 * trigger or failed alert write. No secret is ever printed.
 */
import {
  buildStaleCrawlAlerts,
  DISCOVERY_WINDOW_MINUTES,
  evaluateIceCrawlHealth,
  formatAgeMinutes,
  SOURCE_CRAWL_WINDOW_MINUTES,
} from '../src/lib/ice-crawl-health.ts';

const supabaseUrl = (Bun.env.NEXT_PUBLIC_SUPABASE_URL ?? Bun.env.SUPABASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '');
const serviceKey = (Bun.env.SUPABASE_SECRET_KEY ?? Bun.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

const args = process.argv.slice(2);
const trigger = args.includes('--trigger');
const jsonOutput = args.includes('--json');
const requireRuns = args.includes('--require-runs');
const skipAlerts = args.includes('--no-alerts');

function numberFlag(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const maxAgeMin = numberFlag('--max-age-min', 45);
const intakeAgeMin = numberFlag('--intake-age-min', 20);
const crawlAgeMin = numberFlag('--crawl-age-min', SOURCE_CRAWL_WINDOW_MINUTES);
const discoveryAgeMin = numberFlag('--discovery-age-min', DISCOVERY_WINDOW_MINUTES);

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
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}${text ? ` ${text.slice(0, 300)}` : ''}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${path}: invalid JSON response`);
  }
}

function ageMinutes(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / 60_000);
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
      `ice-scan trigger failed: HTTP ${response.status}${text ? ` ${text.slice(0, 300)}` : ''}`
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

function staleFailure(label, job) {
  const age = job.ageMinutes;
  return `${label} has not succeeded ${
    age === null ? 'yet' : `for ${formatAgeMinutes(age)}`
  } (limit ${job.windowMinutes}m; last success ${job.lastSuccessAt ?? 'never'})`;
}

const failures = [];
const warnings = [];

let health = null;
let cron = [];
let runs = [];
let crawlHealth = null;
let crawlHealthError = null;
let triggerResult = null;
let alertsRecorded = false;
let activeAlertFingerprints = [];

if (trigger) {
  try {
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
  } catch (error) {
    // A failed trigger must not blind the watchdog to crawl staleness.
    failures.push(`scan trigger failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Read the crawl view independently so an edge-scan read failure still records
// source-crawl alerts.
try {
  [crawlHealth] = await rest('ice_crawl_health?select=*');
} catch (error) {
  crawlHealthError = error instanceof Error ? error.message : String(error);
}

let edgeReadFailed = false;
try {
  [health] = await rest('ice_scan_health?select=*');
  cron = await rest('ice_cron_health?select=*&order=jobname.asc');
  runs = await rest(
    'ice_scan_runs?select=id,job,mode,status,started_at,finished_at,duration_ms,found,queued,processed,reports,images,remaining&order=started_at.desc&limit=6'
  );
} catch (error) {
  edgeReadFailed = true;
  failures.push(
    `Supabase edge health read failed: ${error instanceof Error ? error.message : String(error)}`
  );
}

if (!edgeReadFailed && !health) {
  failures.push('ice_scan_health returned no row (migration missing?)');
}

const crawlEvaluation = crawlHealth
  ? evaluateIceCrawlHealth(crawlHealth, Date.now(), {
      sourceCrawlMinutes: crawlAgeMin,
      discoveryMinutes: discoveryAgeMin,
    })
  : null;

if (!crawlHealth) {
  failures.push(
    `source crawl health unavailable: ${
      crawlHealthError ?? 'ice_crawl_health returned no row'
    }`
  );
} else if (crawlEvaluation) {
  if (crawlEvaluation.sourceCrawl.stale) {
    failures.push(staleFailure('source crawl', crawlEvaluation.sourceCrawl));
  }
  if (crawlEvaluation.discovery.stale) {
    failures.push(staleFailure('discovery', crawlEvaluation.discovery));
  }
}

if (crawlEvaluation && !skipAlerts) {
  const wanted = buildStaleCrawlAlerts(crawlEvaluation);
  const nowIso = new Date().toISOString();
  try {
    for (const alert of wanted) {
      // Stable fingerprint: one row per condition, refreshed in place.
      await rest('ice_operational_alerts?on_conflict=fingerprint', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          ...alert,
          last_seen_at: nowIso,
          resolved_at: null,
        }),
      });
    }

    const active = new Set(wanted.map((alert) => alert.fingerprint));
    for (const fingerprint of ['stale-source-crawl', 'stale-discovery']) {
      if (active.has(fingerprint)) continue;
      await rest(
        `ice_operational_alerts?fingerprint=eq.${fingerprint}&resolved_at=is.null`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ resolved_at: nowIso }),
        }
      );
    }

    alertsRecorded = true;
    activeAlertFingerprints = [...active];
  } catch (error) {
    failures.push(
      `operational alert write failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

let lastFinishedAge = null;
let lastDiscoveryAge = null;
let lastIntakeAge = null;

if (!edgeReadFailed) {
  lastFinishedAge = ageMinutes(health?.last_finished_at);
  lastDiscoveryAge = ageMinutes(health?.last_discovery_at);
  lastIntakeAge = ageMinutes(health?.last_intake_at);

  if (requireRuns || trigger) {
    if (lastFinishedAge === null) {
      failures.push('no successful scan run has ever been recorded');
    } else if (lastFinishedAge > maxAgeMin) {
      failures.push(
        `last successful scan is ${formatAgeMinutes(lastFinishedAge)} old (limit ${maxAgeMin}m)`
      );
    }
  }

  if ((health?.pending_discoveries ?? 0) > 0) {
    if (lastIntakeAge === null || lastIntakeAge > intakeAgeMin) {
      failures.push(
        `${health.pending_discoveries} pending discoveries and intake last finished ${formatAgeMinutes(
          lastIntakeAge
        )} ago`
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
        crawl: {
          health: crawlHealth,
          evaluation: crawlEvaluation,
          alertsRecorded,
          activeAlertFingerprints,
        },
      },
      null,
      2
    )
  );
} else {
  console.log('ICE pipeline health');
  console.log(
    `  last successful tick : ${crawlEvaluation?.lastSuccessfulTickAt ?? 'never'}`
  );
  console.log(
    `  source crawl         : ${
      crawlEvaluation ? formatAgeMinutes(crawlEvaluation.sourceCrawl.ageMinutes) : 'unknown'
    } (window ${crawlAgeMin}m; last status ${
      crawlEvaluation?.sourceCrawl.lastStatus ?? 'unknown'
    })`
  );
  console.log(
    `  discovery            : ${
      crawlEvaluation ? formatAgeMinutes(crawlEvaluation.discovery.ageMinutes) : 'unknown'
    } (window ${discoveryAgeMin}m)`
  );
  console.log(
    `  active alerts        : ${crawlHealth?.active_alert_count ?? '?'}${
      alertsRecorded
        ? ` (watchdog active: ${activeAlertFingerprints.join(', ') || 'none'})`
        : ''
    }`
  );
  console.log(
    `  edge scan            : ${formatAgeMinutes(lastFinishedAge)} (${
      health?.last_finished_at ?? 'never'
    })`
  );
  console.log(`  discovery runs       : ${formatAgeMinutes(lastDiscoveryAge)}`);
  console.log(`  intake               : ${formatAgeMinutes(lastIntakeAge)}`);
  console.log(`  pending discoveries : ${health?.pending_discoveries ?? '?'}`);
  console.log(`  unconfirmed reports : ${health?.unconfirmed_reports ?? '?'}`);
  console.log(
    `  evidence images     : ${health?.evidence_images ?? '?'} (last ${formatAgeMinutes(
      ageMinutes(health?.last_image_at)
    )})`
  );
  console.log('  pg_cron:');
  for (const job of cron) {
    console.log(
      `    ${job.jobname.padEnd(30)} active=${job.active} last=${
        job.last_status ?? 'never'
      } ${job.last_start ?? ''}`
    );
  }
  console.log('  recent runs:');
  for (const run of runs) {
    console.log(
      `    ${run.started_at} ${run.mode.padEnd(8)} ${run.status.padEnd(8)} found=${run.found} queued=${run.queued} processed=${run.processed} reports=${run.reports} images=${run.images} remaining=${run.remaining ?? '?'}`
    );
  }
  if (triggerResult) {
    console.log(
      `  trigger: discovery found=${triggerResult.discovery?.found ?? 0} queued=${
        triggerResult.discovery?.queued ?? 0
      }; intake processed=${triggerResult.intake?.processed ?? 0} reports=${
        triggerResult.intake?.reports ?? 0
      }`
    );
  }
  for (const warning of warnings) console.log(`  warn: ${warning}`);
  for (const failure of failures) console.error(`  FAIL: ${failure}`);
}

process.exit(failures.length === 0 ? 0 : 1);
