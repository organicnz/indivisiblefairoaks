import { ExternalLink, Users } from 'lucide-react';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { DataPoint } from '@/components/ui/DataPoint';

type EventsTrainingsSectionProps = {
  dataPoints: Record<string, string>;
};

export function EventsTrainingsSection({ dataPoints }: EventsTrainingsSectionProps) {
  return (
    <div className="space-y-6 pt-6 border-t border-border dark:border-white/10">
          <h2 className="flex items-center gap-2 font-display text-3xl font-semibold tracking-[-0.03em]">
            <Users className="text-primary-ink dark:text-primary-on-dark-muted" />
            <DataPoint initialData={dataPoints} as="span" name="events.trainings.title">
              Trainings &amp; Action Labs
            </DataPoint>
          </h2>

          <CopyRegion id="events-trainings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 border-t border-foreground/25 pt-6">
                <DataPoint
                  initialData={dataPoints}
                  as="h3"
                  name="events.trainings.t1_title"
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  Deep Canvass Political Persuasion Training
                </DataPoint>
                <DataPoint
                  initialData={dataPoints}
                  as="p"
                  name="events.trainings.t1_desc"
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  Learn the proven art of deep canvassing: connecting with conflicted voters through
                  empathetic listening and shared values to build durable election support.
                </DataPoint>
                <DataPoint
                  initialData={dataPoints}
                  as="span"
                  name="events.trainings.t1_badge"
                  className="inline-block text-[11px] font-bold text-primary-ink dark:text-accent-gold uppercase tracking-wider"
                >
                  We The Fighters / Organizing to Fight Oligarchy
                </DataPoint>
              </div>

              <div className="space-y-3 border-t border-foreground/25 pt-6">
                <DataPoint
                  initialData={dataPoints}
                  as="h3"
                  name="events.trainings.t2_title"
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  Know Your Rights Civic Workshop
                </DataPoint>
                <DataPoint
                  initialData={dataPoints}
                  as="p"
                  name="events.trainings.t2_desc"
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  Everyone has fundamental constitutional rights under U.S. law. Learn what your
                  rights are, how to safely exercise them in public, and what to do if your rights
                  are violated.
                </DataPoint>
                <a
                  href="https://www.aclu.org/know-your-rights"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-primary-ink dark:text-primary-on-dark hover:underline inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
                >
                  <DataPoint initialData={dataPoints} as="span" name="events.trainings.t2_link">
                    ACLU Know Your Rights Guide
                  </DataPoint>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
            </div>
          </CopyRegion>
        </div>
  );
}
