import { cacheLife, cacheTag } from 'next/cache';
import { isLegacySlug } from '@/config/legacy-redirects';
import { unreachableContentSlugs } from '@/lib/content';
import { isCopyRegionSlug } from '@/lib/copy-regions';
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
    // Drop slugs owned by a legacy redirect. Those paths are served by the redirect map
    // in next.config.ts, so prerendering them here would build a page that can never
    // be reached — and would advertise a duplicate in the sitemap.
    //
    // Copy regions are dropped for the same reason with different mechanics: a
    // region is a *slice* of a coded page (`copy-home-hero` renders inside `/`),
    // so prerendering it as its own `[slug]` page would publish a page nobody
    // wrote, at a URL nobody links to.
    const slugs = (data ?? [])
      .map((row) => row.slug)
      .filter((slug): slug is string => Boolean(slug) && !isLegacySlug(slug))
      .filter((slug) => !isCopyRegionSlug(slug))
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

export interface CopyRegionSnapshot {
  body: string;
  /** The row version the rendered body belongs to, for conditional saves. */
  updatedAt: string | null;
}

/**
 * The published body of a copy region, or null when it has none.
 *
 * A copy region is a slice of a coded page (`copy-home-hero` renders inside `/`),
 * so it is read exactly like a page body: published, not embargoed, sanitized by
 * the caller. It lives here rather than in the component so it is a *cached*
 * read — `'use cache'` is what keeps `new Date()` out of a prerender. Reading it
 * uncached made `/about` fail the build with "the unstable value `new Date()`
 * while prerendering", and would also have cost a query per coded route per
 * build, which the Conservation Mode budget in AGENTS.md exists to avoid.
 *
 * The version travels with the body. A page-mode inline edit writes the region
 * by slug, not through a row it loaded, so the rendered element is the only
 * place the editor can learn the version it must not overwrite. No extra
 * query: the read already selected the row.
 */
export async function getCopyRegion(slug: string): Promise<CopyRegionSnapshot | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('content', `content-${slug}`);
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from('content')
      .select('body, updated_at')
      .eq('slug', slug)
      .eq('status', 'publish')
      .or(buildVisibilityFilter(new Date().toISOString()))
      .maybeSingle();
    if (!data || !data.body) return null;
    return { body: data.body, updatedAt: data.updated_at ?? null };
  } catch {
    // An unreadable region renders its fallback rather than blanking the page.
    return null;
  }
}

export interface PublishedPostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  published_at: string | null;
  created_at: string;
}

const UNREACHABLE_CONTENT_SLUGS = unreachableContentSlugs();
const UNREACHABLE_SLUG_FILTER = `(${UNREACHABLE_CONTENT_SLUGS.map((slug) => `"${slug}"`).join(',')})`;

/** PostgREST caps a single response, so the full archive is read in pages. */
const PUBLISHED_POSTS_PAGE_SIZE = 500;

/**
 * Published news posts, newest first.
 *
 * Passing `limit` keeps the old bounded call available. Omitting it reads the
 * whole published archive so `/news` can search every story rather than only
 * the first screen of cards.
 */
export async function getPublishedPosts(limit?: number): Promise<PublishedPostSummary[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('content', 'posts');
  try {
    const supabase = createPublicClient();
    // One instant for every page, so an embargo lifting mid-loop cannot shift
    // rows between offset windows.
    const nowISO = new Date().toISOString();
    const selectPosts = () => {
      let query = supabase
        .from('content')
        .select('id, title, slug, excerpt, featured_image, published_at, created_at')
        .eq('status', 'publish')
        .eq('type', 'post')
        .or(buildVisibilityFilter(nowISO));

      // A `content` row whose slug is owned by a coded route is not a published
      // article. The legacy `newsletters` row is the one that made this visible:
      // it was type `post`, so it led `/news` with a link back to the archive.
      if (UNREACHABLE_CONTENT_SLUGS.length > 0) {
        query = query.not('slug', 'in', UNREACHABLE_SLUG_FILTER);
      }
      return query.not('slug', 'like', 'copy-%');
    };

    const ordered = () =>
      selectPosts()
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        // Offset pages need one unique tiebreaker, or rows with the same timestamps
        // can be duplicated or skipped between requests.
        .order('id', { ascending: false });

    if (limit !== undefined) {
      const { data } = await ordered().limit(limit);
      return (data as PublishedPostSummary[]) ?? [];
    }

    const posts: PublishedPostSummary[] = [];
    for (let from = 0; ; from += PUBLISHED_POSTS_PAGE_SIZE) {
      const { data, error } = await ordered().range(from, from + PUBLISHED_POSTS_PAGE_SIZE - 1);
      if (error) break;
      const page = (data as PublishedPostSummary[]) ?? [];
      posts.push(...page);
      if (page.length < PUBLISHED_POSTS_PAGE_SIZE) break;
    }
    return posts;
  } catch {
    return [];
  }
}
