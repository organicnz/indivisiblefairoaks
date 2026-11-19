// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  NEWSLETTER_LIMITS,
  newsletterInputSchema,
  newsletterPublicationLabel,
  newsletterPublicationState,
  normalizeNewsletterTopics,
  slugifyNewsletter,
} from '@/lib/newsletters';

const base = {
  title: 'Summer Action Bulletin',
  date_label: 'July 2026',
  description: 'A short summary of the chapter bulletin.',
};

describe('newsletter contract', () => {
  it('slugifies human titles into a stable public identifier', () => {
    expect(slugifyNewsletter('Summer Action Bulletin & Town Hall!')).toBe(
      'summer-action-bulletin-town-hall'
    );
    expect(slugifyNewsletter('Café Night')).toBe('cafe-night');
    expect(slugifyNewsletter('Søren & Straße')).toBe('soren-strasse');
    expect(slugifyNewsletter('  --  ')).toBe('');
  });

  it('trims, drops empties and removes case-insensitive duplicate topics', () => {
    expect(
      normalizeNewsletterTopics([
        ' Election Defense ',
        'election defense',
        'Election   Defense',
        '',
        'Choir Actions',
        'Café',
        'CAFÉ',
        '  ',
      ])
    ).toEqual(['Election Defense', 'Choir Actions', 'Café']);
    expect(normalizeNewsletterTopics(['Søren', 'Soren'])).toEqual(['Søren']);
  });

  it('defaults topics and trims written fields', () => {
    const parsed = newsletterInputSchema.parse({
      ...base,
      title: '  Summer Action Bulletin  ',
      description: '  A short summary.  ',
    });

    expect(parsed.title).toBe('Summer Action Bulletin');
    expect(parsed.description).toBe('A short summary.');
    expect(parsed.body).toBe('');
    expect(parsed.pdf_url).toBeNull();
    expect(parsed.archive_url).toBeNull();
    expect(parsed.topics).toEqual([]);
    expect(parsed.sort_order).toBe(0);
  });

  it('keeps full-issue text and accepts only durable HTTP links', () => {
    const parsed = newsletterInputSchema.parse({
      ...base,
      body: '  First paragraph.\n\nSecond paragraph.  ',
      pdf_url: ' https://cdn.example.org/bulletin.pdf ',
      archive_url: '',
    });

    expect(parsed.body).toBe('First paragraph.\n\nSecond paragraph.');
    expect(parsed.pdf_url).toBe('https://cdn.example.org/bulletin.pdf');
    expect(parsed.archive_url).toBeNull();

    expect(
      newsletterInputSchema.safeParse({ ...base, pdf_url: 'javascript:alert(1)' }).success
    ).toBe(false);
    expect(
      newsletterInputSchema.safeParse({ ...base, archive_url: '/archive/issue' }).success
    ).toBe(false);
  });

  it('requires a readable summary and a real publication instant', () => {
    const noSummary = newsletterInputSchema.safeParse({ ...base, description: '   ' });
    expect(noSummary.success).toBe(false);

    const badDate = newsletterInputSchema.safeParse({
      ...base,
      published_at: 'next Tuesday',
    });
    expect(badDate.success).toBe(false);
  });

  it('rejects an unbounded topic list', () => {
    const parsed = newsletterInputSchema.safeParse({
      ...base,
      topics: Array.from({ length: NEWSLETTER_LIMITS.topics + 1 }, (_, index) => `Topic ${index}`),
    });
    expect(parsed.success).toBe(false);
  });

  it('treats a future instant as scheduled and a past or null instant as published', () => {
    const now = Date.parse('2026-07-01T12:00:00Z');
    expect(newsletterPublicationState('2026-07-02T00:00:00Z', now)).toBe('scheduled');
    expect(newsletterPublicationState('2026-06-30T00:00:00Z', now)).toBe('published');
    expect(newsletterPublicationState(null, now)).toBe('published');
    expect(newsletterPublicationLabel('2026-07-02T00:00:00Z', now)).toBe('Scheduled');
  });
});
