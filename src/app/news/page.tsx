import { Megaphone, Newspaper } from 'lucide-react';
import type { Metadata } from 'next';
import { LegacyDocumentArchive } from '@/components/archive/LegacyDocumentArchive';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { ActionAlertsSubscription } from '@/components/ui/ActionAlertsSubscription';
import { DataPoint } from '@/components/ui/DataPoint';
import { InteractiveNewslettersList } from '@/components/ui/InteractiveNewslettersList';
import { InteractivePostsList } from '@/components/ui/InteractivePostsList';
import { MeetingMaterials } from '@/components/ui/MeetingMaterials';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints, getNewsletters } from '@/lib/queries/civic';
import { getLegacyDocuments } from '@/lib/queries/legacy';
import { getPublishedPosts } from '@/lib/queries/content';

export const metadata: Metadata = pageMetadata({
  title: 'Newsletters, Meeting Materials & Bulletins',
  description:
    'Read past chapter newsletters, access printable meeting handouts and minutes, stay informed about Sacramento County grassroots organizing, and subscribe to action alerts.',
  path: '/news',
});

export default async function NewsPage() {
  const [newslettersRows, postsRows, dataPoints, legacyNewsletters] = await Promise.all([
    getNewsletters().catch(() => []),
    getPublishedPosts(12).catch(() => []),
    getDataPoints('news'),
    getLegacyDocuments('newsletter'),
  ]);
  const initialNewsletters = newslettersRows.length > 0 ? newslettersRows : undefined;
  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        icon={Newspaper}
        eyebrow={
          <DataPoint initialData={dataPoints} name="news.hero.eyebrow">
            Chapter Bulletins, Minutes &amp; Handouts
          </DataPoint>
        }
        title={
          <DataPoint
            initialData={dataPoints}
            name="news.hero.headline"
            as="h1"
            className={MASTHEAD_TITLE}
          >
            Newsletters &amp; Chapter Updates
          </DataPoint>
        }
        intro={
          <DataPoint
            initialData={dataPoints}
            name="news.hero.intro"
            as="p"
            className={MASTHEAD_INTRO}
          >
            Stay up to date with our grassroots organizing, chapter meeting minutes, printable
            handouts, and Christiana&apos;s regular email news blasts across Fair Oaks, Carmichael, and
            Sacramento County.
          </DataPoint>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Interactive Action Alerts Subscription */}
        <ActionAlertsSubscription initialData={dataPoints} />

        {/* Meeting Reviews, Minutes & Printable Handouts */}
        <MeetingMaterials />

        {/* Chapter Articles & Dispatches */}
        <InteractivePostsList initialPosts={postsRows} />

        {/* Bulletins & News Blast Archive with In-Page Visual CRUD */}
        <div className="space-y-6">
          <h2 className="flex items-center gap-2 font-display text-3xl font-semibold tracking-[-0.03em]">
            <span className="text-primary-ink dark:text-primary-on-dark-muted font-mono text-xl">
              ✦
            </span>
            <DataPoint initialData={dataPoints} as="span" name="news.archive.title">
              Chapter News Blasts &amp; Bulletin Archive
            </DataPoint>
          </h2>

          <InteractiveNewslettersList
            initialNewsletters={initialNewsletters}
            initialData={dataPoints}
          />
        </div>

        {legacyNewsletters.length > 0 ? (
          <div className="pt-4 border-t border-border">
            <LegacyDocumentArchive
              documents={legacyNewsletters}
              title="Legacy newsletter PDFs"
              description="The original newsletter files from the chapter’s Google Sites. Each entry identifies whether the file is hosted here or points to its original source."
              limit={8}
            />
          </div>
        ) : null}

        {/* National Indivisible Wire */}
        <div className="space-y-4 border-y border-border bg-surface-card p-8">
          <div className="flex items-center gap-3">
            <Megaphone className="text-accent-gold" size={22} />
            <DataPoint
              initialData={dataPoints}
              as="h2"
              name="news.national.title"
              className="font-display text-2xl font-semibold tracking-[-0.03em]"
            >
              National Indivisible Resources
            </DataPoint>
          </div>
          <DataPoint
            initialData={dataPoints}
            as="p"
            name="news.national.desc"
            className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed"
          >
            Indivisible Fair Oaks-Carmichael is one of thousands of grassroots groups nationwide
            following the proven guide created by former congressional staffers. For nationwide
            campaigns, toolkits, and legislative tracking, visit the national network at{' '}
            <a
              href="https://indivisible.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-ink dark:text-primary-on-dark-muted hover:underline font-semibold"
            >
              indivisible.org
            </a>
            .
          </DataPoint>
        </div>
      </div>
    </div>
  );
}
