/**
 * Which unreachable content rows may be archived, and which still need a human.
 *
 * These lists mirror `docs/content-row-disposition.md`. They are explicit on
 * purpose: a newly unreachable row is `unknown`, not an archive candidate just
 * because the admin filter can see it. That keeps a future cleanup from
 * deleting copy nobody reviewed.
 */
export const ARCHIVE_REVIEW_SLUGS = [
  'home',
  'about-us',
  'privacy-policy',
  'terms-and-conditions',
  'shipping-returns',
  'faqs',
] as const;

export const ARCHIVE_CANDIDATE_SLUGS = [
  'upcoming-events',
  'good-trouble',
  'weekend-of-protest-song',
  'upcoming-fall-events',
  'resistance-choir',
  'voter-information',
  'newsletters',
  'coalition-links',
] as const;

export type ArchiveDisposition = 'candidate' | 'review' | 'unknown';

const REVIEW = new Set<string>(ARCHIVE_REVIEW_SLUGS);
const CANDIDATES = new Set<string>(ARCHIVE_CANDIDATE_SLUGS);

export function archiveDisposition(slug: string): ArchiveDisposition {
  if (REVIEW.has(slug)) return 'review';
  if (CANDIDATES.has(slug)) return 'candidate';
  return 'unknown';
}

export interface ArchivePlanRow {
  id: number;
  slug: string;
  title: string;
  type: string;
}

export interface ArchivePlan<T extends ArchivePlanRow> {
  candidates: T[];
  review: T[];
  unknown: T[];
}

/** Group rows without changing them; callers decide whether to act. */
export function groupArchiveRows<T extends ArchivePlanRow>(rows: readonly T[]): ArchivePlan<T> {
  const plan: ArchivePlan<T> = { candidates: [], review: [], unknown: [] };
  for (const row of rows) {
    const disposition = archiveDisposition(row.slug);
    if (disposition === 'candidate') plan.candidates.push(row);
    else if (disposition === 'review') plan.review.push(row);
    else plan.unknown.push(row);
  }
  return plan;
}
