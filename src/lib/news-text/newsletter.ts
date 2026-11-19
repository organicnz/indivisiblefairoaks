import type { NewsletterTextFields } from './search';

/** The public card's summary width; key facts should fit inside it. */
export const NEWSLETTER_CARD_EXCERPT_LENGTH = 220;

/**
 * Row ordering and merge helpers for the bulletin archive. Text statistics and
 * topic parsing live in `newsletter-stats.ts` and `newsletter-topics.ts` so a
 * change to one does not put the others at risk.
 */

/** Stable archive order: explicit sort order first, then title. */
export function sortNewsletters<T extends NewsletterTextFields>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  );
}

/**
 * Replace the edited row and remove a stale slug after a rename.
 *
 * Both the public archive and the admin manager previously carried their own
 * filter-and-append logic. A rename changes the slug, so matching only the
 * saved slug left the old card behind and added a second one.
 */
export function mergeNewsletterRows<T extends NewsletterTextFields & { slug: string }>(
  items: readonly T[],
  saved: T,
  previousSlug: string | null
): T[] {
  const withoutOld = items.filter(
    (item) => item.slug !== saved.slug && (!previousSlug || item.slug !== previousSlug)
  );
  return sortNewsletters([...withoutOld, saved]);
}
