import { z } from 'zod';
import { foldSpecialLetters } from './news-text/normalize';
import { normalizeNewsletterTopics } from './news-text/topics';

export { normalizeNewsletterTopics } from './news-text/topics';

/**
 * One contract for bulletin writes.
 *
 * The admin modal, the server action and the JSON route all used to carry their
 * own copy of the validation rules. They disagreed on the details that matter —
 * an empty date, a topic list with no bound, and an arbitrary publication string
 * that only failed when Postgres tried to parse it. Keeping the shape here means
 * a fix reaches every write path at once.
 */
export const NEWSLETTER_LIMITS = {
  title: 200,
  dateLabel: 100,
  description: 2000,
  body: 100_000,
  url: 500,
  slug: 120,
  topic: 60,
  topics: 12,
  /** A pasted list is deliberately larger than one topic chip. */
  topicInput: 800,
} as const;

export function slugifyNewsletter(text: string): string {
  return foldSpecialLetters(
    text
      .normalize('NFKD')
      // Strip combining marks so "Café" becomes "cafe", not "caf".
      .replace(/[\u0300-\u036F]/g, '')
      .toLowerCase()
      .trim()
  )
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * A blank optional URL is stored as NULL, not as an empty string that the public
 * card has to keep treating as a link. Only absolute HTTP(S) addresses are
 * accepted so a pasted `javascript:` or relative value cannot become an anchor.
 */
const optionalNewsletterUrl = z
  .union([z.string().trim().max(NEWSLETTER_LIMITS.url), z.null(), z.undefined()])
  // The explicit `undefined` member does not make an object property optional
  // in Zod 4; `.optional()` is what lets older clients omit the field entirely.
  .optional()
  .transform((value) => (typeof value === 'string' && value.trim() ? value.trim() : null))
  .refine(
    (value) => {
      if (value === null) return true;
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Use a full http:// or https:// link' }
  );

export const newsletterInputSchema = z.object({
  /** Optional override; the action derives one from the title when omitted. */
  slug: z.string().trim().max(NEWSLETTER_LIMITS.slug).optional(),
  /** The slug of the row being edited, never the row's new slug. */
  original_slug: z.string().trim().max(NEWSLETTER_LIMITS.slug).optional(),
  title: z.string().trim().min(1, 'Title is required').max(NEWSLETTER_LIMITS.title),
  date_label: z
    .string()
    .trim()
    .min(1, 'Issue / date label is required')
    .max(NEWSLETTER_LIMITS.dateLabel),
  description: z
    .string()
    .trim()
    .min(1, 'A short summary is required')
    .max(NEWSLETTER_LIMITS.description),
  /** Plain-text full issue. A bulletin can still be summary-only. */
  body: z.string().trim().max(NEWSLETTER_LIMITS.body).default(''),
  /** Durable external copies, optional because older rows have neither. */
  pdf_url: optionalNewsletterUrl,
  archive_url: optionalNewsletterUrl,
  topics: z
    .array(z.string().trim().min(1, 'Topics cannot be empty').max(NEWSLETTER_LIMITS.topic))
    .max(NEWSLETTER_LIMITS.topics, `Use ${NEWSLETTER_LIMITS.topics} topics or fewer`)
    .default([])
    .transform((topics) => normalizeNewsletterTopics(topics)),
  sort_order: z.number().int().min(-100_000).max(100_000).default(0),
  /**
   * ISO instant. A blank value means "publish now" on write; a future value
   * schedules the bulletin and the public filters hide it until then.
   */
  published_at: z
    .string()
    .trim()
    .datetime({ offset: true, message: 'Publication time must be a valid instant' })
    .nullable()
    .optional(),
});

export type NewsletterInput = z.input<typeof newsletterInputSchema>;
export type NewsletterPayload = z.output<typeof newsletterInputSchema>;

export type NewsletterPublicationState = 'published' | 'scheduled';

/**
 * The public archive treats a null timestamp as already published (legacy
 * rows), so the admin label must not call it a draft. A future timestamp is the
 * one and only scheduled state the current schema supports.
 */
export function newsletterPublicationState(
  publishedAt: string | null | undefined,
  now = Date.now()
): NewsletterPublicationState {
  if (!publishedAt) return 'published';
  const instant = Date.parse(publishedAt);
  return Number.isFinite(instant) && instant > now ? 'scheduled' : 'published';
}

export function newsletterPublicationLabel(
  publishedAt: string | null | undefined,
  now = Date.now()
): 'Scheduled' | 'Published' {
  return newsletterPublicationState(publishedAt, now) === 'scheduled' ? 'Scheduled' : 'Published';
}
