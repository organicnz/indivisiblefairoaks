import { getIceHeatmapSnapshot } from '@/lib/queries/ice-heatmap';

/**
 * The historical ICE heat-map is collapsed by default. Its city rows are read
 * from the cached snapshot only when a reader opens that panel, instead of
 * being serialized into the initial `/ice-alerts` document twice.
 */
export async function GET() {
  try {
    const snapshot = await getIceHeatmapSnapshot();
    return Response.json(snapshot, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return Response.json(
      { error: 'Historical ICE map data is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
