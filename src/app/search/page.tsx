import { ArrowRight, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE_DOCUMENT,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';
import { getDataPoints } from '@/lib/queries/civic';
import { buildTextSearchOr } from '@/lib/queries/content';
import {
  normalizeSearchQuery,
  type RankedContentRow,
  searchContentRanked,
} from '@/lib/queries/search';
import { isSpamContent } from '@/lib/sanitize';
import { createPublicClient } from '@/lib/supabase-server';

// Search results are per-user request-time views — never index them.
export const metadata: Metadata = {
  title: 'Search — Indivisible Fair Oaks-Carmichael',
  description:
    'Search actions, meeting notes, guides, and pages across Indivisible Fair Oaks-Carmichael.',
  robots: { index: false, follow: true },
};

// Deliberate Cache Components opt-out (Block): results derive from
// request-time searchParams; nothing to prerender.
export const instant = false;

const POPULAR_LINKS = [
  { href: '/events', label: 'Upcoming events' },
  { href: '/voter-info', label: 'Voter information' },
  { href: '/newsletters', label: 'Newsletters' },
  { href: '/gallery', label: 'Community gallery' },
] as const;

function resultDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PopularLinks({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      {POPULAR_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="civic-link-arrow">
          {link.label}
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [supabase, dataPoints] = await Promise.all([
    Promise.resolve(createPublicClient()),
    getDataPoints('search'),
  ]);
  const resolvedParams = await searchParams;
  const q = typeof resolvedParams.q === 'string' ? normalizeSearchQuery(resolvedParams.q) : '';

  let posts: RankedContentRow[] = [];

  if (q) {
    const rankedContent = await searchContentRanked(supabase, q);

    if (rankedContent) {
      // Primary path: Postgres full-text search with relevance ranking.
      posts = rankedContent;
    } else {
      // Fallback for schemas whose migrations have not applied yet.
      const contentResult = await supabase
        .from('content')
        .select('id, title, slug, type, created_at')
        .eq('status', 'publish')
        .or(
          buildTextSearchOr([`title.ilike.%${q}%`, `body.ilike.%${q}%`], new Date().toISOString())
        )
        .limit(10);

      posts = contentResult.data || [];
    }

    posts = posts.filter((item) => !isSpamContent(item.title));
  }

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        compact
        icon={Search}
        eyebrow={
          <DataPoint name="search.header.eyebrow" initialData={dataPoints}>
            Search the chapter
          </DataPoint>
        }
        title={
          <h1 className={MASTHEAD_TITLE_DOCUMENT}>
            <DataPoint name="search.header.title" initialData={dataPoints}>
              Search Results
            </DataPoint>
          </h1>
        }
        intro={
          <p className={MASTHEAD_INTRO}>
            {q ? (
              <>
                Results for <span className="font-semibold text-foreground">&ldquo;{q}&rdquo;</span>{' '}
                across the chapter archive.
              </>
            ) : (
              'Find actions, meeting minutes, voter guides, newsletters and pages from across the chapter.'
            )}
          </p>
        }
        meta={
          <form
            action="/search"
            method="get"
            role="search"
            className="civic-form flex w-full max-w-xl flex-col gap-2 sm:flex-row"
          >
            <label htmlFor="site-search" className="sr-only">
              Search the chapter
            </label>
            <input
              id="site-search"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search actions, minutes, guides, pages…"
              className="min-w-0 flex-1 px-4"
            />
            <button
              type="submit"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 border border-primary bg-primary px-5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Search
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </form>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        {q ? (
          posts.length > 0 ? (
            <section aria-labelledby="search-results-heading">
              <div className="civic-section-head">
                <div>
                  <p className="civic-section-index">Archive index</p>
                  <h2
                    id="search-results-heading"
                    className="mt-2 font-display text-3xl font-semibold leading-tight tracking-[-0.03em]"
                  >
                    <DataPoint name="search.results.logbook" as="span" initialData={dataPoints}>
                      From the logbook &amp; pages
                    </DataPoint>
                  </h2>
                </div>
                <p className="civic-lede">
                  {posts.length} {posts.length === 1 ? 'result' : 'results'} found. Open an entry
                  to read the full page.
                </p>
              </div>

              <ol className="border-y border-border">
                {posts.map((post) => {
                  const date = resultDate(post.created_at);
                  return (
                    <li key={post.id} className="border-b border-border last:border-b-0">
                      <Link
                        href={`/${post.slug}`}
                        className="group grid gap-3 py-5 transition-colors hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:grid-cols-[7.5rem_minmax(0,1fr)_1.5rem] sm:items-start sm:gap-6 dark:hover:text-primary-on-dark"
                      >
                        <span className="flex flex-wrap items-baseline gap-2 sm:flex-col sm:items-start">
                          <span className="civic-stamp">{post.type || 'Page'}</span>
                          {date ? <span className="civic-meta">{date}</span> : null}
                        </span>
                        <span className="font-display text-2xl font-semibold leading-tight tracking-[-0.025em] text-foreground transition-colors group-hover:text-primary-ink dark:group-hover:text-primary-on-dark">
                          {post.title}
                        </span>
                        <ArrowRight
                          size={17}
                          aria-hidden="true"
                          className="hidden text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary-ink sm:block sm:justify-self-end sm:pt-1 dark:group-hover:text-primary-on-dark"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : (
            <section aria-labelledby="search-empty-heading" className="civic-panel civic-panel--muted p-8 sm:p-10">
              <Search
                size={24}
                aria-hidden="true"
                className="text-primary-ink dark:text-primary-on-dark"
              />
              <h2
                id="search-empty-heading"
                className="mt-4 font-display text-3xl font-semibold tracking-[-0.03em]"
              >
                <DataPoint name="search.empty.desc" initialData={dataPoints}>
                  No matches found.
                </DataPoint>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Try a shorter phrase, a name, a location or a topic. The chapter archive uses the
                same words as the pages themselves.
              </p>
              <PopularLinks className="mt-6 flex flex-wrap gap-x-6 gap-y-2" />
              <Link
                href="/news"
                className="mt-6 inline-flex min-h-11 items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <DataPoint name="search.empty.btn" initialData={dataPoints}>
                  Browse the newsroom
                </DataPoint>
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </section>
          )
        ) : (
          <section aria-labelledby="search-start-heading" className="civic-panel civic-panel--muted p-8 sm:p-10">
            <p className="civic-section-index">Start here</p>
            <h2
              id="search-start-heading"
              className="mt-2 max-w-xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.035em]"
            >
              One index for the whole chapter.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Search articles, meeting notes, voter guides and chapter pages. Enter a word or
              phrase above, or start with one of the sections people look for most.
            </p>
            <PopularLinks className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-5" />
          </section>
        )}
      </div>
    </div>
  );
}
