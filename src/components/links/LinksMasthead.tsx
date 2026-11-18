import { Compass } from 'lucide-react';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';

type LinksMastheadProps = {
  dataPoints: Record<string, string>;
};

export function LinksMasthead({ dataPoints }: LinksMastheadProps) {
  return (
      <PageMasthead
        icon={Compass}
        eyebrow={
          <DataPoint name="links.hero.eyebrow" initialData={dataPoints}>
            Link Tree &amp; Civic Directory
          </DataPoint>
        }
        title={
          <DataPoint
            name="links.hero.headline"
            as="h1"
            initialData={dataPoints}
            className={MASTHEAD_TITLE}
          >
            Link Tree &amp; Coalition Directory
          </DataPoint>
        }
        intro={
          <DataPoint
            name="links.hero.intro"
            as="p"
            initialData={dataPoints}
            className={MASTHEAD_INTRO}
          >
            Essential chapter quick-access links, nonpartisan voter tools, grassroots allies, and democracy defense
            resources vetted by our chapter.
          </DataPoint>
        }
      />
  );
}
