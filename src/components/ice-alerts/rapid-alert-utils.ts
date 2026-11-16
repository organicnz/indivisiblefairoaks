import type { RapidAlert, RapidAlertKind, RapidAlertStatus, RapidMapPoint } from './rapid-types';

export const ACTIVE_ALERT_WINDOW_MS = 4 * 60 * 60 * 1000;
export const RECENT_ALERT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const FUTURE_ALERT_TOLERANCE_MS = 5 * 60 * 1000;

export type RapidKindFilter = 'all' | Exclude<RapidAlertKind, 'official'>;
export type RapidStatusFilter = 'all' | Exclude<RapidAlertStatus, 'official'>;
export type RapidTimeFilter = 'live' | '24h' | 'all';

export type RapidFilters = {
  query: string;
  kind: RapidKindFilter;
  status: RapidStatusFilter;
  time: RapidTimeFilter;
};

export const DEFAULT_RAPID_FILTERS: RapidFilters = {
  query: '',
  kind: 'all',
  status: 'all',
  time: 'all',
};

export function alertAgeMs(alert: Pick<RapidAlert, 'observedAt'>, now: number) {
  const timestamp = Date.parse(alert.observedAt);
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;

  const delta = now - timestamp;
  if (delta < -FUTURE_ALERT_TOLERANCE_MS) return Number.POSITIVE_INFINITY;
  return Math.max(0, delta);
}

export function isAlertActive(alert: Pick<RapidAlert, 'observedAt'>, now: number) {
  return alertAgeMs(alert, now) <= ACTIVE_ALERT_WINDOW_MS;
}

export function isAlertRecent(alert: Pick<RapidAlert, 'observedAt'>, now: number) {
  return alertAgeMs(alert, now) <= RECENT_ALERT_WINDOW_MS;
}

export function formatRelativeTime(iso: string, now: number) {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return 'Time unavailable';

  const delta = now - timestamp;
  if (delta < -FUTURE_ALERT_TOLERANCE_MS) return 'Time unavailable';
  const nonNegativeDelta = Math.max(0, delta);
  const minutes = Math.floor(nonNegativeDelta / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp));
}

export function formatUpdateTime(iso: string | null) {
  if (!iso) return 'No update yet';
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return 'No update yet';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function formatShortDate(iso: string) {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

export function filterAlerts(
  alerts: RapidAlert[],
  filters: RapidFilters,
  now: number
): RapidAlert[] {
  const normalizedQuery = filters.query.trim().toLowerCase();

  return alerts.filter((alert) => {
    if (filters.kind !== 'all' && alert.kind !== filters.kind) return false;
    if (filters.status !== 'all' && alert.status !== filters.status) return false;

    if (filters.time === 'live' && !isAlertActive(alert, now)) return false;
    if (filters.time === '24h' && !isAlertRecent(alert, now)) return false;

    if (!normalizedQuery) return true;
    const searchable = `${alert.place} ${alert.title} ${alert.summary} ${alert.status} ${alert.kind}`;
    return searchable.toLowerCase().includes(normalizedQuery);
  });
}

export function countActiveAlerts(alerts: RapidAlert[], now: number) {
  return alerts.filter((alert) => isAlertActive(alert, now)).length;
}

/**
 * Group reports by city so a busy city gets one readable pin rather than a
 * stack of overlapping markers. The pin carries the strongest source status
 * and a count; the feed still exposes every individual report.
 */
export function groupRapidAlerts(alerts: RapidAlert[], now: number): RapidMapPoint[] {
  const groups = new Map<string, RapidAlert[]>();

  for (const alert of alerts) {
    const key = `${alert.city}|${alert.stateCode}`;
    const group = groups.get(key) ?? [];
    group.push(alert);
    groups.set(key, group);
  }

  const points: RapidMapPoint[] = [];

  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)
    );
    const latest = sorted[0];
    const confirmed = sorted.some((alert) => alert.status === 'source-confirmed');
    const hasActive = sorted.some((alert) => isAlertActive(alert, now));

    points.push({
      id: `${latest.city}|${latest.stateCode}`,
      city: latest.city,
      stateCode: latest.stateCode,
      place: latest.place,
      lat: latest.lat,
      lng: latest.lng,
      count: sorted.length,
      alertIds: sorted.map((alert) => alert.id),
      latestAlertId: latest.id,
      latestAt: latest.observedAt,
      kind: latest.kind,
      status: confirmed ? 'source-confirmed' : latest.status,
      hasActive,
    });
  }

  return points.sort((a, b) => {
    if (a.hasActive !== b.hasActive) return a.hasActive ? -1 : 1;
    return Date.parse(b.latestAt) - Date.parse(a.latestAt);
  });
}

export const KIND_LABELS: Record<RapidAlertKind, string> = {
  enforcement: 'Enforcement',
  detention: 'Detention',
  checkpoint: 'Checkpoint',
  official: 'Official',
};

export const STATUS_LABELS: Record<RapidAlertStatus, string> = {
  'source-confirmed': 'Source-confirmed',
  sighting: 'Sighting',
  official: 'Official release',
};
