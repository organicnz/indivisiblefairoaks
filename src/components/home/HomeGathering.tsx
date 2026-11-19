import { CalendarDays, MapPin, Soup } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import type { GatheringCard } from '@/lib/civic-events';

export function HomeGathering({
  card,
  dataPoints,
}: {
  card: GatheringCard;
  dataPoints: Record<string, string>;
}) {
  return (
    <section aria-labelledby="next-gathering-title" className="border-b border-border bg-background py-8 md:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden border border-border border-l-4 border-l-accent bg-surface-card md:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="min-w-0 px-5 py-5 md:px-7 md:py-6">
            <div className="civic-stamp border-accent text-accent">
              <CalendarDays size={11} aria-hidden="true" />
              <DataPoint as="span" name="home.gathering.badge" initialData={dataPoints}>
                Next Community Gathering
              </DataPoint>
            </div>
            <h2
              id="next-gathering-title"
              className="mt-2 max-w-[24ch] text-pretty font-display text-2xl font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-3xl"
            >
              {card.title}
            </h2>
            <div className="mt-3 space-y-2 text-sm leading-snug text-muted-foreground">
              <div className="flex items-start gap-1.5">
                <CalendarDays size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                <span className="min-w-0 break-words">{card.dateLine}</span>
              </div>
              <div className="flex items-start gap-1.5">
                <MapPin size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                <span className="min-w-0 break-words">{card.locationLine}</span>
              </div>
            </div>
            {card.isScheduled ? (
              <p className="mt-4 flex items-start gap-1.5 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                <Soup size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                <span>
                  <strong className="text-foreground">
                    <DataPoint name="home.gathering.food_bank_label" initialData={dataPoints}>
                      Food Bank Drive:
                    </DataPoint>
                  </strong>{' '}
                  <DataPoint name="home.gathering.food_bank" initialData={dataPoints}>
                    Please bring a can or box of non-perishable food to support our local community
                    food pantry.
                  </DataPoint>
                </span>
              </p>
            ) : (
              <p className="mt-4 flex items-start gap-1.5 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                <CalendarDays size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                <span>
                  No future chapter meeting is scheduled yet.{' '}
                  <a
                    href="mailto:contact@indivisiblefairoaks.org?subject=Next%20chapter%20meeting"
                    className="font-semibold text-primary-ink underline decoration-primary/40 underline-offset-4 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
                  >
                    Ask the chapter
                  </a>{' '}
                  for the next date.
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-col justify-center gap-2 border-t border-border px-5 py-5 md:border-l md:border-dashed md:border-t-0 md:px-5">
            {card.calendarUrl ? (
              <a
                href={card.calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center border border-foreground/30 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <DataPoint as="span" name="home.gathering.btn_cal" initialData={dataPoints}>
                  + Add to Calendar
                </DataPoint>
              </a>
            ) : null}
            <a
              href={card.rsvpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center bg-accent-gold px-5 py-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-ink-strong transition-all duration-300 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <DataPoint as="span" name="home.gathering.btn_rsvp" initialData={dataPoints}>
                {card.isScheduled ? 'RSVP via Mobilize' : 'Ask about the next meeting'}
              </DataPoint>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
