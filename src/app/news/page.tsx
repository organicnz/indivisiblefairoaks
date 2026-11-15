import { ArrowRight, Mail, Megaphone, Newspaper } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { ActionAlertsSubscription } from '@/components/ui/ActionAlertsSubscription';
import { DataPoint } from '@/components/ui/DataPoint';
import { InteractivePostsList } from '@/components/ui/InteractivePostsList';
import { MeetingMaterials } from '@/components/ui/MeetingMaterials';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';
import { getPublishedPosts } from '@/lib/queries/content';

export const metadata: Metadata = pageMetadata({
  title: 'News, Meeting Materials & Chapter Updates',
  description:
    'Read chapter articles and dispatches, access printable meeting handouts and minutes, and stay informed about Sacramento County grassroots organizing.',
  path: '/news',
});

export default async function NewsPage() {
  const [postsRows, dataPoints] = await Promise.all([
    getPublishedPosts(12).catch(() => []),
    getDataPoints('news'),
  ]);
  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        icon={Newspaper}
        eyebrow="Articles, Minutes & Handouts"
        title={<h1 className={MASTHEAD_TITLE}>News &amp; Chapter Updates</h1>}
        intro={
          <p className={MASTHEAD_INTRO}>
            Read chapter articles, meeting minutes, and printable handouts from across Fair Oaks,
            Carmichael, and Sacramento County. For monthly bulletins and past newsletters, visit
            the newsletter archive.
          </p>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Interactive Action Alerts Subscription */}
        <ActionAlertsSubscription initialData={dataPoints} />

        {/* Meeting Reviews, Minutes & Printable Handouts */}
        <MeetingMaterials />

        {/* Chapter Articles & Dispatches */}
        <InteractivePostsList initialPosts={postsRows} />

        {/* Newsletter archive lives on its own page; keep one clear route to it. */}
        <section
          aria-labelledby="newsletters-callout-heading"
          className="border-y border-border bg-surface-card p-6 sm:p-8"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-ink dark:text-primary-on-dark">
                <Mail size={19} aria-hidden="true" />
              </div>
              <div>
                <p className="civic-section-index">Newsletters</p>
                <h2
                  id="newsletters-callout-heading"
                  className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]"
                >
                  Bulletins &amp; news blasts
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
                  Monthly bulletins and the legacy newsletter PDFs now have a dedicated archive,
                  separate from articles and meeting materials.
                </p>
              </div>
            </div>
            <Link
              href="/newsletters"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-primary bg-primary px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Read newsletters &amp; bulletins
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>

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
