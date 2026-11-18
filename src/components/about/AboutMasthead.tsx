import { Users } from 'lucide-react';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';

type AboutMastheadProps = {
  dataPoints: Record<string, string>;
};

export function AboutMasthead({ dataPoints }: AboutMastheadProps) {
  return (
      <PageMasthead
        icon={Users}
        eyebrow={
          <DataPoint name="about.hero.eyebrow" initialData={dataPoints}>
            Grassroots Democracy In Action
          </DataPoint>
        }
        title={
          <DataPoint
            name="about.hero.headline"
            as="h1"
            initialData={dataPoints}
            className={MASTHEAD_TITLE}
          >
            About Indivisible Fair Oaks-Carmichael
          </DataPoint>
        }
        intro={
          <DataPoint
            name="about.hero.subhead"
            as="p"
            initialData={dataPoints}
            className={MASTHEAD_INTRO}
          >
            We are a local grassroots chapter representing residents in and near Fair Oaks and
            Carmichael, California, dedicated to protecting our democracy through peaceful civic
            power.
          </DataPoint>
        }
      />
  );
}
