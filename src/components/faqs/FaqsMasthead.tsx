import { HelpCircle } from 'lucide-react';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';

type FaqsMastheadProps = {
  dataPoints: Record<string, string>;
};

export function FaqsMasthead({ dataPoints }: FaqsMastheadProps) {
  return (
      <PageMasthead
        icon={HelpCircle}
        eyebrow={
          <DataPoint initialData={dataPoints} name="faqs.hero.eyebrow">
            Frequently Asked Questions
          </DataPoint>
        }
        title={
          <DataPoint
            initialData={dataPoints}
            name="faqs.hero.headline"
            as="h1"
            className={MASTHEAD_TITLE}
          >
            Frequently Asked Questions
          </DataPoint>
        }
        intro={
          <DataPoint
            initialData={dataPoints}
            name="faqs.hero.intro"
            as="p"
            className={MASTHEAD_INTRO}
          >
            Have questions about attending a meeting, singing with the choir, or getting involved?
            Find quick answers below.
          </DataPoint>
        }
      />
  );
}
