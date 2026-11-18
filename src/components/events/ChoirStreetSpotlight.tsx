import { Music } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';

type ChoirStreetSpotlightProps = {
  dataPoints: Record<string, string>;
};

export function ChoirStreetSpotlight({ dataPoints }: ChoirStreetSpotlightProps) {
  return (
        <div className="flex flex-col items-start justify-between gap-6 border-y border-border bg-surface-card p-6 sm:p-8 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-card flex items-center justify-center text-accent dark:text-accent-gold shrink-0 mt-1 border border-border dark:border-white/10 shadow-xs">
              <Music size={24} />
            </div>
            <div>
              <div className="civic-stamp mb-2">
                <DataPoint initialData={dataPoints} as="span" name="events.spotlight.eyebrow">
                  Ongoing Community Action
                </DataPoint>
              </div>
              <DataPoint
                initialData={dataPoints}
                as="h2"
                name="events.spotlight.title"
                className="font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl"
              >
                Carmichael Resistance Choir: Street Corner Singing Protest
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                as="p"
                name="events.spotlight.schedule"
                className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark mt-1 font-medium"
              >
                Every Saturday Afternoon • 3:00 PM – 4:30 PM • Corner of Fair Oaks Blvd &amp;
                Manzanita Ave, Carmichael, CA
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                as="p"
                name="events.spotlight.desc"
                className="text-xs text-muted-foreground dark:text-ink-muted-on-dark mt-2 leading-relaxed max-w-2xl"
              >
                We sing our protest to afternoon traffic and community patrons. Bring your signs,
                lawn chairs, and voices to stand up for democracy! No singing experience required —
                all community members are warmly welcomed.
              </DataPoint>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
            <Link
              href="/choir"
              className="inline-flex min-h-11 w-full items-center justify-center border border-foreground/30 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink sm:w-auto"
            >
              <DataPoint initialData={dataPoints} as="span" name="events.spotlight.btn_songbook">
                Explore Songbook
              </DataPoint>
            </Link>
            <a
              href="https://www.mobilize.us/indivisible/event/1011420/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center border border-primary bg-primary px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark sm:w-auto"
            >
              <DataPoint initialData={dataPoints} as="span" name="events.spotlight.btn_protest">
                Join Next Protest
              </DataPoint>
            </a>
          </div>
        </div>
  );
}
