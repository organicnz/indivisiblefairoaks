// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/newsletter/confirm/route';

const { mockAdminClient, mockContact, mockUpdate, mockActivityInsert, mockRateLimit } = vi.hoisted(
  () => {
    const mockContact = vi.fn();
    const mockUpdate = vi.fn();
    const mockActivityInsert = vi.fn();
    const mockRateLimit = vi.fn();

    const mockAdminClient = {
      from: vi.fn((table: string) => {
        if (table === 'crm_contacts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: mockContact,
              })),
            })),
            update: vi.fn((payload) => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  gt: vi.fn(() => ({
                    select: vi.fn(() => ({
                      maybeSingle: vi.fn(() => mockUpdate(payload)),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'crm_activities') {
          return { insert: mockActivityInsert };
        }
        return {};
      }),
    };

    return { mockAdminClient, mockContact, mockUpdate, mockActivityInsert, mockRateLimit };
  }
);

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    NEXT_PUBLIC_SITE_URL: 'https://test.indivisiblefairoaks.org',
  },
}));

vi.mock('@/lib/supabase-server', () => ({
  createAdminClient: async () => mockAdminClient,
}));

vi.mock('@/lib/rate-limit', () => ({
  clientKey: (_h: Headers, scope: string) => `${scope}:127.0.0.1`,
  rateLimit: () => mockRateLimit(),
}));

const token = '11111111-2222-4333-8444-555555555555';

const contact = {
  id: 'contact-1',
  email: 'member@example.com',
  first_name: 'Robin',
  tags: ['town-hall'],
  newsletter_confirmed_at: null,
  newsletter_confirm_expires_at: '2099-01-01T00:00:00Z',
};

function confirmRequest(body?: Record<string, string>) {
  const url = `https://test.indivisiblefairoaks.org/api/newsletter/confirm?token=${token}`;
  if (!body) return new Request(url);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) params.set(key, value);
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
}

describe('newsletter confirmation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 });
    mockContact.mockResolvedValue({ data: contact, error: null });
    mockUpdate.mockResolvedValue({ data: { id: 'contact-1' }, error: null });
    mockActivityInsert.mockResolvedValue({ error: null });
  });

  it('GET renders a confirmation form without writing anything', async () => {
    const res = await GET(confirmRequest());
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body).toContain('Confirm your subscription?');
    expect(body).toContain('Hi Robin,');
    expect(body).toContain('name="confirm" value="1"');
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockActivityInsert).not.toHaveBeenCalled();
  });

  it('GET rejects a malformed token before reading the database', async () => {
    const res = await GET(
      new Request('https://test.indivisiblefairoaks.org/api/newsletter/confirm?token=nope')
    );

    expect(res.status).toBe(400);
    expect(mockContact).not.toHaveBeenCalled();
  });

  it('GET reports a used token as no longer valid', async () => {
    mockContact.mockResolvedValueOnce({ data: null, error: null });

    const res = await GET(confirmRequest());
    expect(res.status).toBe(404);
  });

  it('GET shows an expired link at 410 without a form', async () => {
    mockContact.mockResolvedValueOnce({
      data: { ...contact, newsletter_confirm_expires_at: '2020-01-01T00:00:00Z' },
      error: null,
    });

    const res = await GET(confirmRequest());
    const body = await res.text();
    expect(res.status).toBe(410);
    expect(body).toContain('This link has expired');
    expect(body).not.toContain('<form');
  });

  it('GET recognises a contact who has already confirmed', async () => {
    mockContact.mockResolvedValueOnce({
      data: { ...contact, newsletter_confirmed_at: '2026-11-19T00:00:00Z' },
      error: null,
    });

    const res = await GET(confirmRequest());
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain('You&rsquo;re already confirmed');
    expect(body).not.toContain('<form');
  });

  it('rate limits both methods', async () => {
    mockRateLimit.mockReturnValue({ ok: false, retryAfterSec: 90 });

    const res = await GET(confirmRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('90');
  });

  it('POST refuses without the human confirmation marker', async () => {
    const res = await POST(confirmRequest({ token }));

    expect(res.status).toBe(400);
    expect(mockContact).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('POST confirms consent, clears the token, and records the activity', async () => {
    const res = await POST(confirmRequest({ token, confirm: '1' }));
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain('You&rsquo;re subscribed');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.do_not_email).toBe(false);
    expect(payload.unsubscribed_at).toBeNull();
    expect(payload.newsletter_confirm_token).toBeNull();
    expect(payload.newsletter_confirm_expires_at).toBeNull();
    expect(payload.newsletter_confirmed_at).toBeTruthy();
    expect(payload.tags).toEqual([
      'action-alerts',
      'newsletter',
      'newsletter-confirmed',
      'town-hall',
    ]);
    expect(mockActivityInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        contact_id: 'contact-1',
        title: 'Subscribed to Action Alerts',
      })
    );
  });

  it('POST refuses when the conditional update no longer matches', async () => {
    mockUpdate.mockResolvedValueOnce({ data: null, error: null });

    const res = await POST(confirmRequest({ token, confirm: '1' }));
    const body = await res.text();

    expect(res.status).toBe(410);
    expect(body).toContain('This link has expired');
    expect(mockActivityInsert).not.toHaveBeenCalled();
  });

  it('POST reports an update failure without claiming success', async () => {
    mockUpdate.mockResolvedValueOnce({ data: null, error: { message: 'write failed' } });

    const res = await POST(confirmRequest({ token, confirm: '1' }));
    expect(res.status).toBe(500);
    expect(mockActivityInsert).not.toHaveBeenCalled();
  });

  it('POST is idempotent for an already-confirmed contact', async () => {
    mockContact.mockResolvedValueOnce({
      data: { ...contact, newsletter_confirmed_at: '2026-11-19T00:00:00Z' },
      error: null,
    });

    const res = await POST(confirmRequest({ token, confirm: '1' }));
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockActivityInsert).not.toHaveBeenCalled();
  });
});
