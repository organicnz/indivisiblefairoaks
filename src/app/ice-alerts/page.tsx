import 'leaflet/dist/leaflet.css';

import {
  ArrowRight,
  CalendarDays,
  Database,
  HeartHandshake,
  MessageSquareText,
  Phone,
  Radio,
} from 'lucide-react';
import type { Metadata } from 'next';
import { IceArrestHeatMap } from '@/components/ice-alerts/IceArrestHeatMap';
import { IceRapidResponse } from '@/components/ice-alerts/IceRapidResponse';
import { ReviewedReportsSection } from '@/components/ice-alerts/ReviewedReportsSection';
import { WebReportsSection } from '@/components/ice-alerts/WebReportsSection';
import { ReportSightingButton } from '@/components/ice-alerts/ReportSightingDialog';
import { SurgeAlertsButton } from '@/components/ice-alerts/SurgeAlertsDialog';
import { formatDateLabel } from '@/components/ice-alerts/data';
import { parseIceMapUrlState } from '@/components/ice-alerts/map-url-state';
import { parseRapidUrlState } from '@/components/ice-alerts/rapid-url-state';
import type { HeatmapSnapshot } from '@/components/ice-alerts/types';
import { pageMetadata } from '@/lib/metadata';
import { getIceHeatmapSnapshot } from '@/lib/queries/ice-heatmap';

const numberFormatter = new Intl.NumberFormat('en-US');

// Deliberate Cache Components opt-out: the selected city, search pin and
// viewport derive from request-time searchParams, and the rapid-response view
// uses a live client feed.
export const instant = false;

export const metadata: Metadata = pageMetadata({
  title: 'ICE Alert — National Rapid-Response Map',
  description:
    'A nationwide rapid-response map of community-reported ICE activity from the Stop ICE Alerts Network and official ICE newsroom releases, with city-level locations, source labels, and safety guidance. This is not an emergency service.',
  path: '/ice-alerts',
  robots: { index: false, follow: false },
});

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

function readView(params: Record<string, string | string[] | undefined>) {
  const raw = params.view;
  return Array.isArray(raw) ? raw[0] : raw;
}

function RapidActions() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SurgeAlertsButton />
      <a
        href="#alert-channels"
        className="inline-flex min-h-11 items-center gap-1.5 border border-border bg-surface-card px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <MessageSquareText className="size-3.5" aria-hidden="true" />
        Text &amp; Signal
      </a>
      <a
        href="/ice-alerts/reunification"
        className="inline-flex min-h-10 items-center gap-1.5 border border-primary/30 bg-primary/5 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <HeartHandshake className="size-3.5" aria-hidden="true" />
        Family help
      </a>
      <ReportSightingButton />
      <a
        href="tel:911"
        className="inline-flex min-h-10 items-center gap-1.5 border border-accent/40 bg-accent/10 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-accent transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Phone className="size-3.5" aria-hidden="true" />
        911
      </a>
    </div>
  );
}

