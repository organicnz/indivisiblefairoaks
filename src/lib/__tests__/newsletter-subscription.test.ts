// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSendEmail, mockIsE2EMode } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockIsE2EMode: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    NEXT_PUBLIC_SITE_URL: 'https://test.indivisiblefairoaks.org',
    RESEND_API_KEY: 're_test_key',
    RESEND_FROM_EMAIL: 'contact@indivisiblefairoaks.org',
  },
}));

vi.mock('@/lib/e2e-mode', () => ({
  isE2EMode: () => mockIsE2EMode(),
}));

vi.mock('@/lib/email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email')>();
  return { ...actual, sendEmail: mockSendEmail };
});

import {
  ACTION_ALERTS_TAG,
  buildBulletinBroadcast,
  buildNewsletterConfirmationEmail,
  createNewsletterConfirmation,
  isNewsletterConfirmationLive,
  NEWSLETTER_CONFIRMATION_TTL_MS,
  NEWSLETTER_CONFIRMED_TAG,
  NEWSLETTER_SOURCE_TAG,
  newsletterConfirmationUrl,
  sendNewsletterConfirmation,
  withNewsletterConfirmationTags,
  withNewsletterRequestTags,
  withoutNewsletterConfirmationTag,
} from '@/lib/newsletter-subscription';

