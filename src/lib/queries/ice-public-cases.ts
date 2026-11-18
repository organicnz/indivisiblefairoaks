import type { PublicCase } from '@/components/ice-alerts/rapid-types';
import {
  getIceReportStore,
  getPublishedIceReports,
  type IceReportPublicRow,
} from '@/lib/ice-report-intake';

/**
 * The active public case projection is small, but the map is the product
 * surface, so read enough rows to represent every currently visible case
 * rather than the card list's shorter page size.
 */
const PUBLIC_CASE_LIMIT = 100;
const PUBLIC_CASE_TIMEOUT_MS = 4_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`public case query timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  return Promise.race([promise, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function publicCaseKind(value: string): PublicCase['kind'] | null {
  return value === 'enforcement' || value === 'detention' || value === 'checkpoint'
    ? value
    : null;
}

function validCoordinate(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function toPublicCase(row: IceReportPublicRow): PublicCase | null {
  const kind = publicCaseKind(row.kind);
  if (!kind) return null;
  if (!validCoordinate(row.lat, -90, 90) || !validCoordinate(row.lng, -180, 180)) {
    return null;
  }

  const summary = row.summary.trim();
  if (!summary) return null;

  return {
    id: row.id,
    city: row.city,
    stateCode: row.state_code,
    place: `${row.city}, ${row.state_code}`,
    kind,
    observedAt: row.observed_at,
    summary,
    lat: row.lat,
    lng: row.lng,
    corroborationCount:
      Number.isInteger(row.corroboration_count) && row.corroboration_count > 0
        ? row.corroboration_count
        : 1,
  };
}

/**
 * Read the sanitized public case rows from Supabase. This projection contains
 * only city-level fields, never private intake text or reporter details.
 */
export async function getRapidPublicCases(): Promise<PublicCase[]> {
  const store = getIceReportStore();
  if (!store) return [];

  try {
    const rows = await withTimeout(
      getPublishedIceReports(store, PUBLIC_CASE_LIMIT),
      PUBLIC_CASE_TIMEOUT_MS
    );
    return rows
      .map(toPublicCase)
      .filter((row): row is PublicCase => Boolean(row));
  } catch (error) {
    console.warn(
      'Unable to load published community cases for the rapid map',
      error instanceof Error ? error.message : 'unknown error'
    );
    return [];
  }
}
