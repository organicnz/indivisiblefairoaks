import type { Metadata } from 'next';
import { SearchEmptyState } from '@/components/search/SearchEmptyState';
import { SearchMasthead } from '@/components/search/SearchMasthead';
import { SearchResults } from '@/components/search/SearchResults';
import { SearchStartState } from '@/components/search/SearchStartState';
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
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <SearchMasthead query={q} dataPoints={dataPoints} />

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        {q ? (
          posts.length > 0 ? (
            <SearchResults posts={posts} dataPoints={dataPoints} />
          ) : (
            <SearchEmptyState dataPoints={dataPoints} />
          )
        ) : (
          <SearchStartState />
        )}
      </div>
    </div>
  );
}
