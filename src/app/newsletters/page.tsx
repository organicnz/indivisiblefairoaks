import type { Metadata } from 'next';
import { LegacyNewslettersSection } from '@/components/newsletters/LegacyNewslettersSection';
import { NeighboringChaptersSection } from '@/components/newsletters/NeighboringChaptersSection';
import { NewsletterArchiveSection } from '@/components/newsletters/NewsletterArchiveSection';
import { NewslettersMasthead } from '@/components/newsletters/NewslettersMasthead';
import { ActionAlertsSubscription } from '@/components/ui/ActionAlertsSubscription';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints, getNewsletters } from '@/lib/queries/civic';
import { getLegacyDocuments } from '@/lib/queries/legacy';

export const metadata: Metadata = pageMetadata({
  title: 'Newsletters & Bulletins',
  description:
    'Browse current and past Indivisible Fair Oaks-Carmichael bulletins, monthly newsletters, and the legacy newsletter PDF archive.',
  path: '/newsletters',
});

export default async function NewslettersPage() {
  const [newslettersRows, dataPoints, legacyNewsletters] = await Promise.all([
    getNewsletters().catch(() => []),
    getDataPoints('news'),
    getLegacyDocuments('newsletter'),
  ]);

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <NewslettersMasthead dataPoints={dataPoints} />

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-16 sm:px-6 lg:px-8">
        <NewsletterArchiveSection newsletters={newslettersRows} dataPoints={dataPoints} />
        <ActionAlertsSubscription initialData={dataPoints} />
        <NeighboringChaptersSection />
        <LegacyNewslettersSection documents={legacyNewsletters} />
      </div>
    </div>
  );
}
