import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import type { CityPoint, HeatmapMeta, HeatmapSnapshot } from '@/components/ice-alerts/types';
import { createPublicClient } from '@/lib/supabase-server';

const CITY_PAGE_SIZE = 1_000;

const RELEASE_COLUMNS = [
  'id',
  'generated_at',
  'period_start',
  'period_end',
  'source_name',
  'source_url',
  'source_data_url',
  'source_release',
  'source_citation',
  'license',
  'coordinate_source',
  'coordinate_url',
  'raw_records',
  'duplicate_rows_removed',
  'records',
  'records_with_us_city',
  'mapped_records',
  'unmapped_city_records',
  'records_without_usable_city',
  'mapped_cities',
  'mapped_share_of_city_tagged',
  'mapped_share_of_all',
  'max_city_count',
  'sha256',
  'method',
  'release_checked_at',
  'release_note',
].join(', ');

interface ReleaseRow {
  id: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  source_name: string;
  source_url: string;
  source_data_url: string;
  source_release: string;
  source_citation: string;
  license: string;
  coordinate_source: string;
  coordinate_url: string;
  raw_records: number | string;
  duplicate_rows_removed: number | string;
  records: number | string;
  records_with_us_city: number | string;
  mapped_records: number | string;
  unmapped_city_records: number | string;
  records_without_usable_city: number | string;
  mapped_cities: number | string;
  mapped_share_of_city_tagged: number | string;
  mapped_share_of_all: number | string;
  max_city_count: number | string;
  sha256: string;
  method: string;
  release_checked_at: string;
  release_note: string;
}

interface CityRow {
  city: string;
  state: string;
  state_code: string;
  lat: number | string;
  lng: number | string;
  arrest_count: number | string;
}

function publicClient(): SupabaseClient {
  return createPublicClient() as unknown as SupabaseClient;
}

function numberField(value: number | string, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`ICE heat-map release has an invalid ${field}`);
  }
  return parsed;
}

function integerField(value: number | string, field: string): number {
  const parsed = numberField(value, field);
  if (!Number.isInteger(parsed)) {
    throw new Error(`ICE heat-map release has a non-integer ${field}`);
  }
  return parsed;
}

async function readLatestRelease(supabase: SupabaseClient): Promise<ReleaseRow> {
  const { data, error } = await supabase
    .from('ice_heatmap_releases')
    .select(RELEASE_COLUMNS)
    .order('period_end', { ascending: false })
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read the ICE heat-map release: ${error.message}`);
  }
  if (!data) {
    throw new Error('No published ICE heat-map release is available');
  }

  return data as unknown as ReleaseRow;
}

async function readCities(
  supabase: SupabaseClient,
  releaseId: string,
  expectedCities: number
): Promise<CityRow[]> {
  const rows: CityRow[] = [];

  for (let from = 0; ; from += CITY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('ice_heatmap_cities')
      .select('city, state, state_code, lat, lng, arrest_count')
      .eq('release_id', releaseId)
      // A stable order is required for range pagination; count order also
      // keeps the ranked city list correct without a client-side sort.
      .order('arrest_count', { ascending: false })
      .order('state_code', { ascending: true })
      .order('city', { ascending: true })
      .range(from, from + CITY_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Unable to read ICE heat-map cities: ${error.message}`);
    }

    const page = (data ?? []) as CityRow[];
    rows.push(...page);

    if (rows.length > expectedCities) {
      throw new Error(
        `ICE heat-map release has more city rows than its mapped_cities total (${expectedCities})`
      );
    }
    if (page.length < CITY_PAGE_SIZE) break;
  }

  return rows;
}

/**
 * The complete ICE arrest snapshot, read from Supabase.
 *
 * `'use cache'` keeps the 8,599-row release off the request path while the
 * release is immutable. The invariants below are deliberately fatal: serving a
 * partial or internally inconsistent snapshot would silently change every
 * count, rank and share displayed by the map.
 */
export async function getIceHeatmapSnapshot(): Promise<HeatmapSnapshot> {
  'use cache';
  cacheLife('hours');
  cacheTag('ice-heatmap');

  const supabase = publicClient();
  const release = await readLatestRelease(supabase);
  const expectedCities = integerField(release.mapped_cities, 'mapped_cities');
  const expectedRecords = integerField(release.mapped_records, 'mapped_records');
  const expectedMax = integerField(release.max_city_count, 'max_city_count');

  const rows = await readCities(supabase, release.id, expectedCities);
  const cities: CityPoint[] = rows.map((row) => ({
    city: row.city,
    state: row.state,
    stateCode: row.state_code,
    lat: numberField(row.lat, 'city latitude'),
    lng: numberField(row.lng, 'city longitude'),
    count: integerField(row.arrest_count, 'city arrest_count'),
  }));

  if (cities.length !== expectedCities) {
    throw new Error(
      `ICE heat-map snapshot has ${cities.length} city rows, expected ${expectedCities}`
    );
  }

  const totalMapped = cities.reduce((total, city) => total + city.count, 0);
  if (totalMapped !== expectedRecords) {
    throw new Error(
      `ICE heat-map city totals add to ${totalMapped}, expected ${expectedRecords}`
    );
  }

  const maxCityCount = cities.reduce((max, city) => Math.max(max, city.count), 0);
  if (maxCityCount !== expectedMax) {
    throw new Error(`ICE heat-map max city total is ${maxCityCount}, expected ${expectedMax}`);
  }

  const keys = new Set(cities.map((city) => `${city.city}|${city.stateCode}`));
  if (keys.size !== cities.length) {
    throw new Error('ICE heat-map snapshot contains duplicate city/state keys');
  }

  const meta: HeatmapMeta = {
    generatedAt: release.generated_at,
    releaseCheckedAt: release.release_checked_at,
    releaseNote: release.release_note,
    periodStart: release.period_start,
    periodEnd: release.period_end,
    sourceName: release.source_name,
    sourceUrl: release.source_url,
    sourceDataUrl: release.source_data_url,
    sourceRelease: release.source_release,
    sourceCitation: release.source_citation,
    license: release.license,
    coordinateSource: release.coordinate_source,
    coordinateUrl: release.coordinate_url,
    rawRecords: integerField(release.raw_records, 'raw_records'),
    duplicateRowsRemoved: integerField(
      release.duplicate_rows_removed,
      'duplicate_rows_removed'
    ),
    records: integerField(release.records, 'records'),
    recordsWithUsCity: integerField(release.records_with_us_city, 'records_with_us_city'),
    mappedRecords: expectedRecords,
    unmappedCityRecords: integerField(
      release.unmapped_city_records,
      'unmapped_city_records'
    ),
    recordsWithoutUsableCity: integerField(
      release.records_without_usable_city,
      'records_without_usable_city'
    ),
    mappedCities: expectedCities,
    mappedShareOfCityTagged: numberField(
      release.mapped_share_of_city_tagged,
      'mapped_share_of_city_tagged'
    ),
    mappedShareOfAll: numberField(release.mapped_share_of_all, 'mapped_share_of_all'),
    maxCityCount: maxCityCount,
    sha256: release.sha256,
    method: release.method,
  };

  return { meta, cities };
}
