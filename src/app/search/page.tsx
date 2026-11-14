import type { Metadata } from 'next';
import Link from 'next/link';
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
    <div className="civic-page w-full min-h-[70vh] bg-background pb-20 text-foreground pt-(--header-clearance)">
      <section className="relative mb-10 overflow-hidden border-b border-border bg-surface-muted py-12 text-foreground">
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="civic-kicker">Search the chapter</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-5xl">
            <DataPoint name="search.header.title" initialData={dataPoints}>
              Search Results
            </DataPoint>
          </h1>
          <p className="civic-lede mt-4">
            Results for <span className="font-semibold text-foreground">&ldquo;{q}&rdquo;</span>
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Content Results */}
        {posts.length > 0 && (
          <div className="mb-20">
            <h2 className="mb-8 inline-block border-b border-primary pb-2 font-display text-2xl font-semibold tracking-[-0.03em]">
              <DataPoint name="search.results.logbook" initialData={dataPoints}>
                From the Logbook & Pages
              </DataPoint>
            </h2>
            <div className="grid gap-6 max-w-3xl">
              {posts.map((post) => (
                <div key={post.id} className="border-t border-border py-5 transition-colors hover:text-primary-ink">
                  <h3 className="mb-2 font-display text-xl font-semibold tracking-[-0.02em]">
                    <Link
                      href={`/${post.slug}`}
                      className="hover:text-primary dark:hover:text-primary-on-dark transition-colors"
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <div className="flex items-center gap-4">
                    <span className="border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {post.type || 'Content'}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'No date'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {posts.length === 0 && (
          <div className="border-y border-border bg-surface-muted py-24 text-center">
            <h2 className="mb-6 font-display text-3xl font-semibold tracking-[-0.03em]">
              <DataPoint name="search.empty.desc" initialData={dataPoints}>
                No matches found.
              </DataPoint>
            </h2>
            <Link
              href="/events"
              className="inline-flex min-h-11 items-center border border-primary bg-transparent px-8 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-primary hover:text-white"
            >
              <DataPoint name="search.empty.btn" initialData={dataPoints}>
                Browse upcoming events
              </DataPoint>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
