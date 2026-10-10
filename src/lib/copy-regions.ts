/**
 * Copy regions — the answer to "why can't I edit the homepage?"
 *
 * The chapter's site has coded routes (`/`, `/about`, `/choir`, …) whose copy is
 * literal JSX. The CMS `content` table could already drive `[slug]` pages, but a
 * row with slug `about` is *rejected at write time* — `RESERVED_SLUGS` in
 * `src/lib/content.ts` — because a CMS slug that matches a real App Router
 * segment is shadowed and silently unreachable. So the two halves of the same
 * problem met in the middle: the pages that need editing most are exactly the
 * pages that cannot own a CMS row.
 *
 * A copy region is a named, addressable slice of a coded page. Each region gets
 * its own `content` row under a reserved **`copy-` slug prefix**, which is what
 * keeps the two failure modes apart:
 *
 *   - **Routing.** `copy-home-hero` is not a route and never will be, so
 *     `getAllPublishedSlugs()` filters the prefix out of `generateStaticParams`
 *     and the sitemap excludes it too — a region can never become a public page
 *     at `/copy-home-hero`.
 *   - **Authorship.** A human typing `copy-*` in the editor is doing the one
 *     thing the prefix exists to prevent, so `describeCopyRegionSlugConflict`
 *     refuses it by name rather than letting them create an orphan.
 *
 * Everything here is pure. The registry is the single list of what is editable,
 * the pages render the fallback from it, and the overlay and the editorial
 * button both read it — three surfaces, one source, the same rule
 * `src/config/routes.ts` follows for navigation.
 */

/** Every copy region lives under this prefix in the `content.slug` column. */
export const COPY_REGION_SLUG_PREFIX = 'copy-';

/** One editable slice of a page. */
export interface CopyRegionDefinition {
  /** Suffix of the `content.slug` — `home-hero` → `copy-home-hero`. */
  id: string;
  /** What the admin sees in the editorial button and the region switcher. */
  label: string;
}

/**
 * What is editable, per pathname.
 *
 * A pathname absent from this map has no copy regions and behaves exactly as it
 * always did — a page is never half-registered. That matters more than it looks:
 * a registry that silently omits a route is a page that looks editable in the
 * editorial button and is not.
 */
export const PAGE_COPY_REGIONS: Readonly<Record<string, readonly CopyRegionDefinition[]>> = {
  '/': [
    { id: 'home-hero', label: 'Hero & Headline' },
    { id: 'home-pillars', label: 'Core Principles' },
    { id: 'home-voter-hub', label: 'Voter Education Hub' },
  ],
  '/about': [
    { id: 'about-mission', label: 'Mission Statement' },
    { id: 'about-who', label: 'Who We Are' },
    { id: 'about-nonviolence', label: 'Nonviolence Commitment' },
    { id: 'about-join', label: 'Join Our Next Gathering' },
  ],
  '/voter-info': [
    { id: 'voter-guides', label: 'Voter Rights & Guides' },
    { id: 'voter-hotlines', label: 'Elections & Hotlines' },
  ],
  '/choir': [{ id: 'choir-schedule', label: 'Rehearsal Schedule' }],
  '/donate': [{ id: 'donate-impact', label: 'Where Your Donation Goes' }],
  '/events': [{ id: 'events-trainings', label: 'Trainings & Action Labs' }],
} as const;

/**
 * Paths deliberately **not** registered, and why.
 *
 * `/faqs` is the one that looks like an oversight. Its Q&As are rendered into
 * FAQPage JSON-LD from the *same* `faqs` array the page renders, because Google
 * requires the visible text and the markup to match — mismatched FAQ markup is
 * grounds for a manual action. Making the visible list a copy region would let a
 * CMS row replace the text while the JSON-LD kept emitting the old answers, so
 * the page would actively ship the violation that structure exists to prevent.
 *
 * The fix is not "delete the JSON-LD". It is to derive both from one source,
 * which means the FAQ list becomes a region only once its answers are stored as
 * data the page and the markup both read. Until then, `/faqs` stays out of the
 * registry and its copy is edited where it already lives.
 */
export const COPY_REGION_OMISSIONS: Readonly<Record<string, string>> = {
  '/faqs':
    'FAQ JSON-LD is emitted from the same array the page renders; a CMS region would let the visible text and the structured data drift.',
} as const;

/** The region a plain `content.slug` addresses, or null when it is not one. */
export function copyRegionIdForSlug(slug: string): string | null {
  if (!slug.startsWith(COPY_REGION_SLUG_PREFIX)) return null;
  const id = slug.slice(COPY_REGION_SLUG_PREFIX.length);
  return id.length > 0 ? id : null;
}

/** True when this `content.slug` belongs to a copy region. */
export function isCopyRegionSlug(slug: string): boolean {
  return copyRegionIdForSlug(slug) !== null;
}

/** The `content.slug` a region id is stored under. */
export function copyRegionSlug(id: string): string {
  return `${COPY_REGION_SLUG_PREFIX}${id}`;
}

/** The copy regions registered for a pathname, in registry order. */
export function getPageCopyRegions(pathname: string): readonly CopyRegionDefinition[] {
  return PAGE_COPY_REGIONS[pathname] ?? [];
}

/** True when a pathname has any copy regions at all. */
export function pageHasCopyRegions(pathname: string): boolean {
  return getPageCopyRegions(pathname).length > 0;
}

/**
 * Why this slug cannot be hand-authored, or null when it is fine.
 *
 * The prefix is machine-owned. An author creating `copy-home-hero` by hand
 * produces a row no region renders and no route reaches — the shadowed-CMS
 * failure in a new costume, so it is refused at the same gate that refuses a
 * route shadowing.
 */
export function describeCopyRegionSlugConflict(slug: string): string | null {
  if (!isCopyRegionSlug(slug)) return null;
  const id = copyRegionIdForSlug(slug) as string;
  return `The "copy-" prefix is reserved for the site's editable copy regions (this page's regions are managed by the visual editor). "${id}" would be unreachable. Pick a different slug.`;
}
