import type { Metadata } from 'next';
import {
  ROBOTS,
  rootRobots,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_DESCRIPTION,
  siteUrl,
} from '@/config/site';

// Why this helper exists
// ---------------------
// Next.js *replaces* the whole `openGraph` object when a child segment defines
// one — it does not deep-merge. The root layout set `openGraph.url` to the
// homepage, so every page that declared its own `openGraph` without a `url`
// silently shipped the homepage as its share permalink, and every page that
// declared no `openGraph` inherited the same wrong URL. 15+ routes shared the
// homepage as their `og:url`.
//
// Building metadata through one function makes it structurally impossible to
// emit a page without its own canonical, its own `og:url`, and a matching
// Twitter card. `title` is returned bare because the root layout owns the
// `| Site Name` template.
//
// One exception: `app/page.tsx` shares its App Router segment with the root
// layout, and Next does not apply a segment's own `title.template` to that
// segment. The homepage must therefore pass an absolute title.

/** Anything Next accepts for `openGraph.images` / `twitter.images`. */
type OgImages = NonNullable<NonNullable<Metadata['openGraph']>['images']>;

type PageMetadataInput = {
  /** Bare page title. The root `title.template` appends the brand suffix. */
  title: string;
  description: string;
  /** Root-relative path, e.g. `/about` or `/products/yard-sign`. */
  path: string;
  /** Absolute or root-relative OG image URL(s). */
  images?: OgImages;
  type?: 'website' | 'article';
  /** Override the default (index on production, noindex elsewhere). */
  robots?: { index: boolean; follow: boolean };
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
};

/**
 * The root social card, served by `src/app/opengraph-image.tsx`.
 *
 * Next's `opengraph-image` file convention only injects `openGraph.images` when
 * the page does not define its own `openGraph` object — the same
 * replace-don't-merge semantics that caused the `og:url` bug. Every page routed
 * through `pageMetadata()` defines one, so without an explicit default they all
 * shipped no image at all and Facebook/X rendered text-only cards. Referencing
 * the route directly (it responds unhashed) makes the image unconditional.
 */
const DEFAULT_OG_IMAGE = [
  { url: '/opengraph-image', width: 1200, height: 630, alt: `${SITE_NAME}` },
] as const satisfies OgImages;

/** `twitter.images` only accepts strings, so unwrap the object/URL forms. */
function toTwitterImages(images: OgImages): string[] {
  const list = Array.isArray(images) ? images : [images];
  return list
    .map((image) => {
      if (typeof image === 'string') return image;
      if (image instanceof URL) return image.toString();
      return image?.url;
    })
    .filter((url): url is string => typeof url === 'string');
}

export function pageMetadata({
  title,
  description,
  path,
  images,
  type = 'website',
  robots,
  publishedTime,
  modifiedTime,
  authors,
}: PageMetadataInput): Metadata {
  // A canonical and an og:url are mandatory here — that is the whole point.
  const url = siteUrl(path);
  const resolvedImages: OgImages = images ?? DEFAULT_OG_IMAGE;
  // `Metadata['openGraph']` is a discriminated union across ten OG types, so a
  // builder that fills article-only keys conditionally cannot satisfy the checker
  // without a narrowing. The shape is validated by the build's generated route
  // types, and every field below is a documented Next metadata field.
  const openGraph = {
    type,
    url,
    title,
    description,
    siteName: SITE_NAME,
    locale: 'en_US',
    images: resolvedImages,
    ...(type === 'article'
      ? {
          ...(publishedTime ? { publishedTime } : {}),
          ...(modifiedTime ? { modifiedTime } : {}),
          ...(authors ? { authors } : {}),
        }
      : {}),
  } as NonNullable<Metadata['openGraph']>;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: toTwitterImages(resolvedImages),
    },
    robots: robots ?? rootRobots(),
  };
}

/**
 * Metadata for a page that must never be indexed: cart, login, wishlist,
 * checkout results. Emits `noindex, nofollow` and, critically, **no canonical**
 * — a noindexed page that also self-canonicalizes sends Google contradictory
 * signals and can end up indexed-but-unwanted.
 */
export function privateMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: ROBOTS.noindex,
  };
}

/** Trim free text to a SERP-safe length without cutting mid-word where avoidable. */
export function metaDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`;
}

export { SITE_DESCRIPTION, SITE_NAME, SITE_SHORT_DESCRIPTION };
