import { Mail } from 'lucide-react';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';

type ContactMastheadProps = {
  dataPoints: Record<string, string>;
};

export function ContactMasthead({ dataPoints }: ContactMastheadProps) {
  return (
      <PageMasthead
        icon={Mail}
        eyebrow={
          <DataPoint as="span" name="contact.hero.eyebrow" initialData={dataPoints}>
            Connect With Organizers
          </DataPoint>
        }
        title={
          <DataPoint
            name="contact.hero.title"
            as="h1"
            initialData={dataPoints}
            className={MASTHEAD_TITLE}
          >
            Contact Indivisible Fair Oaks-Carmichael
          </DataPoint>
        }
        intro={
          <DataPoint
            name="contact.hero.intro"
            as="p"
            initialData={dataPoints}
            className={MASTHEAD_INTRO}
          >
            Have a question, want to volunteer, or suggest an action in our community? We’d love to
            hear from you.
          </DataPoint>
        }
      />
  );
}
