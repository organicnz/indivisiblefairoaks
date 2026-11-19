import { z } from 'zod';
import { collapseNewsWhitespace, normalizeNewsText } from './news-text/normalize';

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
  slug: 120,
  topic: 60,
  topics: 12,
  /** A pasted list is deliberately larger than one topic chip. */
  topicInput: 800,
} as const;

const SPECIAL_LETTER_FOLDS: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ı: 'i',
  ħ: 'h',
  ŋ: 'n',
  ŧ: 't',
};

function foldSpecialLetters(value: string): string {
  return value.replace(/[ßæœøłđðþıħŋŧ]/g, (letter) => SPECIAL_LETTER_FOLDS[letter] ?? letter);
}

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

/** Topic identity must match the read-side search fold. */
export function newsletterTopicKey(value: string): string {
  return normalizeNewsText(collapseNewsWhitespace(value));
}

/**
 * Trim, drop empties and collapse case-insensitive duplicates.
 *
 * The previous action stored whatever the caller sent, so a repeated tag
 * rendered twice and an empty chip rendered as a blank box. The public archive
 * treats topics as a set; the write path should make that true.
 */
export function normalizeNewsletterTopics(topics: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const topic of topics) {
    const value = collapseNewsWhitespace(topic);
    if (!value) continue;
    const key = newsletterTopicKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
}

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
  topics: z
    .array(
      z.string().trim().min(1, 'Topics cannot be empty').max(NEWSLETTER_LIMITS.topic)
    )
    .max(
      NEWSLETTER_LIMITS.topics,
      `Use ${NEWSLETTER_LIMITS.topics} topics or fewer`
    )
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
  return newsletterPublicationState(publishedAt, now) === 'scheduled'
    ? 'Scheduled'
    : 'Published';
}
