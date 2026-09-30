import { env } from '@/lib/env';

/**
 * Which hosts may serve an image the CMS puts on a public page.
 *
 * This is the site's own media surface, and it is more than one host: the
 * `media` bucket lives on the Supabase project, so every upload the editor
 * makes comes back as a `*.supabase.co` URL, while a hero can equally be an
 * asset on the site's own domain. Both are ours.
 *
 * ## Why this exists
 *
 * `saveContent` compared the featured image's host against
 * `NEXT_PUBLIC_SITE_URL` and rejected anything else in production. The editor's
 * own uploader writes to the `media` bucket, which is on `*.supabase.co` — so
 * the CMS's uploader produced a URL its own save validation then refused. The
 * result was a hero field that could not be set from the CMS at all in
 * production: a control the author could fill in and watch come back as an
 * error, which is the AGENTS.md "no fake controls" failure wearing a
 * validation message.
 *
 * The list is derived from configuration rather than hand-written, so it follows
 * `NEXT_PUBLIC_SITE_URL` across the apex cutover instead of needing a sweep.
 */

const siteHost = (): string => {
  try {
    return new URL(env.NEXT_PUBLIC_SITE_URL).hostname;
  } catch {
    return '';
  }
};

const supabaseHost = (): string => {
  try {
    return new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  } catch {
    return '';
  }
};

/**
 * Hosts the site is willing to render an authored image from.
 *
 * - the configured site origin (the apex, or staging before the cutover)
 * - the Supabase project host, which fronts the public `media` bucket
 * - a `*.supabase.co` subdomain, because the public object URL is served from
 *   `<project-ref>.supabase.co` and `NEXT_PUBLIC_SUPABASE_URL` may be the API
 *   origin rather than the storage one
 */
export function isOwnImageHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return false;

  const site = siteHost().toLowerCase();
  if (site && (normalized === site || normalized.endsWith(`.${site}`))) return true;

  const supabase = supabaseHost().toLowerCase();
  if (supabase && (normalized === supabase || normalized.endsWith(`.${supabase}`))) return true;

  return normalized === 'supabase.co' || normalized.endsWith('.supabase.co');
}

/**
 * Whether a URL may be stored as authored media.
 *
 * Absolute http(s) only. A `data:` URL would break the crawler that reads the
 * OG tag, and a relative one would resolve against whatever host rendered it —
 * so both are refused rather than normalized.
 */
export function isOwnImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  return isOwnImageHost(url.hostname);
}

/**
 * The remote patterns `next/image` needs for a host. `next.config.ts` cannot
 * import a value from `env` at build time for every case, so this is exported
 * for the places that build a loader config dynamically.
 */
export function ownImageRemotePatterns(): { protocol: 'http' | 'https'; hostname: string }[] {
  const patterns: { protocol: 'http' | 'https'; hostname: string }[] = [];
  for (const host of [siteHost(), supabaseHost()]) {
    if (host) patterns.push({ protocol: 'https', hostname: host });
  }
  return patterns;
}
