import { Handshake } from 'lucide-react';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';

type PartnersMastheadProps = {
  dataPoints: Record<string, string>;
};

export function PartnersMasthead({ dataPoints }: PartnersMastheadProps) {
  return (
      <PageMasthead
        icon={Handshake}
        eyebrow={
          <DataPoint initialData={dataPoints} name="partners.hero.eyebrow">
            Grassroots Coalition Network
          </DataPoint>
        }
        title={
          <DataPoint
            initialData={dataPoints}
            name="partners.hero.headline"
            as="h1"
            className={MASTHEAD_TITLE}
          >
            Our Coalition Partners & Allies
          </DataPoint>
        }
        intro={
          <DataPoint
            initialData={dataPoints}
            name="partners.hero.intro"
            as="p"
            className={MASTHEAD_INTRO}
          >
            We believe democracy is a team sport. Indivisible Fair Oaks-Carmichael works in close
            partnership with national organizations, California coalitions, and Sacramento community
            advocates.
          </DataPoint>
        }
      />
  );
}
