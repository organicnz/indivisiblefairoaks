import 'leaflet/dist/leaflet.css';

import { Phone, Siren } from 'lucide-react';
import type { Metadata } from 'next';
import { IceAlertDemo } from '@/components/ice-alerts/IceAlertDemo';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'ICE Activity Alerts — Nationwide Concept Demo',
  description:
    'A concept for a community-reported ICE activity map that opens on the broader Sacramento region and supports preview reports anywhere in the U.S. Sample data only; this demo does not collect or publish reports.',
  path: '/ice-alerts',
  robots: { index: false, follow: false },
});

export default function IceAlertsDemoPage() {
  return (
    <div className="civic-page min-h-screen w-full bg-background text-foreground">
      <header className="border-b border-border pt-(--header-clearance)">
        <div className="mx-auto max-w-7xl px-4 pb-8 pt-7 sm:px-6 sm:pb-10 sm:pt-9 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center border border-accent/40 bg-accent/10">
                <Siren className="size-5 text-accent" aria-hidden="true" />
              </span>
              <p className="civic-kicker">Concept demo / Nationwide community rapid response</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="civic-stamp">Sample data only</span>
              <span className="civic-stamp">No reports collected</span>
            </div>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
            <div className="min-w-0">
              <h1 className="max-w-4xl font-display text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">
                ICE activity alerts
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                A proposed, safety-first map for community-reported immigration enforcement
                activity. It opens on the broader Sacramento region, while anyone can preview a
                report anywhere in the United States. This is a design concept for early feedback
                &mdash; not a live alert service.
              </p>
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
                Do not approach, confront, or film enforcement activity. This map cannot dispatch
                help.
              </p>
            </div>
          </div>
        </div>
      </header>

      <IceAlertDemo />
    </div>
  );
}