function HistoricalHeader({ snapshot }: { snapshot: HeatmapSnapshot }) {
  const iceMeta = snapshot.meta;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center border border-accent/40 bg-accent/10">
            <Database className="size-5 text-accent" aria-hidden="true" />
          </span>
          <p className="civic-kicker">Historical FOIA release / Interactive city map</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="civic-stamp">ICE FOIA data</span>
          <span className="civic-stamp">Not live</span>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
        <div className="min-w-0">
          <h1 className="max-w-4xl font-display text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">
            ICE arrests, mapped
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            A national, interactive map of {numberFormatter.format(iceMeta.mappedRecords)} ICE
            arrest records assigned to {numberFormatter.format(iceMeta.mappedCities)} U.S. city
            and place points in a processed FOIA release. The latest available release covers
            {formatDateLabel(iceMeta.periodStart)} through {formatDateLabel(iceMeta.periodEnd)}.
            No newer ICE release was
            available when this page was checked on {formatDateLabel(iceMeta.releaseCheckedAt)}.
            This is a historical dataset, not a live alert service. The map starts nationwide and
            can center on your approximate or precise area; it does not store your location.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              Latest release: {formatDateLabel(iceMeta.periodEnd)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              Checked {formatDateLabel(iceMeta.releaseCheckedAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Database className="size-3.5" aria-hidden="true" />
              Deportation Data Project / ICE FOIA
            </span>
          </div>
        </div>

        <div className="border-l-2 border-accent pl-4">
          <a
            href="tel:911"
            className="inline-flex items-start gap-2.5 text-sm font-semibold leading-snug text-foreground transition-colors hover:text-accent"
          >
            <Phone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            Immediate danger? Call 911.
          </a>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            This map is historical and interactive. It cannot show current enforcement activity,
            identify a street-level event, or dispatch help. If you encounter enforcement activity,
            you can carefully observe or film from a safe distance; do not interfere or obstruct.
            Filming in public is generally protected by the First Amendment.
          </p>
          <a
            href="/ice-alerts"
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2"
          >
            Back to the rapid-response map
            <ArrowRight className="size-3" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default async function IceAlertsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const view = readView(params);
  const hasHistoricalParams = Boolean(params.city || params.pin || params.q);
  const isHistory = view === 'history' || (view !== 'rapid' && hasHistoricalParams);
  const snapshot = await getIceHeatmapSnapshot();
  const historicalState = parseIceMapUrlState(params, snapshot.cities);
  const rapidState = parseRapidUrlState(params);

  return (
    <div className="civic-page min-h-screen w-full bg-background text-foreground">
      <header className="border-b border-border pt-(--header-clearance)">
        <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
            <a
              href="/ice-alerts"
              className="flex min-w-0 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <span className="flex size-8 shrink-0 items-center justify-center border border-accent/40 bg-accent/10">
                <Radio className="size-4 text-accent" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  {isHistory ? (
                    <span className="font-display text-xl font-semibold tracking-[-0.03em]">
                      ICE Alert
                    </span>
                  ) : (
                    <h1 className="font-display text-xl font-semibold tracking-[-0.03em]">
                      ICE Alert
                    </h1>
                  )}
                  <span className="hidden font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:inline">
                    National rapid response
                  </span>
                </span>
                {!isHistory ? (
                  <span className="mt-0.5 block font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]">
                    Community + official / city-level only / not 911
                  </span>
                ) : null}
              </span>
            </a>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <nav
                aria-label="ICE data views"
                className="inline-flex max-w-full shrink-0 flex-wrap border border-border"
              >
                <a
                  href="/ice-alerts"
                  aria-current={isHistory ? undefined : 'page'}
                  className={`inline-flex min-h-8 items-center px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                    isHistory
                      ? 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                      : 'bg-foreground text-background'
                  }`}
                >
                  Rapid response
                </a>
                <a
                  href="/ice-alerts?view=history"
                  aria-current={isHistory ? 'page' : undefined}
                  className={`inline-flex min-h-8 items-center border-l border-border px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                    isHistory
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                  }`}
                >
                  Historical FOIA
                </a>
                <a
                  href="/ice-alerts/web-reports"
                  className="inline-flex min-h-8 items-center border-l border-border px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  Web reports
                </a>
              </nav>
              {!isHistory ? <RapidActions /> : null}
            </div>
          </div>
        </div>

        {isHistory ? <HistoricalHeader snapshot={snapshot} /> : null}
      </header>

      {isHistory ? (
        <IceArrestHeatMap snapshot={snapshot} initialState={historicalState} />
      ) : (
        <>
          <IceRapidResponse snapshot={snapshot} initialState={rapidState}>
            <WebReportsSection />
          </IceRapidResponse>
          <ReviewedReportsSection />
        </>
      )}
    </div>
  );
}
