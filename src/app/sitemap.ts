import { createClient } from '@supabase/supabase-js';
import type { MetadataRoute } from 'next';
import { cacheLife, cacheTag } from 'next/cache';
import { COPY_REGION_SLUG_PREFIX } from '@/lib/copy-regions';
import { env } from '@/lib/env';
import { buildVisibilityFilter } from '@/lib/queries/content';

// Sitemap is hour-cached (one DB query per crawl wave) rather than truly static
// (zero compute). Use cacheLife('hours') + cacheTag('content','sitemap') to bound
// revalidation cost.
//
// Two correctness rules this file enforces:
//  1. Every URL is derived from `siteUrl()`, so the host can never drift from
//     `metadataBase`.
//  2. `lastModified` is only emitted when it is *true*.

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
  { path: '/gallery', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/partners', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/links', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/faqs', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/privacy-policy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms-and-conditions', changeFrequency: 'yearly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  'use cache';
  cacheLife('hours');
  cacheTag('content', 'sitemap');

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  const entries: Entry[] = STATIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: path === '/' ? '' : path,
    changeFrequency,
    priority,
  }));

  const contentResult = await supabase
    .from('content')
    .select('slug, updated_at')
    .eq('status', 'publish')
    .or(buildVisibilityFilter(new Date().toISOString()));

  for (const page of contentResult.data ?? []) {
    if (!page.slug || page.slug.startsWith(COPY_REGION_SLUG_PREFIX)) continue;
    entries.push({
      url: `/${page.slug}`,
      lastModified: page.updated_at ?? undefined,
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  // Absolute URLs from the one configured origin. A relative `url` is resolved
  // against metadataBase, which derives from the same env value.
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  return entries.map((entry) => ({ ...entry, url: `${base}${entry.url}` }));
}
