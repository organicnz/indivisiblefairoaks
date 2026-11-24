export type HistoricalCityCounts = Record<string, number>;

export function historicalCityKey(city: { city: string; stateCode: string }): string {
  return `${city.stateCode.trim().toUpperCase()}|${city.city.trim().toLowerCase()}`;
}

/**
 * The rapid-response view only needs each city's historical total, not its
 * coordinates. Sending a keyed count index keeps the city-watch comparison
 * while leaving the full point set for the map overlay, which loads on demand.
 */
export function buildHistoricalCityCounts(
  cities: readonly { city: string; stateCode: string; count: number }[]
): HistoricalCityCounts {
  const counts: HistoricalCityCounts = {};
  for (const city of cities) {
    const key = historicalCityKey(city);
    // Preserve the previous find-first lookup if a release ever contains
    // duplicate city/state rows.
    if (counts[key] === undefined) counts[key] = city.count;
  }
  return counts;
}
