import 'leaflet/dist/leaflet.css';

import type { Metadata } from 'next';
import { HistoricalFoiaModule } from '@/components/ice-alerts/HistoricalFoiaModule';
import { buildHistoricalCityCounts } from '@/components/ice-alerts/historical-city-key';
import { IceAlertsTopBar } from '@/components/ice-alerts/IceAlertsTopBar';
import { IceRapidResponse } from '@/components/ice-alerts/IceRapidResponse';
import { parseIceMapUrlState } from '@/components/ice-alerts/map-url-state';
import { ReviewedReportsSection } from '@/components/ice-alerts/ReviewedReportsSection';
import { parseRapidUrlState } from '@/components/ice-alerts/rapid-url-state';
import { WebReportsSection } from '@/components/ice-alerts/WebReportsSection';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';
import { getIceHeatmapSnapshot } from '@/lib/queries/ice-heatmap';

// The selected city, search pin and viewport derive from request-time
// searchParams, and the rapid-response view uses a live client feed. Those
// reads stay behind the segment's loading boundary so the route ships a
// non-empty shell instead of an empty 0-byte PPR placeholder.

export const metadata: Metadata = pageMetadata({
  title: 'ICE Alert — National Rapid-Response Map',
  description:
    'A nationwide rapid-response map of community-reported ICE activity from the Stop ICE Alerts Network and official ICE newsroom releases, with city-level locations, source labels, and safety guidance. Includes a separate historical FOIA city-level baseline from the Deportation Data Project. This is not an emergency service.',
  path: '/ice-alerts',
  robots: { index: false, follow: false },
});

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

function readView(params: Record<string, string | string[] | undefined>) {
  const raw = params.view;
  return Array.isArray(raw) ? raw[0] : raw;
}

export default async function IceAlertsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const view = readView(params);
  const hasLegacyHistoricalParams = Boolean(params.city || params.state || params.pin || params.q);
  const initialHistoryOpen = view === 'history' || (view !== 'rapid' && hasLegacyHistoricalParams);
  const [snapshot, dataPoints] = await Promise.all([getIceHeatmapSnapshot(), getDataPoints('ice')]);
  const historicalState = parseIceMapUrlState(params, snapshot.cities, {
    keyPrefix: 'foia',
    includeUnprefixed: initialHistoryOpen,
  });
  const rapidState = parseRapidUrlState(params);
  const historicalCityCounts = buildHistoricalCityCounts(snapshot.cities);

  return (
    <div className="civic-page min-h-screen w-full bg-background text-foreground">
      <IceAlertsTopBar dataPoints={dataPoints} />

      <IceRapidResponse
        meta={snapshot.meta}
        historicalCityCounts={historicalCityCounts}
        initialState={rapidState}
      >
        <HistoricalFoiaModule
          meta={snapshot.meta}
          initialState={historicalState}
          initialOpen={initialHistoryOpen}
          dataPoints={dataPoints}
        />
        <WebReportsSection />
        <ReviewedReportsSection />
      </IceRapidResponse>
    </div>
  );
}
