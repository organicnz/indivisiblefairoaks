import { Vote } from 'lucide-react';
import type { Metadata } from 'next';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { MASTHEAD_INTRO, MASTHEAD_TITLE, PageMasthead } from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';
import { SacramentoRepresentativeFinder } from '@/components/ui/SacramentoRepresentativeFinder';
import { VoterActionCards } from '@/components/voter-info/VoterActionCards';
import { VoterGuidesSection } from '@/components/voter-info/VoterGuidesSection';
import { VoterHotlinesSection } from '@/components/voter-info/VoterHotlinesSection';
import { VoterSectionNav } from '@/components/voter-info/VoterSectionNav';
import { VOTER_INFO_DATA_POINT_KEYS } from '@/components/voter-info/voter-info-data-points';
import { pageMetadata } from '@/lib/metadata';
import { getDataPointsForKeys } from '@/lib/queries/civic';
import {
  getLegacyDocuments,
  legacyDocumentForDriveId,
  legacyDocumentUrl,
} from '@/lib/queries/legacy';

export const metadata: Metadata = pageMetadata({
  title: 'Voter Information & Guides',
  description:
    'Comprehensive voter resources for Fair Oaks, Carmichael, and Sacramento County. Pre-registration for youth, rights restoration, elected officials directory, and ballot tracking.',
  path: '/voter-info',
});

export default async function VoterInfoPage() {
  // Only the keys this page renders. Reading the whole `voter` group would
  // serialize the 2026 guide copy that now lives on /archive into this page's
  // RSC payload on every visit.
  const [dataPoints, legacyDocuments] = await Promise.all([
    getDataPointsForKeys(VOTER_INFO_DATA_POINT_KEYS),
    getLegacyDocuments('voter'),
  ]);
  const legacyHref = (driveId: string, fallback: string) => {
    const document = legacyDocumentForDriveId(legacyDocuments, driveId);
    return document ? (legacyDocumentUrl(document) ?? fallback) : fallback;
  };

  return (
    <div className="civic-page min-h-screen w-full bg-background pb-20 pt-(--header-clearance) text-foreground">
      <PageMasthead
        icon={Vote}
        eyebrow={
          <DataPoint initialData={dataPoints} name="voter.hero.eyebrow">
            Sacramento County Voter Center
          </DataPoint>
        }
        title={
          <DataPoint
            initialData={dataPoints}
            as="h1"
            name="voter.hero.title"
            className={MASTHEAD_TITLE}
          >
            Voter Information &amp; Guides
          </DataPoint>
        }
        intro={
          <DataPoint
            initialData={dataPoints}
            as="p"
            name="voter.hero.intro"
            className={MASTHEAD_INTRO}
          >
            Your vote is your voice and your power. Explore official guides, check your registration
            status, and know your rights as a California voter.
          </DataPoint>
        }
      />

      <VoterSectionNav />

      <div className="mx-auto max-w-5xl space-y-16 px-4 py-16 sm:px-6 lg:px-8">
        <VoterActionCards dataPoints={dataPoints} />

        <div id="representatives" className="scroll-mt-28">
          <SacramentoRepresentativeFinder initialData={dataPoints} />
        </div>

        <CopyRegion id="voter-guides">
          <VoterGuidesSection dataPoints={dataPoints} legacyHref={legacyHref} />
        </CopyRegion>
        <VoterHotlinesSection dataPoints={dataPoints} />
      </div>
    </div>
  );
}
