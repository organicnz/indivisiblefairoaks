import type { Metadata } from 'next';
import { NationalResources } from '@/components/news/NationalResources';
import { NewslettersCallout } from '@/components/news/NewslettersCallout';
import { NewsMasthead } from '@/components/news/NewsMasthead';
import { ActionAlertsSubscription } from '@/components/ui/ActionAlertsSubscription';
import { InteractivePostsList } from '@/components/ui/InteractivePostsList';
import { MeetingMaterials } from '@/components/ui/MeetingMaterials';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';
import { getPublishedPosts } from '@/lib/queries/content';

export const metadata: Metadata = pageMetadata({
  title: 'News & Chapter Updates',
  description:
    'Read the latest chapter news, reports, and dispatches, then find meeting materials, bulletins, and ways to stay involved across Sacramento County.',
  path: '/news',
});

export default async function NewsPage() {
  const [postsRows, dataPoints] = await Promise.all([
    getPublishedPosts().catch(() => []),
    getDataPoints('news'),
  ]);

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <NewsMasthead />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        {/* News leads the page. Everything below is supporting chapter material. */}
        <InteractivePostsList initialPosts={postsRows} />

        {/* Newsletter archive lives on its own page; keep one clear route to it. */}
        <NewslettersCallout />

        {/* Meeting Reviews, Minutes & Printable Handouts */}
        <MeetingMaterials />

        {/* Interactive Action Alerts Subscription */}
        <ActionAlertsSubscription initialData={dataPoints} />

        {/* National Indivisible Wire */}
        <NationalResources dataPoints={dataPoints} />
      </div>
    </div>
  );
}
