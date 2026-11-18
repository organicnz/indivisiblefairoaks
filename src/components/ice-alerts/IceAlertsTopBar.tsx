import {
  HeartHandshake,
  MessageSquareText,
  Phone,
  Radio,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { ReportSightingButton } from '@/components/ice-alerts/ReportSightingDialog';
import { SurgeAlertsButton } from '@/components/ice-alerts/SurgeAlertsDialog';
import { DataPoint } from '@/components/ui/DataPoint';

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

export function IceAlertsTopBar({
  isHistory,
  dataPoints,
  children,
}: {
  isHistory: boolean;
  dataPoints: Record<string, string>;
  children?: ReactNode;
}) {
  return (
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
                <DataPoint
                  as={isHistory ? 'span' : 'h1'}
                  name="ice.header.title"
                  initialData={dataPoints}
                  className="font-display text-xl font-semibold tracking-[-0.03em]"
                >
                  ICE Alert
                </DataPoint>
                <DataPoint
                  as="span"
                  name="ice.header.tagline"
                  initialData={dataPoints}
                  className="hidden font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:inline"
                >
                  National rapid response
                </DataPoint>
              </span>
              {!isHistory ? (
                <DataPoint
                  as="span"
                  name="ice.header.descriptor"
                  initialData={dataPoints}
                  className="mt-0.5 block font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]"
                >
                  Community + official / city-level only / not 911
                </DataPoint>
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
      {children}
    </header>
  );
}
