import { ArrowRight, ExternalLink, Newspaper } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegacyDocumentArchive } from '@/components/archive/LegacyDocumentArchive';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { ActionAlertsSubscription } from '@/components/ui/ActionAlertsSubscription';
import { DataPoint } from '@/components/ui/DataPoint';
import { InteractiveNewslettersList } from '@/components/ui/InteractiveNewslettersList';
import { NEIGHBORING_CHAPTERS } from '@/config/neighboring-chapters';
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
      <PageMasthead
        icon={Newspaper}
        eyebrow={
          <DataPoint name="news.hero.eyebrow" initialData={dataPoints}>
            Chapter Bulletins &amp; Insights
          </DataPoint>
        }
        title={
          <DataPoint
            name="news.hero.headline"
            as="h1"
            initialData={dataPoints}
            className={MASTHEAD_TITLE}
          >
            Newsletters &amp; Chapter Updates
          </DataPoint>
        }
        intro={
          <DataPoint
            name="news.hero.intro"
            as="p"
            initialData={dataPoints}
            className={MASTHEAD_INTRO}
          >
            Stay up to date with our grassroots organizing, local legislative actions, and
            community resistance across Fair Oaks, Carmichael, and Sacramento County.
          </DataPoint>
        }
        meta={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="civic-section-index">Latest from the chapter</span>
            <Link
              href="/news"
              className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
            >
              Read news &amp; updates
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        }
      />

      <div className="mx-auto max-w-5xl space-y-16 px-4 py-16 sm:px-6 lg:px-8">
        <section aria-labelledby="newsletter-archive-heading" className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="civic-section-index">Chapter-owned bulletins</p>
              <h2
                id="newsletter-archive-heading"
                className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]"
              >
                <DataPoint name="news.archive.title" as="span" initialData={dataPoints}>
                  Past Bulletins &amp; Archives
                </DataPoint>
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
                Email-style updates from our chapter organizers. Use the topic filters to find a
                bulletin, or search the archive by title or subject.
              </p>
            </div>
            <Link
              href="/news"
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
            >
              News &amp; updates
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <InteractiveNewslettersList initialNewsletters={newslettersRows} initialData={dataPoints} />
        </section>

        <ActionAlertsSubscription initialData={dataPoints} />

        <section aria-labelledby="neighboring-chapters-heading" className="space-y-6">
          <div className="border-b border-border pb-5">
            <p className="civic-section-index">Neighboring chapters</p>
            <h2
              id="neighboring-chapters-heading"
              className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]"
            >
              From our neighbors
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
              We link to each chapter&apos;s own public page. A card here means we verified the
              source — not that we reprinted their newsletter.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {NEIGHBORING_CHAPTERS.map((chapter) => (
              <article
                key={chapter.href}
                className="flex flex-col justify-between gap-6 border border-border bg-surface-card p-6"
              >
                <div>
                  <p className="civic-meta text-muted-foreground">{chapter.area}</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em]">
                    {chapter.name}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
                    {chapter.description}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="inline-flex border border-border bg-surface-muted px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {chapter.newsletterStatus}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <a
                      href={chapter.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
                    >
                      {chapter.linkLabel}
                      <ExternalLink size={14} aria-hidden="true" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {chapter.sourceLabel} · checked {chapter.checkedOn}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
            Know a neighboring chapter with a public newsletter?{' '}
            <a
              href="mailto:contact@indivisiblefairoaks.org?subject=Neighboring%20chapter%20newsletter"
              className="font-semibold text-primary-ink underline decoration-primary/40 underline-offset-4 hover:decoration-primary dark:text-primary-on-dark"
            >
              Send us the link
            </a>{' '}
            so we can verify and add it.
          </p>
        </section>

        {legacyNewsletters.length > 0 ? (
          <div className="border-t border-border pt-4">
            <LegacyDocumentArchive
              documents={legacyNewsletters}
              title="Legacy newsletter PDFs"
              description="The original newsletter files from the chapter’s Google Sites. Each entry identifies whether the file is hosted here or points to its original source."
              limit={12}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
