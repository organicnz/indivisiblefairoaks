import type { IceCrawlSummary } from './ice-crawl-types';

/**
 * Expected windows for the two schedules that feed the ICE archive:
 *
 *   - `ice-source-crawl` runs every 10 minutes (pg_cron).
 *   - `ice-scan-discover` runs every 15 minutes (pg_cron).
 *
 * Four missed ticks is the alert threshold. That absorbs one slow deploy, a
 * transient 5xx from the app or edge gateway, and a queue delay without hiding
 * a scheduler that has actually stopped. Keep these values in one place: the
 * watchdog script and `/api/health` must agree on what "stale" means.
 */
export const SOURCE_CRAWL_WINDOW_MINUTES = 45;
export const DISCOVERY_WINDOW_MINUTES = 60;

export type IceCrawlTickStatus = 'ok' | 'degraded' | 'failed' | 'skipped';

export type IceCrawlTickSourceResult = {
  source: string;
  summary: IceCrawlSummary | { error: string };
};

export type IceCrawlTickSummary = {
  status: IceCrawlTickStatus;
  sources: number;
  reports: number;
  errors: string[];
};

export type IceOperationalAlert = {
  kind: string;
  severity: 'warning' | 'critical';
  message: string;
  last_seen_at: string;
};

/** The single row returned by `ice_crawl_health`. */
export type IceCrawlHealthRow = {
  last_source_crawl_at: string | null;
  last_source_crawl_status: string | null;
  last_source_crawl_reports: number | null;
  last_source_crawl_attempt_at: string | null;
  last_discovery_at: string | null;
  last_scan_at: string | null;
  active_alerts: IceOperationalAlert[] | null;
  active_alert_count?: number | null;
  checked_at: string | null;
};

export type IceCrawlHealthWindows = {
  sourceCrawlMinutes: number;
  discoveryMinutes: number;
};

export type IceCrawlJobHealth = {
  lastSuccessAt: string | null;
  ageMinutes: number | null;
  windowMinutes: number;
  stale: boolean;
};

export type IceCrawlSourceHealth = IceCrawlJobHealth & {
  lastStatus: string | null;
  lastReports: number | null;
  lastAttemptAt: string | null;
};

export type IceCrawlHealthEvaluation = {
  status: 'ok' | 'stale' | 'unknown';
  lastSuccessfulTickAt: string | null;
  sourceCrawl: IceCrawlSourceHealth;
  discovery: IceCrawlJobHealth;
  alerts: IceOperationalAlert[];
  checkedAt: string | null;
};

export type IceCrawlOperationalAlert = {
  fingerprint: string;
  kind: string;
  severity: 'warning' | 'critical';
  message: string;
  details: Record<string, unknown>;
};

const MAX_RECORDED_ERRORS = 20;
const MAX_ERROR_LENGTH = 300;

/** Reduce one full rotation to the row the watchdog and health view store. */
export function summarizeIceCrawlTick(
  results: readonly IceCrawlTickSourceResult[]
): IceCrawlTickSummary {
  const errors: string[] = [];
  let reports = 0;
  let failed = 0;
  let partial = 0;

  for (const result of results) {
    if ('error' in result.summary) {
      failed += 1;
      errors.push(`${result.source}: ${result.summary.error}`);
      continue;
    }

    const summary = result.summary;
    reports += summary.reportsFound;

    if (summary.status === 'error') {
      failed += 1;
      errors.push(`${result.source}: ${summary.errors[0] ?? 'crawl failed'}`);
      continue;
    }

    if (summary.status === 'partial' || summary.status === 'blocked') {
      partial += 1;
      if (summary.status === 'blocked' && summary.errors.length === 0) {
        errors.push(`${result.source}: ${summary.note || 'source blocked'}`);
      }
    }

    for (const error of summary.errors) {
      errors.push(`${result.source}: ${error}`);
    }
  }

  const status: IceCrawlTickStatus =
    results.length === 0
      ? 'skipped'
      : failed === results.length
        ? 'failed'
        : failed > 0 || partial > 0
          ? 'degraded'
          : 'ok';

  return {
    status,
    sources: results.length,
    reports,
    errors: errors.slice(0, MAX_RECORDED_ERRORS).map((error) => error.slice(0, MAX_ERROR_LENGTH)),
  };
}

export function minutesSince(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, (now - parsed) / 60_000);
}

