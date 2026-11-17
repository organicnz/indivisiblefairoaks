export type SourceReportPlace = {
  city: string;
  stateCode: string;
  count: number;
};

export type SourceReportPlacePoint = SourceReportPlace & {
  lat: number;
  lng: number;
};

const EARTH_RADIUS_MILES = 3958.7613;
const NEARBY_BAND_MILES = 8;
const NEARBY_COUNT_SHARE = 0.5;

function cityKey(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function sourceReportPlaceKey(city: string, stateCode: string) {
  return `${cityKey(city)}|${stateCode.trim().toUpperCase()}`;
}

/**
 * Resolve a named place to a city that actually has published reports. When
 * no state is supplied, the city with the most reports wins so a bare
 * "Springfield" does not silently choose a state with one stray row.
 */
export function exactSourceReportPlace(
  places: readonly SourceReportPlace[],
  city: string,
  stateCode = ''
): SourceReportPlace | null {
  const wantedCity = cityKey(city);
  const wantedState = stateCode.trim().toUpperCase();
  if (!wantedCity) return null;

  const matches = places.filter(
    (place) =>
      cityKey(place.city) === wantedCity &&
      (!wantedState || place.stateCode === wantedState)
  );

  matches.sort(
    (a, b) =>
      b.count - a.count ||
      a.stateCode.localeCompare(b.stateCode) ||
      a.city.localeCompare(b.city)
  );
  return matches[0] ?? null;
}

export function distanceMilesBetween(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Choose a city with both a verified coordinate and published reports.
 *
 * Strict nearest-distance can send a user in Manhattan to a one-report
 * Jersey City row while 14 Queens reports sit two miles farther away. So we
 * keep the nearest city's immediate neighborhood, then prefer the closest
 * city that carries a substantial share of the local report volume. This
 * still returns the true nearest city when the local counts are comparable.
 */
export function nearestSourceReportPlace(
  places: readonly SourceReportPlacePoint[],
  lat: number,
  lng: number
): { place: SourceReportPlacePoint; distanceMiles: number } | null {
  const ranked = places
    .map((place) => ({
      place,
      distanceMiles: distanceMilesBetween(lat, lng, place.lat, place.lng),
    }))
    .filter((candidate) => Number.isFinite(candidate.distanceMiles))
    .sort(
      (a, b) =>
        a.distanceMiles - b.distanceMiles ||
        b.place.count - a.place.count ||
        sourceReportPlaceKey(a.place.city, a.place.stateCode).localeCompare(
          sourceReportPlaceKey(b.place.city, b.place.stateCode)
        )
    );

  const nearest = ranked[0];
  if (!nearest) return null;

  const neighborhood = ranked.filter(
    (candidate) =>
      candidate.distanceMiles <= nearest.distanceMiles + NEARBY_BAND_MILES
  );
  const maxCount = neighborhood.reduce(
    (max, candidate) => Math.max(max, candidate.place.count),
    0
  );
  const meaningfulCount = Math.max(
    1,
    Math.ceil(maxCount * NEARBY_COUNT_SHARE)
  );
  const meaningful = neighborhood.filter(
    (candidate) => candidate.place.count >= meaningfulCount
  );

  // The list is already distance-sorted, so the first meaningful city is the
  // closest one with enough local volume.
  return meaningful[0] ?? nearest;
}
