import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Coffee,
  Mail,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import {
  GATHERING_RSVP_HREF,
  QUICK_HITS,
  WORKGROUP_SIGNUP_HREF,
  type QuickHitId,
} from '@/config/quick-hits';

const QUICK_HIT_ICONS: Record<QuickHitId, LucideIcon> = {
  gatherings: UsersRound,
  coffee: Coffee,
  postcards: Mail,
  calendar: CalendarDays,
};

export function HomeQuickHits({ dataPoints }: { dataPoints: Record<string, string> }) {
  return (
    <section
      id="quick-hits"
      aria-labelledby="quick-hits-title"
      className="scroll-mt-24 border-b border-border bg-surface-muted text-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-10 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] lg:items-end lg:gap-10">
          <div className="min-w-0">
            <div className="civic-kicker">
              <Zap size={13} aria-hidden="true" />
              <DataPoint
                as="span"
                name="home.quick_hits.eyebrow"
                initialData={dataPoints}
              >
                Quick hits
              </DataPoint>
            </div>
            <DataPoint
              as="h2"
              id="quick-hits-title"
              name="home.quick_hits.headline"
              initialData={dataPoints}
              className="mt-4 max-w-[16ch] text-pretty font-display text-3xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-4xl"
            >
              Go straight to the work.
            </DataPoint>
            <DataPoint
              as="p"
              name="home.quick_hits.intro"
              initialData={dataPoints}
              className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground"
            >
              Monthly dates, Coffee Klatches, postcarding, and every chapter action are one click
              away.
            </DataPoint>
          </div>

          <nav aria-label="Quick hits" className="min-w-0">
            <ul className="grid gap-px border border-border bg-border sm:grid-cols-2">
              {QUICK_HITS.map((item) => {
                const Icon = QUICK_HIT_ICONS[item.id];
                return (
                  <li key={item.id} className="min-w-0">
                    <Link
                      href={item.href}
                      className="group flex min-h-28 h-full flex-col justify-between gap-4 bg-surface-card p-4 transition-colors duration-300 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:p-5"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center border border-foreground/20 bg-background transition-colors duration-300 group-hover:border-primary/40">
                          <Icon
                            size={17}
                            strokeWidth={1.5}
                            className="text-primary-ink"
                            aria-hidden="true"
                          />
                        </span>
                        <ArrowUpRight
                          size={15}
                          aria-hidden="true"
                          className="mt-1 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary-ink motion-reduce:transform-none"
                        />
                      </span>
                      <span>
                        <DataPoint
                          as="span"
                          name={item.labelName}
                          initialData={dataPoints}
                          className="block font-display text-lg font-semibold leading-snug tracking-[-0.02em] text-foreground"
                        >
                          {item.label}
                        </DataPoint>
                        <DataPoint
                          as="span"
                          name={item.detailName}
                          initialData={dataPoints}
                          className="mt-1 block text-xs leading-relaxed text-muted-foreground"
                        >
                          {item.detail}
                        </DataPoint>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-foreground/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <DataPoint
            as="p"
            name="home.quick_hits.signup_note"
            initialData={dataPoints}
            className="max-w-xl text-xs leading-relaxed text-muted-foreground"
          >
            Ready to do more than show up? RSVP for a gathering or tell us which workgroup fits.
          </DataPoint>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href={GATHERING_RSVP_HREF}
              className="inline-flex min-h-11 items-center gap-2 border border-primary bg-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:border-primary-dark hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted"
            >
              <DataPoint as="span" name="home.quick_hits.rsvp_btn" initialData={dataPoints}>
                RSVP for a gathering
              </DataPoint>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link
              href={WORKGROUP_SIGNUP_HREF}
              className="inline-flex min-h-11 items-center gap-2 border-b border-foreground/30 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted"
            >
              <DataPoint as="span" name="home.quick_hits.workgroup_btn" initialData={dataPoints}>
                Join a workgroup
              </DataPoint>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
