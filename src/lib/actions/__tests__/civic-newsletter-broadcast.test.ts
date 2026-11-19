// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCivicNewsletterAudience,
  sendCivicNewsletterBroadcast,
  sendCivicNewsletterTest,
} from '../civic-newsletter-broadcast';

const {
  mockFrom,
  mockMaybeSingle,
  mockRequireAdmin,
  mockSendBroadcast,
  mockSendSelfTest,
  mockCount,
  mockBlocked,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: mockMaybeSingle,
      })),
    })),
  }));
  const mockRequireAdmin = vi.fn();
  const mockSendBroadcast = vi.fn();
  const mockSendSelfTest = vi.fn();
  const mockCount = vi.fn();
  const mockBlocked = vi.fn();
  return {
    mockFrom,
    mockMaybeSingle,
    mockRequireAdmin,
    mockSendBroadcast,
    mockSendSelfTest,
    mockCount,
    mockBlocked,
  };
});

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    NEXT_PUBLIC_SITE_URL: 'https://test.indivisiblefairoaks.org',
  },
}));

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock('@/lib/actions/crm/broadcasts', () => ({
  sendCRMBroadcast: (...args: unknown[]) => mockSendBroadcast(...args),
  sendCRMBroadcastSelfTest: (...args: unknown[]) => mockSendSelfTest(...args),
  getBroadcastRecipientCount: (...args: unknown[]) => mockCount(...args),
}));

vi.mock('@/lib/actions/crm/shared', () => ({
  sendBlockedInE2E: () => mockBlocked(),
}));

const newsletter = {
  slug: 'november-bulletin',
  title: 'November Bulletin',
  date_label: 'November 2026',
  description: 'What we are doing this month.',
  body: 'The full issue.',
  pdf_url: 'https://example.org/issue.pdf',
  archive_url: null,
  published_at: '2026-11-01T00:00:00Z',
};

describe('sendCivicNewsletterTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlocked.mockReturnValue(null);
    mockSendSelfTest.mockResolvedValue({ success: true, recipient: 'admin@example.org' });
  });

  it('refuses in an E2E build before validating or sending', async () => {
    mockBlocked.mockReturnValue({ success: false, error: 'Sending is disabled in test builds.' });

    const result = await sendCivicNewsletterTest({
      title: 'Bulletin',
      dateLabel: 'November',
      description: 'Summary',
    });

    expect(result).toEqual({ success: false, error: 'Sending is disabled in test builds.' });
    expect(mockSendSelfTest).not.toHaveBeenCalled();
  });

  it.each([
    [
      { title: '', dateLabel: 'November', description: 'Summary' },
      'Give the bulletin a title before sending.',
    ],
    [
      { title: 'x'.repeat(201), dateLabel: 'November', description: 'Summary' },
      'Titles are limited to 200 characters.',
    ],
    [
      { title: 'Bulletin', dateLabel: '', description: 'Summary' },
      'Add the issue or date label before sending.',
    ],
    [
      { title: 'Bulletin', dateLabel: 'x'.repeat(101), description: 'Summary' },
      'Issue labels are limited to 100 characters.',
    ],
    [
      { title: 'Bulletin', dateLabel: 'November', description: '' },
      'Add a short summary before sending.',
    ],
    [
      { title: 'Bulletin', dateLabel: 'November', description: 'x'.repeat(2001) },
      'Summaries are limited to 2000 characters.',
    ],
    [
      {
        title: 'Bulletin',
        dateLabel: 'November',
        description: 'Summary',
        body: 'x'.repeat(100_001),
      },
      'The full issue is limited to 100000 characters.',
    ],
  ])('validates the draft before sending: %j', async (draft, message) => {
    const result = await sendCivicNewsletterTest(draft);
    expect(result).toEqual({ success: false, error: message });
    expect(mockSendSelfTest).not.toHaveBeenCalled();
  });

  it('builds the same issue body and delegates the test to the CRM self-test path', async () => {
    const result = await sendCivicNewsletterTest({
      title: '  November Bulletin  ',
      dateLabel: 'November 2026',
      description: 'What we are doing this month.',
      body: 'The full issue.',
      pdfUrl: 'https://example.org/issue.pdf',
      slug: 'november-bulletin',
    });

    expect(result).toEqual({ success: true, testRecipient: 'admin@example.org' });
    expect(mockSendSelfTest).toHaveBeenCalledTimes(1);
    const payload = mockSendSelfTest.mock.calls[0][0] as { subject: string; body: string };
    expect(payload.subject).toBe('Chapter Bulletin: November Bulletin');
    expect(payload.body).toContain(
      'https://test.indivisiblefairoaks.org/newsletters/november-bulletin'
    );
    expect(payload.body).toContain('PDF: https://example.org/issue.pdf');
  });

  it('derives a slug when the draft has none and reports provider failures', async () => {
    mockSendSelfTest.mockResolvedValueOnce({ success: false, error: 'provider down' });

    const result = await sendCivicNewsletterTest({
      title: 'Café & Conversation',
      dateLabel: 'November 2026',
      description: 'Summary',
      slug: '   ',
    });

    expect(result).toEqual({ success: false, error: 'provider down' });
    const payload = mockSendSelfTest.mock.calls[0][0] as { body: string };
    expect(payload.body).toContain('/newsletters/cafe-conversation');
  });
});

