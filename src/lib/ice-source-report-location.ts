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
 * Nearest city with both a verified coordinate and at least one published
 * source report. Ties prefer the city with more reports, then alphabetical
 * order, so the result is deterministic.
 */
export function nearestSourceReportPlace(
  places: readonly SourceReportPlacePoint[],
  lat: number,
  lng: number
): { place: SourceReportPlacePoint; distanceMiles: number } | null {
  let best: { place: SourceReportPlacePoint; distanceMiles: number } | null = null;

  for (const place of places) {
    const distanceMiles = distanceMilesBetween(lat, lng, place.lat, place.lng);
    if (!Number.isFinite(distanceMiles)) continue;

    if (
      !best ||
      distanceMiles < best.distanceMiles ||
      (distanceMiles === best.distanceMiles &&
        (place.count > best.place.count ||
          (place.count === best.place.count &&
            sourceReportPlaceKey(place.city, place.stateCode) <
              sourceReportPlaceKey(best.place.city, best.place.stateCode))))
    ) {
      best = { place, distanceMiles };
    }
  }

  return best;
}
