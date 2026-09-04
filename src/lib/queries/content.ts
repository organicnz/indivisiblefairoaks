import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient } from '@/lib/supabase-server';

/**
 * PostgREST visibility fragment for scheduled content. A row is publicly
 * visible when it is published AND its embargo (if any) has lifted:
 * NULL published_at means "visible immediately".
 *
 * Pure and unit-testable — the fragment is embedded in every public content
 * read (page bodies, sitemap, search fallback) so embargoed rows never leak.
 */
export function buildVisibilityFilter(nowISO: string): string {
  return `published_at.is.null,published_at.lte.${nowISO}`;
}

/**
 * Combines caller-supplied text-match conditions with the visibility filter
 * into a SINGLE `or` parameter, in (text AND visible) OR … form.
 *
 * This must stay a single `.or()` call: postgrest-js appends each `.or()`
 * as a separate `or=` query param, and duplicate-param semantics
 * (AND vs. last-wins) are not something to bet search correctness on.
 *
 * Each condition is stripped of `,()` first: those characters are PostgREST
 * grouping syntax, and user input (e.g. "choir, meeting") must never be able
 * to break out of its own condition.
 */
export function buildTextSearchOr(textConditions: string[], nowISO: string): string {
  const visibility = buildVisibilityFilter(nowISO);
  return textConditions
    .map((condition) => condition.replace(/[,()]/g, ''))
    .filter((condition) => condition.length > 0)
    .map((condition) => `and(${condition},${visibility})`)
    .join(',');
}

export async function getAllPublishedSlugs() {
  'use cache';
  cacheLife('hours');
  cacheTag('content');
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from('content')
      .select('slug')
      .eq('status', 'publish')
      .or(buildVisibilityFilter(new Date().toISOString()));
    const slugs = (data ?? []).map((row) => ({ slug: row.slug }));
    return slugs.length > 0 ? slugs : [{ slug: '_sample' }];
  } catch {
    return [{ slug: '_sample' }];
  }
}

export async function getPublishedContent(slug: string) {
  'use cache';
  cacheLife('hours');
  cacheTag('content', `content-${slug}`);
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('content')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'publish')
    .or(buildVisibilityFilter(new Date().toISOString()))
    .single();
  return data;
}

/**
 * Fetches gallery photo data from the content table (type='gallery').
 * Returns photos with slugs matching the gallery theme, or empty array if none found.
 */
export async function getGalleryPhotos() {
  'use cache';
  cacheLife('hours');
  cacheTag('gallery-photos');
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from('content')
      .select('*')
      .eq('status', 'publish')
      .eq('type', 'gallery');
    if (data && data.length > 0) {
      return data.map((row) => ({
        id: row.slug,
        url: '',
        caption: row.title,
        location: '',
        category: 'No Kings Sacramento' as const,
        signQuote: undefined,
        date: row.created_at ? new Date(row.created_at).toLocaleDateString('en-US') : '',
        photographer: 'Indivisible Fair Oaks Archive',
      }));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Fetches content rows of type 'testimonial' from Supabase.
 * Falls back to hardcoded testimonials if no DB data exists.
 */
export async function getTestimonials() {
  'use cache';
  cacheLife('hours');
  cacheTag('testimonials');
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from('content')
      .select('*')
      .eq('status', 'publish')
      .eq('type', 'testimonial');
    if (data && data.length > 0) {
      return data.map((row) => ({
        name: row.title.split(' - ')[0] || 'Unknown',
        role: 'Contributor',
        content: row.body || '',
        image: '',
        stars: 5,
      }));
    }
    return null;
  } catch {
    return null;
  }
}
