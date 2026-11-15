import 'leaflet/dist/leaflet.css';

import { CalendarDays, Database, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import { IceArrestHeatMap } from '@/components/ice-alerts/IceArrestHeatMap';
import { formatDateLabel } from '@/components/ice-alerts/data';
import heatmapData from '@/data/ice-arrest-heatmap.json';
import { pageMetadata } from '@/lib/metadata';

const iceMeta = heatmapData.meta;
const numberFormatter = new Intl.NumberFormat('en-US');

export const metadata: Metadata = pageMetadata({
  title: 'ICE Arrests, Mapped — Historical FOIA Data',
  description: `A historical city-level map of ${numberFormatter.format(
    iceMeta.mappedRecords
  )} ICE arrest records assigned to U.S. city and place points in the latest available processed FOIA release, covering October 2022 through ${formatDateLabel(
    iceMeta.periodEnd
  )} and checked ${formatDateLabel(iceMeta.releaseCheckedAt)}. This is not a live alert feed.`,
  path: '/ice-alerts',
  robots: { index: false, follow: false },
});

export default function IceArrestsMapPage() {
  return (
    <div className="civic-page min-h-screen w-full bg-background text-foreground">
      <header className="border-b border-border pt-(--header-clearance)">
        <div className="mx-auto max-w-7xl px-4 pb-8 pt-7 sm:px-6 sm:pb-10 sm:pt-9 lg:px-8">
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
                October 1, 2022 through {formatDateLabel(iceMeta.periodEnd)}. No newer ICE release
                was available when this page was checked on{' '}
                {formatDateLabel(iceMeta.releaseCheckedAt)}. This is a historical dataset, not a
                live alert service. The map starts nationwide and can center on your approximate
                or precise area; it does not store your location.
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
                This map is historical and interactive. It cannot show current enforcement
                activity, identify a street-level event, or dispatch help. Do not approach,
                confront, or film enforcement activity.
              </p>
            </div>
          </div>
        </div>
      </header>

      <IceArrestHeatMap />
    </div>
  );
}
