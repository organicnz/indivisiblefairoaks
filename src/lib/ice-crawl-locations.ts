import {
  cleanCityName,
  createCityMatcher,
  extractStateCode,
  isStreetSuffixCityName,
  US_STATE_CODES,
  type CityMatcher,
} from '@/lib/rapid-city-match';
import {
  getIceCrawlStore,
  listIceCityPoints,
  listSourceReportsForLocationAudit,
  updateSourceReportLocations,
  type IceSourceReportLocationRow,
} from '@/lib/ice-crawl-store';

export type IceLocationBackfillResult = {
  scanned: number;
  matched: number;
  updated: number;
  cleared: number;
  unmatched: number;
  cityPoints: number;
  groups: number;
};

const PAGE_SIZE = 1_000;
const UPDATE_CHUNK_SIZE = 100;

/** Road words that should never be stored as a city label. */
const ROAD_TERMS =
  /\b(?:fwy|freeway|hwy|highway|turnpike|route|rte|parkway|pkwy)\b/i;

/**
 * Single common words that double as city names in the snapshot. Without an
 * explicit state they are too easy to match by accident in report prose.
 */
const GENERIC_NO_STATE_CITIES = new Set([
  'bear',
  'canyon',
  'each',
  'friendship',
  'hauser',
  'landing',
  'many',
  'mesa',
  'north',
  'parkland',
  'post',
  'siren',
  'south',
  'van',
  'wells',
  'west',
  'east',
]);

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function appearsIn(value: string, haystack: string) {
  const needle = ` ${normalize(value)} `;
  return ` ${normalize(haystack)} `.includes(needle);
}