describe('getCivicNewsletterAudience', () => {
  it('counts through the newsletter-confirmed audience gate', async () => {
    mockCount.mockResolvedValue({ count: 42, excludedCount: 3 });

    await expect(getCivicNewsletterAudience()).resolves.toEqual({
      count: 42,
      excludedCount: 3,
    });
    expect(mockCount).toHaveBeenCalledWith({ newsletterConfirmedOnly: true });
  });
});

describe('sendCivicNewsletterBroadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlocked.mockReturnValue(null);
    mockRequireAdmin.mockResolvedValue({ adminClient: { from: mockFrom } });
    mockMaybeSingle.mockResolvedValue({ data: newsletter, error: null });
    mockSendBroadcast.mockResolvedValue({
      success: true,
      recipientCount: 42,
      broadcastId: 'broadcast-1',
      warning: 'ledger delayed',
    });
  });

  it('refuses blank slugs and test builds', async () => {
    await expect(sendCivicNewsletterBroadcast('   ')).resolves.toEqual({
      success: false,
      error: 'Choose a bulletin before sending.',
    });

    mockBlocked.mockReturnValue({ success: false, error: 'Sending is disabled in test builds.' });
    await expect(sendCivicNewsletterBroadcast('november-bulletin')).resolves.toEqual({
      success: false,
      error: 'Sending is disabled in test builds.',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('reports a read failure and a missing bulletin', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'db offline' } });
    await expect(sendCivicNewsletterBroadcast('november-bulletin')).resolves.toEqual({
      success: false,
      error: 'db offline',
    });

    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(sendCivicNewsletterBroadcast('november-bulletin')).resolves.toEqual({
      success: false,
      error: 'That bulletin no longer exists.',
    });
    expect(mockSendBroadcast).not.toHaveBeenCalled();
  });

  it('refuses to email an issue scheduled for the future', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { ...newsletter, published_at: '2099-01-01T00:00:00Z' },
      error: null,
    });

    const result = await sendCivicNewsletterBroadcast('november-bulletin');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/scheduled for a future date/i);
    expect(mockSendBroadcast).not.toHaveBeenCalled();
  });

  it('sends a published issue only to confirmed subscribers and records its source', async () => {
    const result = await sendCivicNewsletterBroadcast('november-bulletin');

    expect(result).toEqual({
      success: true,
      warning: 'ledger delayed',
      recipientCount: 42,
      broadcastId: 'broadcast-1',
    });
    expect(mockSendBroadcast).toHaveBeenCalledTimes(1);
    const payload = mockSendBroadcast.mock.calls[0][0] as {
      subject: string;
      body: string;
      newsletterConfirmedOnly: boolean;
      sourceNewsletterSlug: string;
    };
    expect(payload.subject).toBe('Chapter Bulletin: November Bulletin');
    expect(payload.body).toContain('The full issue.');
    expect(payload.body).toContain(
      'https://test.indivisiblefairoaks.org/newsletters/november-bulletin'
    );
    expect(payload.newsletterConfirmedOnly).toBe(true);
    expect(payload.sourceNewsletterSlug).toBe('november-bulletin');
  });

  it('passes through a sender refusal and turns an unexpected sender fault into a result', async () => {
    mockSendBroadcast.mockResolvedValueOnce({
      success: false,
      error:
        'This bulletin already has an active or completed email campaign. Check the campaign log before sending it again.',
    });

    await expect(sendCivicNewsletterBroadcast('november-bulletin')).resolves.toEqual({
      success: false,
      error:
        'This bulletin already has an active or completed email campaign. Check the campaign log before sending it again.',
    });

    mockSendBroadcast.mockRejectedValueOnce(new Error('sender crashed'));
    await expect(sendCivicNewsletterBroadcast('november-bulletin')).resolves.toEqual({
      success: false,
      error: 'sender crashed',
    });
  });

  it('does not swallow an admin redirect or authentication fault', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('admin session expired'));
    await expect(sendCivicNewsletterBroadcast('november-bulletin')).rejects.toThrow(
      'admin session expired'
    );
  });
});
