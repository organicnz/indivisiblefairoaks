import { Heart } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';

type AboutSectionProps = {
  dataPoints: Record<string, string>;
};

export function AboutFoodDriveSection({ dataPoints }: AboutSectionProps) {
  return (
        <section className="space-y-4">
          <DataPoint
            name="about.foodbank.headline"
            as="h2"
            initialData={dataPoints}
            className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl"
          >
            <Heart className="text-accent-red" />
            <span>Community Care & Food Drives</span>
          </DataPoint>
          <DataPoint
            name="about.foodbank.body"
            as="p"
            initialData={dataPoints}
            className="civic-prose"
          >
            We believe that civic justice begins with community care. At every in-person monthly
            gathering, our members bring non-perishable canned goods and staple foods to donate to
            local Carmichael and Fair Oaks food pantries.
          </DataPoint>
        </section>
  );
}
