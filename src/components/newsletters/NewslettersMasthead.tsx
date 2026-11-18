import { ArrowRight, Newspaper } from 'lucide-react';
import Link from 'next/link';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';

type NewslettersMastheadProps = {
  dataPoints: Record<string, string>;
};

export function NewslettersMasthead({ dataPoints }: NewslettersMastheadProps) {
  return (
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
  );
}
