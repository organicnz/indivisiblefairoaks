import { Music } from 'lucide-react';
import type { Metadata } from 'next';
import { ChoirAboutSection } from '@/components/choir/ChoirAboutSection';
import { ChoirArchiveSection } from '@/components/choir/ChoirArchiveSection';
import { ChoirJoinCta } from '@/components/choir/ChoirJoinCta';
import { ChoirVideoSection } from '@/components/choir/ChoirVideoSection';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { ChoirSongbookExplorer } from '@/components/ui/ChoirSongbookExplorer';
import { DataPoint } from '@/components/ui/DataPoint';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';
import { getLegacyDocuments } from '@/lib/queries/legacy';

export const metadata: Metadata = pageMetadata({
  title: 'Carmichael Resistance Choir',
  description:
    'Sing with the Carmichael Resistance Choir! Music sustains our democracy movement. Rehearsals every other Wednesday evening. All voices welcome, no audition required.',
  path: '/choir',
});

export default async function ChoirPage() {
  const [dataPoints, legacyDocuments] = await Promise.all([
    getDataPoints('choir'),
    getLegacyDocuments('choir'),
  ]);

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        icon={Music}
        eyebrow={
          <DataPoint name="choir.hero.eyebrow" initialData={dataPoints}>
            Harmonizing For Justice
          </DataPoint>
        }
        title={
          <DataPoint
            name="choir.hero.title"
            as="h1"
            initialData={dataPoints}
            className={MASTHEAD_TITLE}
          >
            The Carmichael Resistance Choir
          </DataPoint>
        }
        intro={
          <p className={`${MASTHEAD_INTRO} italic`}>
            &ldquo;
            <DataPoint name="choir.hero.quote" initialData={dataPoints}>
              Every good protest movement needs music. Music lifts us up, keeps us motivated, and
              sustains us through the long haul.
            </DataPoint>
            &rdquo;
          </p>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <ChoirAboutSection dataPoints={dataPoints} />
        <ChoirVideoSection dataPoints={dataPoints} />
        <ChoirArchiveSection legacyDocuments={legacyDocuments} />

        {/* Issue #148: the Resistance Radio box (ChoirAudioPlayer) was removed
            at the chapter's request — the anthem it opened on was the complaint.
            The component is still in `components/ui/` if the radio returns. */}

        <ChoirSongbookExplorer initialData={dataPoints} />
        <ChoirJoinCta dataPoints={dataPoints} />
      </div>
    </div>
  );
}
