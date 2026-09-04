import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/products/ProductCard';
import { buildTextSearchOr } from '@/lib/queries/content';
import {
  normalizeSearchQuery,
  type RankedContentRow,
  type RankedProductRow,
  searchContentRanked,
  searchProductsRanked,
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
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = createPublicClient();
  const resolvedParams = await searchParams;
  const q = typeof resolvedParams.q === 'string' ? normalizeSearchQuery(resolvedParams.q) : '';

  let products: RankedProductRow[] = [];
  let posts: RankedContentRow[] = [];

  if (q) {
    const [rankedProducts, rankedContent] = await Promise.all([
      searchProductsRanked(supabase, q),
      searchContentRanked(supabase, q),
    ]);

    if (rankedProducts && rankedContent) {
      // Primary path: Postgres full-text search with relevance ranking.
      products = rankedProducts;
      posts = rankedContent;
    } else {
      // Fallback for schemas whose migrations have not applied yet
      // (fresh preview environments): the legacy ILIKE scan.
      const { data: prodData } = await supabase
        .from('products')
        .select('id, name, slug, price, regular_price, sale_price, image_url, stock_status')
        .ilike('name', `%${q}%`)
        .eq('stock_status', 'instock')
        .order('created_at', { ascending: false })
        .limit(24);

      const { data: contentData } = await supabase
        .from('content')
        .select('id, title, slug, type, created_at')
        .eq('status', 'publish')
        .or(
          buildTextSearchOr([`title.ilike.%${q}%`, `body.ilike.%${q}%`], new Date().toISOString())
        )
        .limit(10);

      products = prodData || [];
      posts = contentData || [];
    }

    posts = posts.filter((item) => !isSpamContent(item.title));
  }

  return (
    <div className="bg-white min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-(--header-h) pb-12">
        <div className="flex flex-col mb-10">
          <h1 className="text-4xl font-black tracking-tight text-secondary uppercase">
            Search Results
          </h1>
          <div className="h-1.5 w-24 bg-primary mt-3" />
          <p className="mt-4 text-slate-500 font-bold uppercase tracking-widest text-xs">
            Results for <span className="text-primary-ink">&ldquo;{q}&rdquo;</span>
          </p>
        </div>

        {/* Product Results */}
        {products.length > 0 && (
          <div className="mb-20">
            <h2 className="text-2xl font-black text-secondary uppercase tracking-widest mb-8 border-b-2 border-primary pb-2 inline-block">
              Gear Found
            </h2>
            <div className="grid grid-cols-1 gap-y-10 gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Content Results */}
        {posts.length > 0 && (
          <div className="mb-20">
            <h2 className="text-2xl font-black text-secondary uppercase tracking-widest mb-8 border-b-2 border-primary pb-2 inline-block">
              From the Logbook & Pages
            </h2>
            <div className="grid gap-6 max-w-3xl">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all"
                >
                  <h3 className="text-lg font-black text-secondary uppercase mb-2">
                    <Link href={`/${post.slug}`} className="hover:text-primary transition-colors">
                      {post.title}
                    </Link>
                  </h3>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black bg-slate-200 text-slate-500 px-2 py-0.5 rounded uppercase tracking-widest">
                      {post.type || 'Content'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'No date'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {products.length === 0 && posts.length === 0 && (
          <div className="text-center py-24 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-black uppercase tracking-widest mb-6">
              No matches found.
            </p>
            <Link
              href="/products"
              className="inline-block border-2 border-secondary text-secondary hover:bg-secondary hover:text-white font-black py-3 px-8 rounded-full transition-all uppercase tracking-widest text-xs"
            >
              Browse all gear
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
