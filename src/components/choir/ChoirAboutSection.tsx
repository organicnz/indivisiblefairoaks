import { Calendar, CheckCircle2, Clock, ExternalLink, MapPin } from 'lucide-react';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { DataPoint } from '@/components/ui/DataPoint';

type ChoirAboutSectionProps = {
  dataPoints: Record<string, string>;
};

export function ChoirAboutSection({ dataPoints }: ChoirAboutSectionProps) {
  return (
    <>
        {/* About the Choir */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <DataPoint
              name="choir.about.title"
              as="h2"
              initialData={dataPoints}
              className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl"
            >
              Lifting Our Voices in Solidarity
            </DataPoint>
            <div className="text-muted-foreground dark:text-ink-on-dark space-y-4 text-sm sm:text-base leading-relaxed">
              <DataPoint name="choir.about.p1" as="p" initialData={dataPoints}>
                The Carmichael Resistance Choir brings people together through the power of
                collective song. Rooted in the rich tradition of American civil rights, labor, and
                anti-war movements, our choir provides a joyful, defiant, and creative outlet for
                community resistance.
              </DataPoint>
              <DataPoint name="choir.about.p2" as="p" initialData={dataPoints}>
                We perform at rallies, street corner singing protests (such as the intersection of
                Fair Oaks Blvd & Manzanita Ave), marches, and community meetings throughout the
                greater Sacramento region.
              </DataPoint>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-start gap-3 border-t border-foreground/25 pt-4">
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-primary-ink"
                  size={18}
                />
                <div>
                  <DataPoint
                    name="choir.about.no_audition_title"
                    as="span"
                    initialData={dataPoints}
                    className="font-bold text-foreground dark:text-white text-sm block"
                  >
                    No Auditions
                  </DataPoint>
                  <DataPoint
                    name="choir.about.no_audition_desc"
                    as="span"
                    initialData={dataPoints}
                    className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
                  >
                    All skill levels and vocal ranges welcome.
                  </DataPoint>
                </div>
              </div>
              <div className="flex items-start gap-3 border-t border-foreground/25 pt-4">
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-primary-ink"
                  size={18}
                />
                <div>
                  <DataPoint
                    name="choir.about.free_title"
                    as="span"
                    initialData={dataPoints}
                    className="font-bold text-foreground dark:text-white text-sm block"
                  >
                    100% Free
                  </DataPoint>
                  <DataPoint
                    name="choir.about.free_desc"
                    as="span"
                    initialData={dataPoints}
                    className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
                  >
                    No membership dues or fees ever required.
                  </DataPoint>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="space-y-6 border-y border-border bg-surface-card p-6">
              <div className="flex items-center gap-3">
                <Calendar className="text-accent dark:text-accent-gold" size={24} />
                <DataPoint
                  name="choir.schedule.headline"
                  as="h3"
                  initialData={dataPoints}
                  className="text-xl font-bold text-foreground dark:text-white"
                >
                  Rehearsal Schedule & Guidelines
                </DataPoint>
              </div>

              <div className="space-y-4 text-sm text-muted-foreground dark:text-ink-on-dark">
                <CopyRegion id="choir-schedule">
                  <div className="flex items-start gap-3">
                    <Clock
                      className="text-primary-ink dark:text-primary-on-dark-muted shrink-0 mt-0.5"
                      size={18}
                    />
                    <div>
                      <DataPoint
                        name="choir.schedule.time"
                        as="strong"
                        initialData={dataPoints}
                        className="text-foreground dark:text-white block"
                      >
                        Every Other Wednesday
                      </DataPoint>
                      <DataPoint
                        name="choir.schedule.time_sub"
                        as="span"
                        initialData={dataPoints}
                        className="text-xs text-muted-foreground dark:text-ink-muted-on-dark block"
                      >
                        6:30 PM – 8:00 PM
                      </DataPoint>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin
                      className="text-primary-ink dark:text-primary-on-dark-muted shrink-0 mt-0.5"
                      size={18}
                    />
                    <div>
                      <DataPoint
                        name="choir.schedule.location"
                        as="strong"
                        initialData={dataPoints}
                        className="text-foreground dark:text-white block"
                      >
                        St. Michael's Episcopal Church
                      </DataPoint>
                      <DataPoint
                        name="choir.schedule.location_sub"
                        as="span"
                        initialData={dataPoints}
                        className="text-xs text-muted-foreground dark:text-ink-muted-on-dark block"
                      >
                        Exact address and parking instructions provided upon registration.
                      </DataPoint>
                    </div>
                  </div>
                </CopyRegion>
              </div>

              <div className="pt-2">
                <a
                  href="https://www.mobilize.us/indivisible/event/1072857/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 w-full items-center justify-center gap-2 border border-accent-gold bg-accent-gold py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-strong transition-colors hover:brightness-95"
                >
                  <span>Register for Next Rehearsal</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>
    </>
  );
}
