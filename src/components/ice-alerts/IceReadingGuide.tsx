import { AlertTriangle, ArrowUpRight, Phone, ShieldCheck } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import { formatDateLabel, formatNumber } from './data';
import type { HeatmapMeta } from './types';

export function IceReadingGuide({ meta }: { meta: HeatmapMeta }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
      <div className="grid gap-6 border-t border-foreground/20 pt-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-10">
        <div>
          <p className="civic-section-index">
            <DataPoint name="ice.reading.eyebrow">How to read this map</DataPoint>
          </p>
          <DataPoint
            as="h2"
            name="ice.reading.title"
            className="mt-2 max-w-md font-display text-3xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-4xl"
          >
            A historical record, not a live alert.
          </DataPoint>
          <DataPoint
            as="p"
            name="ice.reading.intro"
            className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground"
          >
            Cluster numbers and circle sizes help show where large numbers of arrest records were
            assigned. They cannot tell you what is happening now, and this should not be treated as
            a live safety feed.
          </DataPoint>
          <p className="mt-3 max-w-md font-mono text-[10px] font-bold uppercase leading-relaxed tracking-[0.1em] text-muted-foreground">
            Latest release: {formatDateLabel(meta.periodEnd)} · Checked{' '}
            {formatDateLabel(meta.releaseCheckedAt)}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {[
            {
              number: '01',
              titleKey: 'ice.reading.cards.city.title',
              bodyKey: 'ice.reading.cards.city.body',
              title: 'City totals',
              body: 'Each point is the number of records whose city field matches a Census place. It is not a single incident or a street address.',
            },
            {
              number: '02',
              titleKey: 'ice.reading.cards.clusters.title',
              bodyKey: 'ice.reading.cards.clusters.body',
              title: 'Clusters and circles',
              body: 'Numbers group nearby cities at overview zooms and show their combined records. Zoom in for individual city dots; larger circles mean more records assigned to that city.',
            },
            {
              number: '03',
              titleKey: 'ice.reading.cards.gaps.title',
              bodyKey: null,
              title: 'Known gaps',
              body: `${(meta.mappedShareOfAll * 100).toFixed(1)}% of de-duplicated records are mapped. The city field is manually entered, sometimes missing, and may reflect a facility or booking location.`,
            },
          ].map((step) => (
            <div key={step.number} className="border-t border-foreground/25 pt-3">
              <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-accent">
                {step.number}
              </span>
              <DataPoint
                as="h3"
                name={step.titleKey}
                className="mt-2 font-display text-xl font-semibold tracking-[-0.02em]"
              >
                {step.title}
              </DataPoint>
              {step.bodyKey ? (
                <DataPoint
                  as="p"
                  name={step.bodyKey}
                  className="mt-1.5 text-sm leading-relaxed text-muted-foreground"
                >
                  {step.body}
                </DataPoint>
              ) : (
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-3">
        <div className="flex items-start gap-3 bg-surface-muted p-4 sm:p-5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <DataPoint
              as="h3"
              name="ice.reading.facts.dedup.title"
              className="font-display text-lg font-semibold tracking-[-0.02em]"
            >
              De-duplicated
            </DataPoint>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              The snapshot removes {formatNumber(meta.duplicateRowsRemoved)} duplicate rows
              flagged in the processed release before counting.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-surface-muted p-4 sm:p-5">
          <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <DataPoint
              as="h3"
              name="ice.reading.facts.source.title"
              className="font-display text-lg font-semibold tracking-[-0.02em]"
            >
              Source-linked
            </DataPoint>
            <DataPoint
              as="p"
              name="ice.reading.facts.source.body"
              className="mt-1 text-xs leading-relaxed text-muted-foreground"
            >
              The dataset is CC0 and the page links to the Deportation Data Project&apos;s
              processed release and citation.
            </DataPoint>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-surface-muted p-4 sm:p-5">
          <Phone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <DataPoint
              as="h3"
              name="ice.reading.facts.emergency.title"
              className="font-display text-lg font-semibold tracking-[-0.02em]"
            >
              Not an emergency service
            </DataPoint>
            <DataPoint
              as="p"
              name="ice.reading.facts.emergency.body"
              className="mt-1 text-xs leading-relaxed text-muted-foreground"
            >
              The map cannot dispatch help. In an emergency, call 911. If you encounter enforcement
              activity, you can carefully observe or film from a safe distance; do not interfere or
              obstruct. Filming in public is generally protected.
            </DataPoint>
          </div>
        </div>
      </div>

      <div className="mt-6 border-l-2 border-accent bg-accent/5 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-display text-xl font-semibold tracking-[-0.02em]">
          <AlertTriangle className="size-4 text-accent" aria-hidden="true" />
          <DataPoint as="span" name="ice.reading.warning.title">
            What this map does not show
          </DataPoint>
        </h3>
        <ul className="mt-2 grid gap-1.5 text-sm leading-relaxed text-muted-foreground sm:grid-cols-2">
          <li>
            <DataPoint as="span" name="ice.reading.warning.item1">
              No live reports, current enforcement locations, or street-level events.
            </DataPoint>
          </li>
          <li>
            <DataPoint as="span" name="ice.reading.warning.item2">
              No names, faces, plate numbers, or immigration status.
            </DataPoint>
          </li>
          <li>
            <DataPoint as="span" name="ice.reading.warning.item3">
              No claim that every arrest happened in the city named in the record.
            </DataPoint>
          </li>
          <li>
            <DataPoint as="span" name="ice.reading.warning.item4">
              No records without a usable U.S. city or coordinates.
            </DataPoint>
          </li>
        </ul>
      </div>
    </section>
  );
}
