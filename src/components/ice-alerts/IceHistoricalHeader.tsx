import { ArrowRight, CalendarDays, Database, Phone } from 'lucide-react';
import { formatDateLabel } from '@/components/ice-alerts/data';
import type { HeatmapSnapshot } from '@/components/ice-alerts/types';
import { DataPoint } from '@/components/ui/DataPoint';

const numberFormatter = new Intl.NumberFormat('en-US');

export function IceHistoricalHeader({
  snapshot,
  dataPoints,
}: {
  snapshot: HeatmapSnapshot;
  dataPoints: Record<string, string>;
}) {
  const iceMeta = snapshot.meta;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center border border-accent/40 bg-accent/10">
            <Database className="size-5 text-accent" aria-hidden="true" />
          </span>
          <DataPoint
            as="p"
            name="ice.history.kicker"
            initialData={dataPoints}
            className="civic-kicker"
          >
            Historical FOIA release / Interactive city map
          </DataPoint>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="civic-stamp">ICE FOIA data</span>
          <span className="civic-stamp">Not live</span>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
        <div className="min-w-0">
          <DataPoint
            as="h1"
            name="ice.history.title"
            initialData={dataPoints}
            className="max-w-4xl font-display text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]"
          >
            ICE arrests, mapped
          </DataPoint>
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
          <DataPoint
            as="p"
            name="ice.history.safety"
            initialData={dataPoints}
            className="mt-2 text-xs leading-relaxed text-muted-foreground"
          >
            This map is historical and interactive. It cannot show current enforcement activity,
            identify a street-level event, or dispatch help. If you encounter enforcement activity,
            you can carefully observe or film from a safe distance; do not interfere or obstruct.
            Filming in public is generally protected by the First Amendment.
          </DataPoint>
          <a
            href="/ice-alerts"
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2"
          >
            <DataPoint as="span" name="ice.history.back" initialData={dataPoints}>
              Back to the rapid-response map
            </DataPoint>
            <ArrowRight className="size-3" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