export function formatAgeMinutes(minutes: number | null): string {
  if (minutes === null) return 'never';
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  if (minutes < 60 * 24) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 60 / 24).toFixed(1)}d`;
}

function newestIso(values: Array<string | null>): string | null {
  let newest: { iso: string; time: number } | null = null;
  for (const value of values) {
    if (!value) continue;
    const time = Date.parse(value);
    if (!Number.isFinite(time)) continue;
    if (!newest || time > newest.time) newest = { iso: value, time };
  }
  return newest?.iso ?? null;
}

/**
 * A missing row means the health view itself is unavailable (usually a
 * migration that has not landed yet), which is `unknown`, not `stale`.
 * A present row with no successful tick is stale: the schedule exists and has
 * never produced a success.
 */
export function evaluateIceCrawlHealth(
  row: IceCrawlHealthRow | null,
  now = Date.now(),
  windows: Partial<IceCrawlHealthWindows> = {}
): IceCrawlHealthEvaluation {
  const sourceWindow = windows.sourceCrawlMinutes ?? SOURCE_CRAWL_WINDOW_MINUTES;
  const discoveryWindow = windows.discoveryMinutes ?? DISCOVERY_WINDOW_MINUTES;

  if (!row) {
    return {
      status: 'unknown',
      lastSuccessfulTickAt: null,
      sourceCrawl: {
        lastSuccessAt: null,
        ageMinutes: null,
        windowMinutes: sourceWindow,
        stale: false,
        lastStatus: null,
        lastReports: null,
        lastAttemptAt: null,
      },
      discovery: {
        lastSuccessAt: null,
        ageMinutes: null,
        windowMinutes: discoveryWindow,
        stale: false,
      },
      alerts: [],
      checkedAt: null,
    };
  }

  const sourceAge = minutesSince(row.last_source_crawl_at, now);
  const discoveryAge = minutesSince(row.last_discovery_at, now);
  const sourceStale = sourceAge === null || sourceAge > sourceWindow;
  const discoveryStale = discoveryAge === null || discoveryAge > discoveryWindow;

  return {
    status: sourceStale || discoveryStale ? 'stale' : 'ok',
    lastSuccessfulTickAt: newestIso([row.last_source_crawl_at, row.last_discovery_at]),
    sourceCrawl: {
      lastSuccessAt: row.last_source_crawl_at,
      ageMinutes: sourceAge,
      windowMinutes: sourceWindow,
      stale: sourceStale,
      lastStatus: row.last_source_crawl_status,
      lastReports: row.last_source_crawl_reports,
      lastAttemptAt: row.last_source_crawl_attempt_at,
    },
    discovery: {
      lastSuccessAt: row.last_discovery_at,
      ageMinutes: discoveryAge,
      windowMinutes: discoveryWindow,
      stale: discoveryStale,
    },
    alerts: Array.isArray(row.active_alerts) ? row.active_alerts : [],
    checkedAt: row.checked_at,
  };
}

/** One clear, fingerprint-stable alert per stale schedule. */
export function buildStaleCrawlAlerts(
  health: IceCrawlHealthEvaluation
): IceCrawlOperationalAlert[] {
  if (health.status === 'unknown') return [];

  const alerts: IceCrawlOperationalAlert[] = [];

  if (health.sourceCrawl.stale) {
    const age = health.sourceCrawl.ageMinutes;
    alerts.push({
      fingerprint: 'stale-source-crawl',
      kind: 'stale-source-crawl',
      severity: 'critical',
      message: `Scheduled source crawl has not succeeded ${
        age === null ? 'yet' : `for ${formatAgeMinutes(age)}`
      } (limit ${health.sourceCrawl.windowMinutes}m). Last success: ${
        health.sourceCrawl.lastSuccessAt ?? 'never'
      }; last status: ${health.sourceCrawl.lastStatus ?? 'none'}.`,
      details: {
        job: 'ice-source-crawl',
        lastSuccessAt: health.sourceCrawl.lastSuccessAt,
        lastAttemptAt: health.sourceCrawl.lastAttemptAt,
        lastStatus: health.sourceCrawl.lastStatus,
        ageMinutes: age === null ? null : Number(age.toFixed(1)),
        windowMinutes: health.sourceCrawl.windowMinutes,
      },
    });
  }

  if (health.discovery.stale) {
    const age = health.discovery.ageMinutes;
    alerts.push({
      fingerprint: 'stale-discovery',
      kind: 'stale-discovery',
      severity: 'warning',
      message: `Scheduled discovery has not succeeded ${
        age === null ? 'yet' : `for ${formatAgeMinutes(age)}`
      } (limit ${health.discovery.windowMinutes}m). Last success: ${
        health.discovery.lastSuccessAt ?? 'never'
      }.`,
      details: {
        job: 'ice-scan-discover',
        lastSuccessAt: health.discovery.lastSuccessAt,
        ageMinutes: age === null ? null : Number(age.toFixed(1)),
        windowMinutes: health.discovery.windowMinutes,
      },
    });
  }

  return alerts;
}
