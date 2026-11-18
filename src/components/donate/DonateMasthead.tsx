import { Heart } from 'lucide-react';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';

type DonateMastheadProps = {
  dataPoints: Record<string, string>;
};

export function DonateMasthead({ dataPoints }: DonateMastheadProps) {
  return (
      <PageMasthead
        icon={Heart}
        eyebrow={
          <DataPoint name="donate.hero.eyebrow" initialData={dataPoints}>
            100% Grassroots Funded
          </DataPoint>
        }
        title={
          <DataPoint
            name="donate.hero.title"
            as="h1"
            initialData={dataPoints}
            className={MASTHEAD_TITLE}
          >
            Fuel The Fair Oaks - Carmichael Resistance
          </DataPoint>
        }
        intro={
          <DataPoint
            name="donate.hero.intro"
            as="p"
            initialData={dataPoints}
            className={MASTHEAD_INTRO}
          >
            We don't take corporate PAC money. Our work is powered entirely by neighbors like you
            who pitch in to defend democracy right here in Sacramento County.
          </DataPoint>
        }
      />
  );
}
