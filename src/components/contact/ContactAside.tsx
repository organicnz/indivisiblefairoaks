import { DataPoint } from '@/components/ui/DataPoint';

type ContactAsideProps = {
  dataPoints: Record<string, string>;
};

export function ContactAside({ dataPoints }: ContactAsideProps) {
  return (
          <aside aria-label="Direct contact and meeting details" className="border-t border-border pt-8 lg:border-l lg:border-t-0 lg:pl-8">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em]">Direct channels</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-1">
            <div className="space-y-2">
              <DataPoint
                name="contact.footer.channels_title"
                as="h3"
                initialData={dataPoints}
                className="civic-meta block"
              >
                Direct Email Channels
              </DataPoint>
              <p>
                <strong>
                  <DataPoint
                    name="contact.footer.channels_general_label"
                    as="span"
                    initialData={dataPoints}
                  >
                    General:
                  </DataPoint>
                </strong>{' '}
                <a
                  href="mailto:contact@indivisiblefairoaks.org"
                  className="text-primary-ink dark:text-primary-on-dark-muted hover:underline font-semibold"
                >
                  contact@indivisiblefairoaks.org
                </a>
              </p>
              <p>
                <strong>
                  <DataPoint
                    name="contact.footer.channels_newsletter_label"
                    as="span"
                    initialData={dataPoints}
                  >
                    Newsletter:
                  </DataPoint>
                </strong>{' '}
                <a
                  href="mailto:subscribe@indivisiblefairoaks.org"
                  className="text-primary-ink dark:text-primary-on-dark-muted hover:underline font-semibold"
                >
                  subscribe@indivisiblefairoaks.org
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <DataPoint
                name="contact.footer.gatherings_title"
                as="h3"
                initialData={dataPoints}
                className="civic-meta block"
              >
                Monthly Gatherings
              </DataPoint>
              <DataPoint name="contact.footer.gatherings_schedule" as="p" initialData={dataPoints}>
                First Tuesday of the month (6:30 – 8:00 PM)
              </DataPoint>
              <DataPoint
                name="contact.footer.gatherings_location"
                as="p"
                initialData={dataPoints}
                className="text-muted-foreground dark:text-ink-on-dark"
              >
                St. Michael&apos;s Episcopal Church, Carmichael, CA
              </DataPoint>
            </div>
          </div>
          </aside>
  );
}
