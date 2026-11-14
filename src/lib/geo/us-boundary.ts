import boundaryData from './us-boundary-data.json';

/**
 * U.S. state and territory rings, as [longitude, latitude] pairs.
 *
 * Source: U.S. Census Bureau 2024 cartographic boundary files (public domain):
 * `cb_2024_us_state_5m.shp` plus the 1:500,000 island-area county subdivisions
 * for American Samoa (60), Guam (66), the Northern Mariana Islands (69), and
 * the U.S. Virgin Islands (78). Rings were simplified with a 0.008° tolerance
 * and coordinates rounded to four decimal places.
 *
 * The island-area files are included because the page promises previews at any
 * U.S. location, not only the fifty states and Washington, DC.
 */
type Ring = readonly (readonly [number, number])[];
const BOUNDARY_RINGS = boundaryData as unknown as Ring[];

/**
 * Return whether a map point is inside the United States or one of its
 * territories. This is a real point-in-polygon test, not a bounding box:
 * Toronto, Vancouver, Windsor, Tijuana, and Ciudad Juárez are all outside it.
 */
export function isUsPoint(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  return BOUNDARY_RINGS.some((ring) => pointInRing(lng, lat, ring));
}

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    // Ray cast east from the point. Horizontal edges and vertices are skipped
    // by the strict > comparison, so a point on a shared border is not counted
    // twice.
    if (yi > lat !== yj > lat) {
      const intersectionLng = ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (lng < intersectionLng) inside = !inside;
    }
  }

  return inside;
}
