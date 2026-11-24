import { Users } from 'lucide-react';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { DataPoint } from '@/components/ui/DataPoint';

type AboutSectionProps = {
  dataPoints: Record<string, string>;
};

export function AboutWhoSection({ dataPoints }: AboutSectionProps) {
  return (
    <section className="space-y-6">
      <DataPoint
        name="about.who.headline"
        as="h2"
        initialData={dataPoints}
        className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl"
      >
        <Users className="text-primary-ink dark:text-primary-on-dark-muted" aria-hidden="true" />
        <span>Who We Are</span>
      </DataPoint>
      <CopyRegion id="about-who">
        <div className="civic-prose space-y-4">
          <DataPoint name="about.who.p1" as="p" initialData={dataPoints}>
            We are neighbors, retirees, workers, students, educators, and community members in
            Sacramento County who believe that true democracy requires active, ongoing
            participation. As an affiliated chapter of the national Indivisible network, we apply
            national organizing strategies locally where our voices have the greatest impact.
          </DataPoint>
          <DataPoint name="about.who.p2" as="p" initialData={dataPoints}>
            Our monthly gatherings provide a welcoming space for dialogue, education, and
            coordinated action.
          </DataPoint>
        </div>
      </CopyRegion>
    </section>
  );
}
