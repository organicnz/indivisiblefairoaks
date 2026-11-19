// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeActionAlerts } from '../actions';

const {
  mockAdminClient,
  mockMaybeSingle,
  mockUpdate,
  mockInsert,
  mockActivityInsert,
  mockRateLimit,
  mockIsE2EMode,
  mockCreateConfirmation,
  mockSendConfirmation,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockUpdate = vi.fn();
  const mockInsert = vi.fn();
  const mockActivityInsert = vi.fn();
  const mockRateLimit = vi.fn();
  const mockIsE2EMode = vi.fn();
  const mockCreateConfirmation = vi.fn();
  const mockSendConfirmation = vi.fn();

  const mockAdminClient = {
    from: vi.fn((table: string) => {
      if (table === 'crm_contacts') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: mockMaybeSingle,
            })),
          })),
          update: vi.fn((payload) => ({
            eq: vi.fn((_col, _val) => mockUpdate(payload)),
          })),
          insert: vi.fn((payload) => ({
            select: vi.fn(() => ({
              single: vi.fn(() => mockInsert(payload)),
            })),
          })),
        };
      }
      if (table === 'crm_activities') {
        return {
          insert: mockActivityInsert,
        };
      }
      return {};
    }),
  };

  return {
    mockAdminClient,
    mockMaybeSingle,
    mockUpdate,
    mockInsert,
    mockActivityInsert,
    mockRateLimit,
    mockIsE2EMode,
    mockCreateConfirmation,
    mockSendConfirmation,
  };
});

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '127.0.0.1' }),
}));

vi.mock('@/lib/e2e-mode', () => ({
  isE2EMode: () => mockIsE2EMode(),
}));

vi.mock('@/lib/rate-limit', () => ({
  clientKey: (_h: Headers, scope: string) => `${scope}:127.0.0.1`,
  rateLimit: () => mockRateLimit(),
}));

vi.mock('@/lib/supabase-server', () => ({
  createAdminClient: async () => mockAdminClient,
}));

vi.mock('@/lib/newsletter-subscription', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/newsletter-subscription')>();
  return {
    ...actual,
    createNewsletterConfirmation: () => mockCreateConfirmation(),
    sendNewsletterConfirmation: (input: unknown) => mockSendConfirmation(input),
  };
});

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  return fd;
}

const confirmation = {
  token: '11111111-2222-4333-8444-555555555555',
  expiresAt: '2026-11-21T12:00:00.000Z',
  confirmationSentAt: '2026-11-19T12:00:00.000Z',
};

