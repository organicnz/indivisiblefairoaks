import { cacheLife, cacheTag } from 'next/cache';
import { isLegacySlug } from '@/config/legacy-redirects';
import { env } from '@/lib/env';
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
  // Throwaway E2E test bundles only need fixture routes prerendered; dynamic routes
  // render on-demand at runtime. Avoids querying remote CMS and ballooning build time/memory.
  if (env.NEXT_E2E_BUILD === 'true') {
    return [{ slug: 'privacy-policy' }, { slug: 'terms-and-conditions' }];
  }
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from('content')
      .select('slug')
      .eq('status', 'publish')
      .or(buildVisibilityFilter(new Date().toISOString()));
    // Drop slugs owned by a legacy 301. Those paths are served by the redirect map
    // in next.config.ts, so prerendering them here would build a page that can never
    // be reached — and would advertise a duplicate in the sitemap.
    const slugs = (data ?? [])
      .map((row) => row.slug)
      .filter((slug): slug is string => Boolean(slug) && !isLegacySlug(slug))
      .map((slug) => ({ slug }));
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
