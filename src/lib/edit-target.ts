/**
 * Public pathname → admin edit target resolution (pure half).
 *
 * Decides which paths are even *eligible* for the header's editorial button,
 * before any database lookup runs — so traversal, encoded separators and
 * infrastructure paths never reach a query. The API route
 * (`/api/admin/edit-context`) does the admin check and the slug→row lookup;
 * this module only answers "could this path be CMS content".
 *
 * A path with no row still yields no button: eligibility is not existence, and
 * the button renders only when an edit URL is known (never a dead link).
 */

export interface CmsEditTarget {
  kind: 'cms';
  editUrl: string;
  /** Human label for tooltips: the content title. */
  label: string;
  status: string;
}

export interface EditContextResponse {
  isAdmin: boolean;
  target: CmsEditTarget | null;
}

/** Technical prefixes that are never CMS content, regardless of the table. */
const RESERVED_FIRST_SEGMENTS = new Set([
  'admin',
  'api',
  'auth',
  'login',
  'account',
  '_next',
  'favicon.ico',
]);

const SLUG_PATTERN = /^[a-z0-9-]+$/i;
const MAX_SLUG_LENGTH = 200;

/**
 * The CMS slug for a pathname, or null when the path cannot be one.
 *
 * Single-segment only (the CMS serves `src/app/[slug]`; nested routes belong
 * to coded surfaces with their own admin pages). Mirrors
 * `getPublishedContent`'s matching: the raw segment, strict charset, no
 * case folding — a lookup that normalises differently from the public read
 * would offer to edit a row the route itself would not render.
 */
export function cmsSlugForPath(pathname: string | null | undefined): string | null {
  if (!pathname?.startsWith('/')) return null;
  const withoutQuery = pathname.split('?')[0].split('#')[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  if (segments.length !== 1) return null;
  const [slug] = segments;
  if (!slug || slug.length > MAX_SLUG_LENGTH) return null;
  if (slug.includes('.') || slug.includes('\\')) return null;
  if (RESERVED_FIRST_SEGMENTS.has(slug.toLowerCase())) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return null;
  }
  if (decoded !== slug) return null;
  if (!SLUG_PATTERN.test(decoded)) return null;
  return decoded;
}

/** Admin editor URL for a resolved content row. */
export function editUrlForContentId(id: number | string): string {
  return `/admin/content/${id}`;
}
