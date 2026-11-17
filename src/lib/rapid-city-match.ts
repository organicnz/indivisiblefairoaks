import type { CityPoint } from '@/components/ice-alerts/types';

export const US_STATE_CODES = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'AS',
  'GU',
  'MP',
  'PR',
  'VI',
]);

const STATE_NAME_BEFORE_ZIP_STOP = new Set([
  'and',
  'at',
  'by',
  'e',
  'from',
  'in',
  'n',
  'near',
  'ne',
  'nw',
  'of',
  'on',
  'or',
  's',
  'se',
  'sw',
  'the',
  'to',
  'w',
]);

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  'district of columbia': 'DC',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'puerto rico': 'PR',
};

function separateStateCode(value: string) {
  return value.replace(/([a-z])([A-Z]{2})(?=\s*\d{5})/g, '$1 $2');
}

function normalizeWords(value: string) {
  return separateStateCode(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A few Census place names are also bare street suffixes. Matching those names
 * turns "Crenshaw Boulevard" into the CDP of Boulevard, CA. They are too
 * ambiguous to use for a free-text location match.
 */
const STREET_SUFFIX_CITY_NAMES = new Set([
  'avenue',
  'boulevard',
  'circle',
  'court',
  'drive',
  'freeway',
  'highway',
  'lane',
  'loop',
  'parkway',
  'place',
  'road',
  'route',
  'square',
  'street',
  'terrace',
  'trail',
  'turnpike',
  'way',
]);

export function isStreetSuffixCityName(value: string) {
  return STREET_SUFFIX_CITY_NAMES.has(normalizeWords(value));
}

/** Clean display-only artifacts without changing the source text. */
export function cleanCityName(value: string | null | undefined) {
  if (!value) return null;
  let city = value.replace(/\s+/g, ' ').trim();
  city = city.replace(/^(?:source\s+)?report\s*:\s*/i, '');
  city = city.replace(/\s+area$/i, '');
  city = city.replace(/[’'"]+$/g, '').trim();
  let previous = '';
  while (previous !== city) {
    previous = city;
    city = city.replace(/^(?:N|S|E|W|NE|NW|SE|SW)\s+/i, '').trim();
  }
  return city || null;
}

function nameVariants(name: string) {
  const normalized = normalizeWords(name);
  const variants = new Set<string>([normalized]);

  if (normalized.startsWith('st ')) {
    variants.add(`saint ${normalized.slice(3)}`);
  }
  if (normalized.startsWith('saint ')) {
    variants.add(`st ${normalized.slice(6)}`);
  }

  return [...variants].filter(Boolean);
}

function containsPhrase(haystack: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^| )${escaped}($| )`, 'i').test(haystack);
}

export function extractStateCode(location: string): string | null {
  // Community exports sometimes concatenate a city and state ("Costa MesaCA")
  // or a state and ZIP+4 ("CA 927807020"). Insert the missing separator so the
  // state signal is not lost.
  const normalized = separateStateCode(location).toUpperCase();

  // ZIP-anchored state code is the most reliable signal ("Santa Ana CA 92701").
  const zipMatch = normalized.match(/\b([A-Z]{2})\s*\d{5,9}(?:-\d{4})?\b/);
  if (zipMatch && US_STATE_CODES.has(zipMatch[1])) return zipMatch[1];

  // A comma-anchored state code is safe in prose ("Sacramento, CA this morning").
  const commaMatch = normalized.match(/,\s*([A-Z]{2})\b/);
  if (commaMatch && US_STATE_CODES.has(commaMatch[1])) return commaMatch[1];

  // Fall back to a two-letter token near the end, allowing a trailing country.
  const tailMatch = normalized.match(
    /\b([A-Z]{2})\s*(?:UNITED STATES|USA|US)?\s*$/
  );
  if (tailMatch && US_STATE_CODES.has(tailMatch[1])) return tailMatch[1];

  // Some community exports spell out the state. A bare state word such as
  // "Vermont" or "Virginia" is often a street name, so only accept it at the
  // end, after a comma, or (for multi-word names) immediately before a ZIP.
  const trimmed = location.trim();
  const words = ` ${normalizeWords(location)} `;
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (!containsPhrase(words, name)) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const atEnd = new RegExp(`(?:^|\\s|,)\\s*${escaped}\\s*$`, 'i').test(trimmed);
    const zipSuffix = '\\d{5,9}(?:-\\d{4})?(?:\\s+\\d{5,9}(?:-\\d{4})?)*';
    const commaBeforeZip = new RegExp(
      `,\\s*${escaped}\\s+${zipSuffix}\\s*$`,
      'i'
    ).test(trimmed);
    const beforeZip = new RegExp(
      `(?:^|\\s)${escaped}\\s+${zipSuffix}\\s*$`,
      'i'
    ).exec(trimmed);
    let nameBeforeZip = false;
    if (beforeZip) {
      const prefix = trimmed.slice(0, beforeZip.index).trim();
      const previous = (prefix.split(/\s+/).pop() ?? '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');
      nameBeforeZip = name.includes(' ') || !STATE_NAME_BEFORE_ZIP_STOP.has(previous);
    }
    if (atEnd || commaBeforeZip || nameBeforeZip) return code;
  }

  return null;
}

export type CityMatch = {
  city: CityPoint;
  stateCode: string;
};

export type CityMatcher = {
  findCityInLocation(location: string, stateCode?: string | null): CityMatch | null;
  findCityCentroid(city: string, stateCode: string): CityPoint | null;
};

/**
 * Build a matcher from the Supabase city snapshot supplied by the caller.
 *
 * Keeping the index request-scoped avoids a module-level copy of the release
 * and makes the data source explicit: a caller with no snapshot cannot match a
 * location to a city.
 */
export function createCityMatcher(cities: readonly CityPoint[]): CityMatcher {
  const citiesByState = new Map<string, CityPoint[]>();
  const cityStatesByName = new Map<string, Set<string>>();

  for (const rawCity of cities) {
    const displayName = cleanCityName(rawCity.city);
    if (!displayName || isStreetSuffixCityName(displayName)) continue;
    const city = displayName === rawCity.city ? rawCity : { ...rawCity, city: displayName };
    const stateCities = citiesByState.get(city.stateCode) ?? [];
    stateCities.push(city);
    citiesByState.set(city.stateCode, stateCities);

    for (const variant of nameVariants(city.city)) {
      const states = cityStatesByName.get(variant) ?? new Set<string>();
      states.add(city.stateCode);
      cityStatesByName.set(variant, states);
    }
  }

  // Longest names first so "Huntington Park" wins over "Huntington" when both
  // appear in the same location string, and "New York" is not shadowed by a
  // shorter place name.
  for (const stateCities of citiesByState.values()) {
    stateCities.sort((a, b) => b.city.length - a.city.length);
  }

  /**
   * Resolve a report's free-text location to a known city and state.
   *
   * The returned point is the Census city centroid already used by the verified
   * FOIA map. The original street address is never returned, persisted, or sent
   * to the browser.
   */
  function matchEnd(haystack: string, phrase: string) {
    const token = ` ${phrase} `;
    let index = haystack.indexOf(token);
    let end = -1;
    while (index >= 0) {
      end = Math.max(end, index + phrase.length);
      index = haystack.indexOf(token, index + 1);
    }
    return end;
  }

  function findCityInLocation(
    location: string,
    stateCode: string | null = extractStateCode(location)
  ): CityMatch | null {
    const haystack = ` ${normalizeWords(location)} `;
    let best: { city: CityPoint; stateCode: string; score: number } | null = null;

    const consider = (city: CityPoint, code: string) => {
      for (const variant of nameVariants(city.city)) {
        const end = matchEnd(haystack, variant);
        if (end < 0) continue;
        const score = end * 100 + variant.length;
        if (!best || score > best.score) {
          best = { city, stateCode: code, score };
        }
      }
    };

    if (stateCode) {
      // A supplied state is authoritative. Never fall through to a same-named
      // city in another state; that turns California ZIPs into Illinois places.
      for (const city of citiesByState.get(stateCode) ?? []) {
        consider(city, stateCode);
      }
      return best;
    }

    // Without a state, only resolve a city when the name is unambiguous across
    // the snapshot. Ambiguous names are dropped rather than guessed.
    for (const [name, states] of cityStatesByName) {
      if (states.size !== 1) continue;
      const code = [...states][0];
      const city = (citiesByState.get(code) ?? []).find(
        (candidate) => normalizeWords(candidate.city) === name
      );
      if (city) consider(city, code);
    }

    return best;
  }

  function findCityCentroid(city: string, stateCode: string): CityPoint | null {
    const candidates = citiesByState.get(stateCode) ?? [];
    const normalized = normalizeWords(city);
    const found =
      candidates.find((candidate) => normalizeWords(candidate.city) === normalized) ?? null;
    return found ? { ...found, city: cleanCityName(found.city) ?? found.city } : null;
  }

  return { findCityInLocation, findCityCentroid };
}
