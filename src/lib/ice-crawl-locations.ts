import { createCityMatcher } from '@/lib/rapid-city-match';
import {
  getIceCrawlStore,
  listIceCityPoints,
  listSourceReportsMissingLocation,
  updateSourceReportLocations,
  type IceSourceReportLocationRow,
} from '@/lib/ice-crawl-store';
import { extractCityState } from '@/lib/ice-crawl-extract';

export type IceLocationBackfillResult = {
  scanned: number;
  matched: number;
  updated: number;
  unmatched: number;
  cityPoints: number;
  groups: number;
};

const PAGE_SIZE = 1_000;
const UPDATE_CHUNK_SIZE = 100;

/**
 * Backfill city/state from the retained report text for rows created before
 * location extraction used the verified city snapshot. Existing source text and
 * provenance are untouched; only the two display/search columns are filled.
 */
export async function backfillIceSourceLocations(): Promise<IceLocationBackfillResult> {
  const store = getIceCrawlStore();
  if (!store) throw new Error('Crawler storage is not configured.');

  const cityPoints = await listIceCityPoints(store);
  const matcher = cityPoints.length > 0 ? createCityMatcher(cityPoints) : null;

  const rows: IceSourceReportLocationRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await listSourceReportsMissingLocation(store, PAGE_SIZE, offset);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const groups = new Map<
    string,
    { city: string; stateCode: string; ids: string[] }
  >();
  let matched = 0;

  for (const row of rows) {
    const titleMatch = matcher?.findCityInLocation(row.title) ?? null;
    const textMatch = titleMatch
      ? null
      : matcher?.findCityInLocation(row.text_content.slice(0, 1_000)) ?? null;
    const fallback = titleMatch || textMatch
      ? null
      : extractCityState(`${row.title}\n${row.text_content.slice(0, 1_000)}`);
    const city = titleMatch?.city.city ?? textMatch?.city.city ?? fallback?.city ?? null;
    const stateCode =
      titleMatch?.stateCode ??
      textMatch?.stateCode ??
      fallback?.stateCode ??
      null;

    if (!city || !stateCode) continue;
    matched += 1;

    const key = `${stateCode}|${city}`;
    const group = groups.get(key) ?? { city, stateCode, ids: [] };
    group.ids.push(row.id);
    groups.set(key, group);
  }

  let updated = 0;
  for (const group of groups.values()) {
    for (let offset = 0; offset < group.ids.length; offset += UPDATE_CHUNK_SIZE) {
      updated += await updateSourceReportLocations(
        store,
        group.ids.slice(offset, offset + UPDATE_CHUNK_SIZE),
        group.city,
        group.stateCode
      );
    }
  }

  return {
    scanned: rows.length,
    matched,
    updated,
    unmatched: rows.length - matched,
    cityPoints: cityPoints.length,
    groups: groups.size,
  };
}
