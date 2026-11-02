import type { Metadata } from 'next';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { VgpuAtmosphericRefraction } from '@/components/ui/VgpuAtmosphericRefraction';
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
    <div className="w-full bg-background min-h-[70vh] text-foreground pt-(--header-clearance) pb-20">
      {/* Header Banner with VGPU Atmospheric Refraction & Mirage LIDAR Scan */}
      <section className="relative overflow-hidden bg-surface-muted border-b border-border text-foreground dark:bg-secondary dark:text-white py-12 mb-10">
        <VgpuAtmosphericRefraction />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground dark:text-white uppercase">
            <DataPoint name="search.header.title" initialData={dataPoints}>
              Search Results
            </DataPoint>
          </h1>
          <div className="h-1.5 w-24 bg-primary dark:bg-accent-gold mt-3" />
          <p className="mt-4 text-muted-foreground dark:text-ink-muted-on-dark font-bold uppercase tracking-widest text-xs">
            Results for{' '}
            <span className="text-primary dark:text-primary-on-dark">&ldquo;{q}&rdquo;</span>
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Content Results */}
        {posts.length > 0 && (
          <div className="mb-20">
            <h2 className="text-2xl font-black text-foreground uppercase tracking-widest mb-8 border-b-2 border-primary pb-2 inline-block">
              <DataPoint name="search.results.logbook" initialData={dataPoints}>
                From the Logbook & Pages
              </DataPoint>
            </h2>
            <div className="grid gap-6 max-w-3xl">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="p-6 bg-surface-muted rounded-2xl border border-border hover:bg-surface-card hover:shadow-md transition-all"
                >
                  <h3 className="text-lg font-black text-foreground uppercase mb-2">
                    <Link
                      href={`/${post.slug}`}
                      className="hover:text-primary dark:hover:text-primary-on-dark transition-colors"
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black bg-surface-muted text-muted-foreground px-2 py-0.5 rounded uppercase tracking-widest">
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
          <div className="text-center py-24 bg-surface-muted rounded-3xl border border-dashed border-border">
            <p className="text-muted-foreground font-black uppercase tracking-widest mb-6">
              <DataPoint name="search.empty.desc" initialData={dataPoints}>
                No matches found.
              </DataPoint>
            </p>
            <Link
              href="/events"
              className="inline-block border-2 border-primary text-foreground hover:bg-primary hover:text-white dark:border-border dark:hover:bg-primary-bright dark:hover:text-white font-black py-3 px-8 rounded-full transition-all uppercase tracking-widest text-xs"
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
