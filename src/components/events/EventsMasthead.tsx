import { Calendar } from 'lucide-react';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';

type EventsMastheadProps = {
  dataPoints: Record<string, string>;
};

export function EventsMasthead({ dataPoints }: EventsMastheadProps) {
  return (
      <PageMasthead
        icon={Calendar}
        eyebrow={
          <DataPoint initialData={dataPoints} name="events.hero.eyebrow">
            Community Actions & Calendar
          </DataPoint>
        }
        title={
          <DataPoint
            initialData={dataPoints}
            name="events.hero.headline"
            as="h1"
            className={MASTHEAD_TITLE}
          >
            Upcoming Events & Mobilizations
          </DataPoint>
        }
        intro={
          <DataPoint
            initialData={dataPoints}
            name="events.hero.intro"
            as="p"
            className={MASTHEAD_INTRO}
          >
            Find out when and where our chapter is gathering. All community members committed to
            peaceful, democratic activism are warmly welcome.
          </DataPoint>
        }
      />
  );
}
