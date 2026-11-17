import { cacheLife, cacheTag } from 'next/cache';
import { getIceCrawlStore } from '@/lib/ice-crawl-store';
import {
  sourceReportPlaceKey,
  type SourceReportPlace,
} from '@/lib/ice-source-report-location';
import { normalizeIceSourceReportCity } from '@/lib/ice-source-report-search';
import { US_STATE_CODES } from '@/lib/rapid-city-match';

const PAGE_SIZE = 1000;

/**
 * The distinct cities that currently have at least one public source report,
 * with their public row counts. Keeping this cached means the Near me control
 * does not re-scan the archive for every coordinate lookup, while a new crawl
 * becomes visible within the short cache window.
 */
export async function getSourceReportPlaces(): Promise<SourceReportPlace[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('ice-source-reports');

  const store = getIceCrawlStore();
  if (!store) return [];

  const places = new Map<string, SourceReportPlace>();

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await store
      .from('ice_source_reports')
      .select('city, state_code')
      .not('city', 'is', null)
      .not('state_code', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`source report places failed: ${error.message}`);

    const page = data ?? [];
    for (const row of page) {
      const city = normalizeIceSourceReportCity(row.city);
      const stateCode = row.state_code?.trim().toUpperCase() ?? '';
      if (!city || !US_STATE_CODES.has(stateCode)) continue;

      const key = sourceReportPlaceKey(city, stateCode);
      const existing = places.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        places.set(key, { city, stateCode, count: 1 });
      }
    }

    if (page.length < PAGE_SIZE) break;
  }

  return [...places.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.stateCode.localeCompare(b.stateCode) ||
      a.city.localeCompare(b.city)
  );
}
