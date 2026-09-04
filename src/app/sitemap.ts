import { createClient } from '@supabase/supabase-js';
import type { MetadataRoute } from 'next';
import { cacheLife } from 'next/cache';
import { env } from '@/lib/env';
import { buildVisibilityFilter } from '@/lib/queries/content';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  'use cache';
  // Sitemaps are fetched repeatedly by crawlers; cache the generated XML for
  // an hour so each crawl wave costs one Supabase query instead of N.
  cacheLife('hours');
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;

  // Use anon key for public data
  let pageUrls: MetadataRoute.Sitemap = [];

  try {
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );

    const { data: pages } = await supabase
      .from('content')
      .select('slug, updated_at')
      .eq('status', 'publish')
      .or(buildVisibilityFilter(new Date().toISOString()));

    if (pages) {
      pageUrls = pages.map((page) => ({
        url: `${baseUrl}/${page.slug}`,
        lastModified: page.updated_at || new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));
    }
  } catch {
    // Graceful degradation if database is unreachable during static builds
  }

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/choir`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/voter-info`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/links`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/donate`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    ...pageUrls,
  ];
}
