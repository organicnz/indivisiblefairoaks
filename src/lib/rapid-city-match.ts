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

function normalizeWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  if (normalized.endsWith(' city')) {
    variants.add(normalized.slice(0, -5));
  }

  return [...variants].filter(Boolean);
}

function containsPhrase(haystack: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^| )${escaped}($| )`, 'i').test(haystack);
}

export function extractStateCode(location: string): string | null {
  const normalized = location.toUpperCase();

  // ZIP-anchored state code is the most reliable signal ("Santa Ana CA 92701").
  const zipMatch = normalized.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
  if (zipMatch && US_STATE_CODES.has(zipMatch[1])) return zipMatch[1];

  // Fall back to a two-letter token near the end, allowing a trailing country.
  const tailMatch = normalized.match(
    /\b([A-Z]{2})\s*(?:UNITED STATES|USA|US)?\s*$/
  );
  if (tailMatch && US_STATE_CODES.has(tailMatch[1])) return tailMatch[1];

  // Some community exports spell out the state.
  const words = ` ${normalizeWords(location)} `;
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (containsPhrase(words, name)) return code;
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

  for (const city of cities) {
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
  function findCityInLocation(
    location: string,
    stateCode: string | null = extractStateCode(location)
  ): CityMatch | null {
    const haystack = ` ${normalizeWords(location)} `;

    if (stateCode) {
      const candidates = citiesByState.get(stateCode) ?? [];
      for (const city of candidates) {
        for (const variant of nameVariants(city.city)) {
          if (containsPhrase(haystack, variant)) {
            return { city, stateCode };
          }
        }
      }
    }

    // Without a state, only resolve a city when the name is unambiguous across
    // the snapshot. Ambiguous names are dropped rather than guessed.
    for (const [name, states] of cityStatesByName) {
      if (states.size !== 1 || !containsPhrase(haystack, name)) continue;
      const code = [...states][0];
      const city = (citiesByState.get(code) ?? []).find(
        (candidate) => normalizeWords(candidate.city) === name
      );
      if (city) return { city, stateCode: code };
    }

    return null;
  }

  function findCityCentroid(city: string, stateCode: string): CityPoint | null {
    const candidates = citiesByState.get(stateCode) ?? [];
    const normalized = normalizeWords(city);
    return (
      candidates.find((candidate) => normalizeWords(candidate.city) === normalized) ?? null
    );
  }

  return { findCityInLocation, findCityCentroid };
}