describe('subscribeActionAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsE2EMode.mockReturnValue(false);
    mockRateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ data: { id: 'contact-uuid-1' }, error: null });
    mockUpdate.mockResolvedValue({ error: null });
    mockActivityInsert.mockResolvedValue({ error: null });
    mockCreateConfirmation.mockReturnValue(confirmation);
    mockSendConfirmation.mockResolvedValue({ ok: true, id: 'email-1' });
  });

  it('silently accepts submissions when honeypot is populated', async () => {
    const fd = makeFormData({
      email: 'bot@spam.com',
      website: 'https://spammy-link.xyz',
    });

    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({
      success: true,
      message: 'Check your inbox and click the confirmation link to finish subscribing.',
      pendingConfirmation: true,
    });
    expect(mockAdminClient.from).not.toHaveBeenCalled();
    expect(mockSendConfirmation).not.toHaveBeenCalled();
  });

  it('rejects empty or whitespace-only email', async () => {
    const fd = makeFormData({ email: '   ' });
    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({ error: 'Please enter your email address.' });
  });

  it('rejects invalid email format', async () => {
    const fd = makeFormData({ email: 'not-an-email' });
    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({ error: 'Please enter a valid email address.' });
  });

  it('rejects control characters in identity fields', async () => {
    const fd = makeFormData({ email: 'test\x00@example.com' });
    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({ error: 'Please enter a valid email address.' });
  });

  it('rejects names exceeding 100 characters', async () => {
    const fd = makeFormData({
      email: 'alex@example.com',
      name: 'A'.repeat(101),
    });
    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({ error: 'Please enter a valid name (under 100 characters).' });
  });

  it('rejects when rate limit is exceeded', async () => {
    mockRateLimit.mockReturnValue({ ok: false, retryAfterSec: 42 });
    const fd = makeFormData({ email: 'resident@example.com' });

    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({
      error: 'Too many subscription attempts. Please try again in 42s.',
    });
  });

  it('short-circuits in E2E mode without contacting the database or sending mail', async () => {
    mockIsE2EMode.mockReturnValue(true);
    const fd = makeFormData({ email: 'e2e@example.com' });

    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({
      success: true,
      message: 'Check your inbox and click the confirmation link to finish subscribing.',
      pendingConfirmation: true,
    });
    expect(mockAdminClient.from).not.toHaveBeenCalled();
    expect(mockSendConfirmation).not.toHaveBeenCalled();
  });

  it('creates a never-asked contact and sends a confirmation without granting consent', async () => {
    const fd = makeFormData({
      email: 'new.activist@example.com',
      name: 'Taylor Reed',
    });

    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({
      success: true,
      message: 'Check your inbox and click the confirmation link to finish subscribing.',
      pendingConfirmation: true,
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertPayload = mockInsert.mock.calls[0][0];
    expect(insertPayload.email).toBe('new.activist@example.com');
    expect(insertPayload.first_name).toBe('Taylor Reed');
    expect(insertPayload.do_not_email).toBeNull();
    expect(insertPayload.newsletter_confirm_token).toBe(confirmation.token);
    expect(insertPayload.newsletter_confirm_expires_at).toBe(confirmation.expiresAt);
    expect(insertPayload.newsletter_confirmation_sent_at).toBe(confirmation.confirmationSentAt);
    expect(insertPayload.newsletter_confirmed_at).toBeUndefined();
    expect(insertPayload.tags).toEqual(['action-alerts', 'newsletter']);
    expect(mockSendConfirmation).toHaveBeenCalledWith({
      email: 'new.activist@example.com',
      firstName: 'Taylor Reed',
      token: confirmation.token,
    });
    expect(mockActivityInsert).toHaveBeenCalledTimes(1);
  });

  it('mints a new token for an existing unconfirmed contact without changing consent', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'contact-uuid-101',
        email: 'active.member@example.com',
        first_name: null,
        tags: ['town-hall-2025'],
        do_not_email: false,
        unsubscribed_at: null,
        newsletter_confirmed_at: null,
        newsletter_confirm_token: null,
        newsletter_confirm_expires_at: null,
      },
      error: null,
    });

    const result = await subscribeActionAlerts(
      makeFormData({ email: 'active.member@example.com', name: 'Morgan' })
    );
    expect(result).toEqual({
      success: true,
      message: 'Check your inbox and click the confirmation link to finish subscribing.',
      pendingConfirmation: true,
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updatePayload = mockUpdate.mock.calls[0][0];
    expect(updatePayload).not.toHaveProperty('do_not_email');
    expect(updatePayload).not.toHaveProperty('unsubscribed_at');
    expect(updatePayload.newsletter_confirm_token).toBe(confirmation.token);
    expect(updatePayload.newsletter_confirm_expires_at).toBe(confirmation.expiresAt);
    expect(updatePayload.first_name).toBe('Morgan');
    expect(updatePayload.tags).toEqual(['action-alerts', 'newsletter', 'town-hall-2025']);
    expect(mockSendConfirmation).toHaveBeenCalledWith({
      email: 'active.member@example.com',
      firstName: 'Morgan',
      token: confirmation.token,
    });
  });

  it('lets a previously unsubscribed address start a fresh confirmation without clearing the opt-out', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'contact-uuid-100',
        email: 'former.member@example.com',
        first_name: 'Sam',
        tags: [],
        do_not_email: true,
        unsubscribed_at: '2026-09-01T00:00:00Z',
        newsletter_confirmed_at: null,
        newsletter_confirm_token: null,
        newsletter_confirm_expires_at: null,
      },
      error: null,
    });

    const result = await subscribeActionAlerts(
      makeFormData({ email: 'former.member@example.com' })
    );
    expect(result).toMatchObject({ success: true, pendingConfirmation: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updatePayload = mockUpdate.mock.calls[0][0];
    expect(updatePayload).not.toHaveProperty('do_not_email');
    expect(updatePayload).not.toHaveProperty('unsubscribed_at');
    expect(mockSendConfirmation).toHaveBeenCalledTimes(1);
  });

  it('does not send another message to a contact who has already confirmed', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'contact-uuid-102',
        email: 'confirmed.member@example.com',
        first_name: 'Robin',
        tags: ['action-alerts', 'newsletter', 'newsletter-confirmed'],
        do_not_email: false,
        unsubscribed_at: null,
        newsletter_confirmed_at: '2026-11-01T00:00:00Z',
        newsletter_confirm_token: null,
        newsletter_confirm_expires_at: null,
      },
      error: null,
    });

    const result = await subscribeActionAlerts(
      makeFormData({ email: 'confirmed.member@example.com' })
    );
    expect(result).toEqual({
      success: true,
      message: 'This address is already subscribed to Action Alerts.',
      alreadySubscribed: true,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSendConfirmation).not.toHaveBeenCalled();
  });

  it('surfaces a lookup failure without attempting an insert or send', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection reset' },
    });

    const result = await subscribeActionAlerts(
      makeFormData({ email: 'lookup.failure@example.com' })
    );
    expect(result).toEqual({
      error:
        'Unable to process your subscription right now. Please try again or email us directly.',
    });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSendConfirmation).not.toHaveBeenCalled();
  });

  it('reports a failed contact insert without sending a confirmation', async () => {
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database connection terminated' },
    });

    const result = await subscribeActionAlerts(makeFormData({ email: 'error.test@example.com' }));
    expect(result).toEqual({
      error: 'Failed to save the subscription request. Please email us directly.',
    });
    expect(mockSendConfirmation).not.toHaveBeenCalled();
  });

  it('reports an existing-contact update failure without sending a confirmation', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'contact-uuid-103',
        email: 'update.failure@example.com',
        first_name: null,
        tags: [],
        do_not_email: null,
        unsubscribed_at: null,
        newsletter_confirmed_at: null,
        newsletter_confirm_token: null,
        newsletter_confirm_expires_at: null,
      },
      error: null,
    });
    mockUpdate.mockResolvedValueOnce({ error: { message: 'write failed' } });

    const result = await subscribeActionAlerts(
      makeFormData({ email: 'update.failure@example.com' })
    );
    expect(result).toEqual({
      error: 'Failed to save the subscription request. Please email us directly.',
    });
    expect(mockSendConfirmation).not.toHaveBeenCalled();
  });

  it('keeps the pending token and reports when the confirmation email fails', async () => {
    mockSendConfirmation.mockResolvedValueOnce({
      ok: false,
      status: 503,
      error: 'provider down',
    });

    const result = await subscribeActionAlerts(makeFormData({ email: 'mail.failure@example.com' }));
    expect(result).toEqual({
      error:
        'We could not send the confirmation email right now. Please try again, or email contact@indivisiblefairoaks.org.',
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockActivityInsert).not.toHaveBeenCalled();
  });
});