describe('newsletter confirmation state', () => {
  it('mints a single-use UUID with a 48-hour expiry', () => {
    const now = Date.parse('2026-11-19T12:00:00Z');
    const confirmation = createNewsletterConfirmation(now);

    expect(confirmation.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(confirmation.confirmationSentAt).toBe('2026-11-19T12:00:00.000Z');
    expect(Date.parse(confirmation.expiresAt) - now).toBe(NEWSLETTER_CONFIRMATION_TTL_MS);
  });

  it('accepts only a future expiry', () => {
    const now = Date.parse('2026-11-19T12:00:00Z');
    expect(isNewsletterConfirmationLive('2026-11-19T12:00:01Z', now)).toBe(true);
    expect(isNewsletterConfirmationLive('2026-11-19T11:59:59Z', now)).toBe(false);
    expect(isNewsletterConfirmationLive('2026-11-19T12:00:00Z', now)).toBe(false);
    expect(isNewsletterConfirmationLive(null, now)).toBe(false);
    expect(isNewsletterConfirmationLive('not-a-date', now)).toBe(false);
  });

  it('builds request tags without claiming confirmation', () => {
    expect(
      withNewsletterRequestTags(['Town Hall', 'newsletter-confirmed', 'ACTION-ALERTS'])
    ).toEqual([ACTION_ALERTS_TAG, NEWSLETTER_SOURCE_TAG, 'town hall']);
  });

  it('prioritises the required confirmed tags when a row is at the cap', () => {
    const tags = Array.from({ length: 25 }, (_, index) => `tag-${index}`);
    const confirmed = withNewsletterConfirmationTags(tags);

    expect(confirmed).toHaveLength(20);
    expect(confirmed.slice(0, 3)).toEqual([
      ACTION_ALERTS_TAG,
      NEWSLETTER_SOURCE_TAG,
      NEWSLETTER_CONFIRMED_TAG,
    ]);
    expect(confirmed).toContain('tag-0');
  });

  it('removes only the confirmation marker on unsubscribe', () => {
    expect(
      withoutNewsletterConfirmationTag(['action-alerts', 'newsletter', 'newsletter-confirmed'])
    ).toEqual(['action-alerts', 'newsletter']);
  });

  it('builds an absolute confirmation URL and normalises the site origin', () => {
    expect(newsletterConfirmationUrl('abc', 'https://example.org/')).toBe(
      'https://example.org/api/newsletter/confirm?token=abc'
    );
    expect(newsletterConfirmationUrl('a b')).toBe(
      'https://test.indivisiblefairoaks.org/api/newsletter/confirm?token=a%20b'
    );
  });
});

describe('newsletter confirmation email', () => {
  it('greets the requester, escapes their name, and carries the confirmation link', () => {
    const email = buildNewsletterConfirmationEmail({
      email: 'member@example.com',
      firstName: '<b>Robin</b>\u0000',
      token: 'token-1',
      siteUrl: 'https://example.org',
    });

    expect(email.to).toBe('member@example.com');
    expect(email.subject).toBe('Confirm your chapter bulletin subscription');
    expect(email.html).toContain('Hi &lt;b&gt;Robin&lt;/b&gt;,');
    expect(email.html).not.toContain('<b>Robin</b>');
    expect(email.html).not.toContain('\u0000');
    expect(email.text).not.toContain('\u0000');
    expect(email.html).toContain('https://example.org/api/newsletter/confirm?token=token-1');
    expect(email.html).toContain('You are not subscribed until you confirm');
    expect(email.text).toContain('https://example.org/api/newsletter/confirm?token=token-1');
    expect(email.text).toContain('expires in 48 hours');
    expect(email.tags).toEqual([{ name: 'type', value: 'newsletter-confirmation' }]);
  });

  it('falls back to a neutral greeting and the configured origin', () => {
    const email = buildNewsletterConfirmationEmail({
      email: 'member@example.com',
      firstName: '   ',
      token: 'token-2',
    });

    expect(email.html).toContain('Hi neighbor,');
    expect(email.html).toContain('https://test.indivisiblefairoaks.org/api/newsletter/confirm');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsE2EMode.mockReturnValue(false);
    mockSendEmail.mockResolvedValue({ ok: true, id: 'email-1' });
  });

  it('sends through the existing Resend helper', async () => {
    const result = await sendNewsletterConfirmation({
      email: 'member@example.com',
      token: 'token-3',
    });

    expect(result).toEqual({ ok: true, id: 'email-1' });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'member@example.com',
        subject: 'Confirm your chapter bulletin subscription',
      })
    );
  });

  it('refuses to send from an E2E build', async () => {
    mockIsE2EMode.mockReturnValue(true);
    const result = await sendNewsletterConfirmation({
      email: 'member@example.com',
      token: 'token-4',
    });

    expect(result).toEqual({ ok: false, error: 'e2e-mode', status: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe('buildBulletinBroadcast', () => {
  it('turns a full issue into the reviewed broadcast body', () => {
    const { subject, body } = buildBulletinBroadcast({
      title: '  November Bulletin  ',
      dateLabel: 'November 2026',
      description: 'What we are doing this month.',
      body: 'First paragraph.\n\nSecond paragraph.',
      pdfUrl: 'https://example.org/issue.pdf',
      archiveUrl: 'https://example.org/archive/issue',
      slug: 'november-bulletin',
      siteUrl: 'https://example.org/',
    });

    expect(subject).toBe('Chapter Bulletin: November Bulletin');
    expect(body).toContain('November 2026');
    expect(body).toContain('What we are doing this month.');
    expect(body).toContain('Second paragraph.');
    expect(body).toContain('PDF: https://example.org/issue.pdf');
    expect(body).toContain('Archive: https://example.org/archive/issue');
    expect(body).toContain(
      'Read this issue online: https://example.org/newsletters/november-bulletin'
    );
    expect(subject).not.toContain('\n');
  });

  it('supports a summary-only issue and omits empty links', () => {
    const { body } = buildBulletinBroadcast({
      title: 'Summary only',
      dateLabel: 'October 2026',
      description: 'One update.',
      body: '   ',
      pdfUrl: null,
      archiveUrl: '',
      slug: 'a/b',
      siteUrl: 'https://example.org',
    });

    expect(body).not.toContain('PDF:');
    expect(body).not.toContain('Archive:');
    expect(body).toContain('https://example.org/newsletters/a%2Fb');
  });

  it('collapses header-breaking whitespace in the subject', () => {
    const { subject } = buildBulletinBroadcast({
      title: 'November\r\nBcc: victim@example.com',
      dateLabel: 'November 2026',
      description: 'Update',
      slug: 'november',
    });

    expect(subject).toBe('Chapter Bulletin: November Bcc: victim@example.com');
    expect(subject).not.toContain('\n');
  });
});
