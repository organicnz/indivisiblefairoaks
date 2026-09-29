import { createClient } from '@supabase/supabase-js';
import type { MetadataRoute } from 'next';
import { cacheLife, cacheTag } from 'next/cache';
import { env } from '@/lib/env';
import { buildVisibilityFilter } from '@/lib/queries/content';

// Sitemap is hour-cached (one DB query per crawl wave) rather than truly static
// (zero compute). Use cacheLife('hours') + cacheTag('content','sitemap') to bound
// revalidation cost. A Vercel Pro move to cacheLife:"minutes" would enable
// finer freshness; for now this is the conservation-mode compromise.
//
// Two correctness rules this file now enforces:
//  1. Every URL is derived from `siteUrl()`, so the host can never drift from
//     `metadataBase`. It previously advertised the staging host while every page
//     canonicalised to the apex.
//  2. `lastModified` is only emitted when it is *true*. The nine static entries all
//     carried `new Date()`, so every deploy told Google "all pages changed today"
//     and `lastmod` stopped carrying any crawl signal at all. Omitting the field
//     makes Google fall back to observed change frequency, which is accurate.

type Entry = MetadataRoute.Sitemap[number];

const STATIC_ROUTES: {
  path: string;
  changeFrequency: Entry['changeFrequency'];
  priority: number;
}[] = [
  { path: '/', changeFrequency: 'daily', priority: 1.0 },
  { path: '/about', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/events', changeFrequency: 'daily', priority: 0.9 },
  { path: '/voter-info', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/choir', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/news', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/donate', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/products', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/gallery', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/partners', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/links', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/faqs', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/privacy-policy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms-and-conditions', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/shipping-returns', changeFrequency: 'yearly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  'use cache';
  // Sitemaps are fetched repeatedly by crawlers; cache the generated XML for
  // an hour so each crawl wave costs one Supabase query instead of N.
  cacheLife('hours');
  cacheTag('content', 'sitemap', 'products');

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  const entries: Entry[] = STATIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: path === '/' ? '' : path,
    changeFrequency,
    priority,
  }));

  // CMS pages and the product catalog both belong in the sitemap. The catalog was
  // entirely absent, which meant the highest-value URLs on the site — the ones with
  // real purchase intent — were only discoverable by crawling.
  //
  // The two sources are fetched independently so a failure in one cannot strip the
  // other. A throw here fails the build, which for a static export is the correct
  // outcome: shipping a silently-truncated sitemap is worse than not deploying.
  const [contentResult, productResult] = await Promise.all([
    supabase
      .from('content')
      .select('slug, updated_at')
      .eq('status', 'publish')
      .or(buildVisibilityFilter(new Date().toISOString())),
    supabase.from('products').select('slug, updated_at').eq('stock_status', 'instock'),
  ]);

  for (const page of contentResult.data ?? []) {
    entries.push({
      url: `/${page.slug}`,
      lastModified: page.updated_at ?? undefined,
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  for (const product of productResult.data ?? []) {
    // `_sample` is the placeholder `getAllProductSlugs` emits when the products
    // table is unreadable. It is not a real page and must never be advertised.
    if (!product.slug || product.slug.startsWith('_')) continue;
    entries.push({
      url: `/products/${product.slug}`,
      lastModified: product.updated_at ?? undefined,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  // Absolute URLs from the one configured origin. A relative `url` is resolved
  // against metadataBase, which derives from the same env value.
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  return entries.map((entry) => ({ ...entry, url: `${base}${entry.url}` }));
}
