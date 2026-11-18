import 'leaflet/dist/leaflet.css';

import type { Metadata } from 'next';
import { HistoricalFoiaModule } from '@/components/ice-alerts/HistoricalFoiaModule';
import { IceAlertsTopBar } from '@/components/ice-alerts/IceAlertsTopBar';
import { IceRapidResponse } from '@/components/ice-alerts/IceRapidResponse';
import { ReviewedReportsSection } from '@/components/ice-alerts/ReviewedReportsSection';
import { WebReportsSection } from '@/components/ice-alerts/WebReportsSection';
import { parseIceMapUrlState } from '@/components/ice-alerts/map-url-state';
import { parseRapidUrlState } from '@/components/ice-alerts/rapid-url-state';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';
import { getIceHeatmapSnapshot } from '@/lib/queries/ice-heatmap';

// Deliberate Cache Components opt-out: the selected city, search pin and
// viewport derive from request-time searchParams, and the rapid-response view
// uses a live client feed.
export const instant = false;

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
  const hasLegacyHistoricalParams = Boolean(
    params.city || params.state || params.pin || params.q
  );
  const initialHistoryOpen =
    view === 'history' || (view !== 'rapid' && hasLegacyHistoricalParams);
  const [snapshot, dataPoints] = await Promise.all([
    getIceHeatmapSnapshot(),
    getDataPoints('ice'),
  ]);
  const historicalState = parseIceMapUrlState(params, snapshot.cities, {
    keyPrefix: 'foia',
    includeUnprefixed: initialHistoryOpen,
  });
  const rapidState = parseRapidUrlState(params);

  return (
    <div className="civic-page min-h-screen w-full bg-background text-foreground">
      <IceAlertsTopBar dataPoints={dataPoints} />

      <IceRapidResponse snapshot={snapshot} initialState={rapidState}>
        <HistoricalFoiaModule
          snapshot={snapshot}
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
