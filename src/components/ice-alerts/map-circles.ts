/** Circle geometry and styling for the city-level ICE map. */
export const CITY_CIRCLE_MIN_RADIUS = 2.5;
export const CITY_CIRCLE_MAX_RADIUS = 34;

export const CITY_CIRCLE_STYLE = {
  color: '#64120d',
  weight: 0.75,
  opacity: 0.9,
  fillColor: '#b42318',
  fillOpacity: 0.48,
} as const;

/**
 * A city with more assigned records gets a larger circle. The radius uses a
 * logarithmic scale so small cities remain visible beside the largest totals.
 * This is a screen-pixel radius, not a geographic distance.
 */
export function cityCircleRadius(count: number, maxCount: number): number {
  if (!Number.isFinite(maxCount) || maxCount <= 0) return CITY_CIRCLE_MIN_RADIUS;

  const safeCount = Number.isFinite(count) ? Math.min(Math.max(0, count), maxCount) : 0;
  const ratio = Math.log1p(safeCount) / Math.log1p(maxCount);

  return (
    CITY_CIRCLE_MIN_RADIUS +
    (CITY_CIRCLE_MAX_RADIUS - CITY_CIRCLE_MIN_RADIUS) * Math.min(1, Math.max(0, ratio))
  );
}