const BEFORE_CITY_WORDS = new Set([
  'activity',
  'and',
  'area',
  'at',
  'by',
  'from',
  'in',
  'near',
  'of',
  'on',
  'report',
  'seen',
  'sighting',
  'source',
  'spotted',
  'the',
  'to',
  'st',
  'street',
  'ave',
  'avenue',
  'blvd',
  'boulevard',
  'rd',
  'road',
  'dr',
  'drive',
  'ln',
  'lane',
  'way',
  'hwy',
  'highway',
  'fwy',
  'pkwy',
  'parkway',
  'ct',
  'court',
  'pl',
  'place',
  'ter',
  'terrace',
  'cir',
  'circle',
  'sq',
  'square',
  'loop',
  'trail',
  'trl',
]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Preserve a source-stated city when only the stored state is wrong, but only
 * when the city sits directly before the state (allowing a street suffix or a
 * preposition in front). This fixes "Willowbrook IL" from a California source
 * without treating "Costa" in "Costa Mesa" as the city of Mesa.
 */
function cityBeforeState(text: string, city: string, stateCode: string) {
  const haystack = normalize(text);
  const pattern = new RegExp(
    `(?:^|\\s)${escapeRegExp(normalize(city))}(?:\\s+area)?\\s+${stateCode.toLowerCase()}\\b`,
    'i'
  );
  const match = pattern.exec(haystack);
  if (!match) return false;
  const prefix = haystack.slice(0, match.index).trim();
  if (!prefix) return true;
  const before = prefix.split(' ').pop() ?? '';
  return !before || BEFORE_CITY_WORDS.has(before) || /^\d+$/.test(before);
}

function plausibleCurrentCity(value: string | null) {
  const city = cleanCityName(value);
  if (!city || city.length > 80) return null;
  if (!/[a-z]/i.test(city) || /\d/.test(city)) return null;
  if (isStreetSuffixCityName(city)) return null;
  if (ROAD_TERMS.test(city)) return null;
  if (/\b(?:area|county)\b/i.test(city)) return null;
  return city;
}

function verifiedCity(matcher: CityMatcher | null, text: string, stateCode: string) {
  const match = matcher?.findCityInLocation(text, stateCode) ?? null;
  return match ? cleanCityName(match.city.city) ?? match.city.city : null;
}

function keepUnstatedStateLocation(
  row: IceSourceReportLocationRow,
  matcher: CityMatcher | null,
  city: string,
  stateCode: string
) {
  if (city.length < 6 || city.split(' ').length > 3) return false;
  if (GENERIC_NO_STATE_CITIES.has(city.toLowerCase())) return false;
  if (!appearsIn(city, `${row.title}\n${row.text_content.slice(0, 1_000)}`)) {
    return false;
  }
  return Boolean(matcher?.findCityCentroid(city, stateCode));
}

/**
 * Resolve one public row without touching its source text or provenance.
 *
 * A state found in the source is authoritative. When it is present, a city is
 * only replaced by a verified city in that same state. Existing clean cities
 * are retained because the chapter's city snapshot only includes places with
 * enforcement records and does not cover every U.S. municipality.
 */
export function resolveIceSourceReportLocation(
  row: IceSourceReportLocationRow,
  matcher: CityMatcher | null
): { city: string | null; stateCode: string | null } {
  const stateCode =
    extractStateCode(row.title) ??
    extractStateCode(row.text_content.slice(0, 1_000)) ??
    null;
  const currentCity = plausibleCurrentCity(row.city);
  const currentState =
    row.state_code && US_STATE_CODES.has(row.state_code) ? row.state_code : null;

  if (stateCode) {
    const citySitsBeforeState =
      Boolean(currentCity) &&
      (cityBeforeState(row.title, currentCity!, stateCode) ||
        cityBeforeState(row.text_content.slice(0, 1_000), currentCity!, stateCode));

    // A clean city immediately before the state is the source's own locality.
    // This can also repair a wrong stored state ("Willowbrook IL" in a CA row)
    // without preserving street names such as "Houston Ave" in another city.
    if (currentCity && citySitsBeforeState) {
      return { city: currentCity, stateCode };
    }
    const matchedCity =
      verifiedCity(matcher, row.title, stateCode) ??
      verifiedCity(matcher, row.text_content.slice(0, 1_000), stateCode);
    return { city: matchedCity, stateCode };
  }

  // No state is stated anywhere in the source. Retain a clean, verified city
  // only when it is explicitly present and not a generic word that can match
  // ordinary prose. Otherwise leave the location unstated rather than guess.
  if (
    currentCity &&
    currentState &&
    keepUnstatedStateLocation(row, matcher, currentCity, currentState)
  ) {
    return { city: currentCity, stateCode: currentState };
  }

  return { city: null, stateCode: null };
}

/**
 * Audit every public report location. This fills missing values and repairs
 * rows written before state-specific matching was enforced. Existing source
 * text, original URLs, and timestamps are never modified.
 */
export async function backfillIceSourceLocations(): Promise<IceLocationBackfillResult> {
  const store = getIceCrawlStore();
  if (!store) throw new Error('Crawler storage is not configured.');

  const cityPoints = await listIceCityPoints(store);
  const matcher = cityPoints.length > 0 ? createCityMatcher(cityPoints) : null;

  const rows: IceSourceReportLocationRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await listSourceReportsForLocationAudit(store, PAGE_SIZE, offset);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const groups = new Map<
    string,
    { city: string | null; stateCode: string | null; ids: string[] }
  >();
  let matched = 0;
  let cleared = 0;

  for (const row of rows) {
    const resolved = resolveIceSourceReportLocation(row, matcher);
    if (resolved.city) matched += 1;
    if (row.city && !resolved.city) cleared += 1;
    if (resolved.city === row.city && resolved.stateCode === row.state_code) continue;

    const key = `${resolved.stateCode ?? ''}|${resolved.city ?? ''}`;
    const group = groups.get(key) ?? {
      city: resolved.city,
      stateCode: resolved.stateCode,
      ids: [],
    };
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
    cleared,
    unmatched: rows.length - matched,
    cityPoints: cityPoints.length,
    groups: groups.size,
  };
}
