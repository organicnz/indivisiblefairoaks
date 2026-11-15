import { AlertTriangle, ArrowUpRight, Phone, ShieldCheck } from 'lucide-react';
import { DATA, formatDateLabel, formatNumber } from './data';

export function IceReadingGuide() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
      <div className="grid gap-6 border-t border-foreground/20 pt-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-10">
        <div>
          <p className="civic-section-index">How to read this map</p>
          <h2 className="mt-2 max-w-md font-display text-3xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-4xl">
            A historical record, not a live alert.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Cluster numbers and circle sizes help show where large numbers of arrest records were
            assigned. They cannot tell you what is happening now, and this should not be treated as
            a live safety feed.
          </p>
          <p className="mt-3 max-w-md font-mono text-[10px] font-bold uppercase leading-relaxed tracking-[0.1em] text-muted-foreground">
            Latest release: {formatDateLabel(DATA.meta.periodEnd)} · Checked{' '}
            {formatDateLabel(DATA.meta.releaseCheckedAt)}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {[
            {
              number: '01',
              title: 'City totals',
              body: 'Each point is the number of records whose city field matches a Census place. It is not a single incident or a street address.',
            },
            {
              number: '02',
              title: 'Clusters and circles',
              body: 'Numbers group nearby cities at overview zooms and show their combined records. Zoom in for individual city dots; larger circles mean more records assigned to that city.',
            },
            {
              number: '03',
              title: 'Known gaps',
              body: `${(DATA.meta.mappedShareOfAll * 100).toFixed(1)}% of de-duplicated records are mapped. The city field is manually entered, sometimes missing, and may reflect a facility or booking location.`,
            },
          ].map((step) => (
            <div key={step.number} className="border-t border-foreground/25 pt-3">
              <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-accent">
                {step.number}
              </span>
              <h3 className="mt-2 font-display text-xl font-semibold tracking-[-0.02em]">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-3">
        <div className="flex items-start gap-3 bg-surface-muted p-4 sm:p-5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">
              De-duplicated
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              The snapshot removes {formatNumber(DATA.meta.duplicateRowsRemoved)} duplicate rows
              flagged in the processed release before counting.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-surface-muted p-4 sm:p-5">
          <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">
              Source-linked
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              The dataset is CC0 and the page links to the Deportation Data Project&apos;s
              processed release and citation.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-surface-muted p-4 sm:p-5">
          <Phone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">
              Not an emergency service
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              The map cannot dispatch help. In an emergency, call 911. Do not approach or confront
              enforcement activity.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 border-l-2 border-accent bg-accent/5 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-display text-xl font-semibold tracking-[-0.02em]">
          <AlertTriangle className="size-4 text-accent" aria-hidden="true" />
          What this map does not show
        </h3>
        <ul className="mt-2 grid gap-1.5 text-sm leading-relaxed text-muted-foreground sm:grid-cols-2">
          <li>No live reports, current enforcement locations, or street-level events.</li>
          <li>No names, faces, plate numbers, or immigration status.</li>
          <li>No claim that every arrest happened in the city named in the record.</li>
          <li>No records without a usable U.S. city or coordinates.</li>
        </ul>
      </div>
    </section>
  );
}
