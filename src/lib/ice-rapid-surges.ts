import type { RapidAlert } from '@/components/ice-alerts/rapid-types';

export type RapidSurgeScope = 'city' | 'state' | 'national';
export type RapidSurgeSeverity = 'watch' | 'surge';

export type RapidSurge = {
  /** Stable within a 15-minute bucket, so repeated polls do not re-notify. */
  key: string;
  scope: RapidSurgeScope;
  severity: RapidSurgeSeverity;
  label: string;
  shortLabel: string;
  stateCode: string | null;
  city: string | null;
  count: number;
  windowMinutes: number;
  latestAt: string;
  alertIds: string[];
};

export type RapidSurgeAudience = {
  stateCode?: string | null;
  city?: string | null;
};

export const RAPID_SURGE_THRESHOLDS = {
  city: 2,
  state: 4,
  national: 8,
} as const;

export const RAPID_SURGE_WINDOWS_MINUTES = {
  city: 90,
  state: 120,
  national: 60,
} as const;

const BUCKET_MS = 15 * 60 * 1_000;
const MAX_SURGES = 6;

function observedMs(alert: RapidAlert) {
  const value = Date.parse(alert.observedAt);
  return Number.isFinite(value) ? value : Number.NaN;
}

function recentAlerts(alerts: RapidAlert[], now: number, minutes: number) {
  const cutoff = now - minutes * 60 * 1_000;
  const futureCutoff = now + 5 * 60 * 1_000;
  return alerts
    .filter((alert) => {
      const at = observedMs(alert);
      return Number.isFinite(at) && at >= cutoff && at <= futureCutoff;
    })
    .sort((a, b) => observedMs(b) - observedMs(a));
}

function bucket(now: number) {
  return new Date(Math.floor(now / BUCKET_MS) * BUCKET_MS)
    .toISOString()
    .slice(0, 16)
    .replace(/[^0-9]/g, '');
}

function keyPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function normalizedCity(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function newestIso(alerts: RapidAlert[]) {
  return alerts[0]?.observedAt ?? new Date(0).toISOString();
}

/**
 * Detect current community-report clusters.
 *
 * These are report-volume signals, not a claim that enforcement is confirmed or
 * ongoing. Official releases are context and never enter this calculation.
 */
export function computeRapidSurges(alerts: RapidAlert[], now = Date.now()): RapidSurge[] {
  const cityWindow = recentAlerts(
    alerts,
    now,
    RAPID_SURGE_WINDOWS_MINUTES.city
  );
  const cityGroups = new Map<string, RapidAlert[]>();
  for (const alert of cityWindow) {
    const key = `${normalizedCity(alert.city)}|${alert.stateCode}`;
    const group = cityGroups.get(key) ?? [];
    group.push(alert);
    cityGroups.set(key, group);
  }

  const column = bucket(now);
  const surges: RapidSurge[] = [];

  for (const group of cityGroups.values()) {
    if (group.length < RAPID_SURGE_THRESHOLDS.city) continue;
    const latest = group[0];
    surges.push({
      key: `city:${latest.stateCode}:${keyPart(latest.city)}:${column}`,
      scope: 'city',
      severity: group.length >= 4 ? 'surge' : 'watch',
      label: `${group.length} community reports in ${latest.city}, ${latest.stateCode} within ${RAPID_SURGE_WINDOWS_MINUTES.city} minutes.`,
      shortLabel: `${latest.city}, ${latest.stateCode}`,
      stateCode: latest.stateCode,
      city: latest.city,
      count: group.length,
      windowMinutes: RAPID_SURGE_WINDOWS_MINUTES.city,
      latestAt: newestIso(group),
      alertIds: group.map((alert) => alert.id),
    });
  }

  const stateWindow = recentAlerts(
    alerts,
    now,
    RAPID_SURGE_WINDOWS_MINUTES.state
  );
  const stateGroups = new Map<string, RapidAlert[]>();
  for (const alert of stateWindow) {
    const group = stateGroups.get(alert.stateCode) ?? [];
    group.push(alert);
    stateGroups.set(alert.stateCode, group);
  }

  for (const [stateCode, group] of stateGroups) {
    const cities = new Set(group.map((alert) => normalizedCity(alert.city)));
    if (group.length < RAPID_SURGE_THRESHOLDS.state || cities.size < 2) continue;
    surges.push({
      key: `state:${stateCode}:${column}`,
      scope: 'state',
      severity: group.length >= 7 ? 'surge' : 'watch',
      label: `${group.length} community reports across ${cities.size} ${stateCode} cities within ${RAPID_SURGE_WINDOWS_MINUTES.state} minutes.`,
      shortLabel: `${stateCode} region`,
      stateCode,
      city: null,
      count: group.length,
      windowMinutes: RAPID_SURGE_WINDOWS_MINUTES.state,
      latestAt: newestIso(group),
      alertIds: group.map((alert) => alert.id),
    });
  }

  const nationalWindow = recentAlerts(
    alerts,
    now,
    RAPID_SURGE_WINDOWS_MINUTES.national
  );
  const nationalStates = new Set(nationalWindow.map((alert) => alert.stateCode));
  if (
    nationalWindow.length >= RAPID_SURGE_THRESHOLDS.national &&
    nationalStates.size >= 3
  ) {
    surges.push({
      key: `national:${column}`,
      scope: 'national',
      severity: 'surge',
      label: `${nationalWindow.length} community reports across ${nationalStates.size} states within ${RAPID_SURGE_WINDOWS_MINUTES.national} minutes.`,
      shortLabel: 'National',
      stateCode: null,
      city: null,
      count: nationalWindow.length,
      windowMinutes: RAPID_SURGE_WINDOWS_MINUTES.national,
      latestAt: newestIso(nationalWindow),
      alertIds: nationalWindow.map((alert) => alert.id),
    });
  }

  const scopeRank: Record<RapidSurgeScope, number> = {
    national: 0,
    state: 1,
    city: 2,
  };

  return surges
    .sort((a, b) => {
      const severity = Number(b.severity === 'surge') - Number(a.severity === 'surge');
      if (severity !== 0) return severity;
      const scope = scopeRank[a.scope] - scopeRank[b.scope];
      if (scope !== 0) return scope;
      return b.count - a.count;
    })
    .slice(0, MAX_SURGES);
}

/**
 * A subscriber with no location gets only national alerts. A state subscriber
 * gets state and national surges. A city subscriber gets their city, their
 * state, and national surges.
 */
export function surgeMatchesAudience(
  surge: RapidSurge,
  audience: RapidSurgeAudience
) {
  if (surge.scope === 'national') return true;

  const stateCode = audience.stateCode?.trim().toUpperCase();
  if (!stateCode || stateCode !== surge.stateCode) return false;
  if (surge.scope === 'state') return true;

  const city = audience.city?.trim();
  if (!city || !surge.city) return false;
  return normalizedCity(city) === normalizedCity(surge.city);
}
