import { CheckCircle2, Shield } from 'lucide-react';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { DataPoint } from '@/components/ui/DataPoint';

type AboutSectionProps = {
  dataPoints: Record<string, string>;
};

export function AboutMissionSection({ dataPoints }: AboutSectionProps) {
  return (
        <section className="space-y-6">
          <DataPoint
            name="about.mission.headline"
            as="h2"
            initialData={dataPoints}
            className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl"
          >
            <Shield className="text-accent dark:text-accent-gold" />
            <span>Our Mission Statement</span>
          </DataPoint>
          <CopyRegion id="about-mission">
            <div className="space-y-4 border-y border-border bg-surface-card p-6 text-base leading-relaxed text-muted-foreground sm:p-8">
              <DataPoint
                name="about.mission.intro"
                as="p"
                initialData={dataPoints}
                className="font-semibold text-foreground dark:text-white text-lg"
              >
                The mission of the Fair Oaks - Carmichael Indivisible Chapter is to cultivate a
                disciplined, non-violent grassroots movement that:
              </DataPoint>
              <ul className="space-y-3 pt-2">
                <li className="flex items-start gap-3">
                  <CheckCircle2
                    className="text-primary-ink dark:text-primary-on-dark shrink-0 mt-1"
                    size={18}
                  />
                  <span>
                    <DataPoint
                      name="about.mission.point1_title"
                      as="strong"
                      initialData={dataPoints}
                      className="text-foreground dark:text-white mr-1"
                    >
                      Stops the rise of authoritarianism:
                    </DataPoint>
                    <DataPoint name="about.mission.point1_desc" as="span" initialData={dataPoints}>
                      Holding officials accountable and sounding the alarm against anti-democratic
                      power grabs.
                    </DataPoint>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2
                    className="text-primary-ink dark:text-primary-on-dark shrink-0 mt-1"
                    size={18}
                  />
                  <span>
                    <DataPoint
                      name="about.mission.point2_title"
                      as="strong"
                      initialData={dataPoints}
                      className="text-foreground dark:text-white mr-1"
                    >
                      Supports and defends democratic norms:
                    </DataPoint>
                    <DataPoint name="about.mission.point2_desc" as="span" initialData={dataPoints}>
                      Protecting voting rights, equal representation, free press, and constitutional
                      governance.
                    </DataPoint>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2
                    className="text-primary-ink dark:text-primary-on-dark shrink-0 mt-1"
                    size={18}
                  />
                  <span>
                    <DataPoint
                      name="about.mission.point3_title"
                      as="strong"
                      initialData={dataPoints}
                      className="text-foreground dark:text-white mr-1"
                    >
                      Elects bold leaders:
                    </DataPoint>
                    <DataPoint name="about.mission.point3_desc" as="span" initialData={dataPoints}>
                      Mobilizing voters to elect public servants who champion democratic integrity
                      and progressive values.
                    </DataPoint>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2
                    className="text-primary-ink dark:text-primary-on-dark shrink-0 mt-1"
                    size={18}
                  />
                  <span>
                    <DataPoint
                      name="about.mission.point4_title"
                      as="strong"
                      initialData={dataPoints}
                      className="text-foreground dark:text-white mr-1"
                    >
                      Secures progressive policies:
                    </DataPoint>
                    <DataPoint name="about.mission.point4_desc" as="span" initialData={dataPoints}>
                      Championing economic justice, environmental stewardship, and civil rights for
                      all people.
                    </DataPoint>
                  </span>
                </li>
              </ul>
            </div>
          </CopyRegion>
        </section>
  );
}
