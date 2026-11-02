// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeActionAlerts } from '../actions';

const {
  mockAdminClient,
  mockMaybeSingle,
  mockUpdate,
  mockInsert,
  mockRateLimit,
  mockIsE2EMode,
  mockRevalidatePath,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockUpdate = vi.fn();
  const mockInsert = vi.fn();
  const mockRateLimit = vi.fn();
  const mockIsE2EMode = vi.fn();
  const mockRevalidatePath = vi.fn();

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
          insert: vi.fn(() => Promise.resolve({ error: null })),
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
    mockRateLimit,
    mockIsE2EMode,
    mockRevalidatePath,
  };
});

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '127.0.0.1' }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
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

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  return fd;
}

describe('subscribeActionAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsE2EMode.mockReturnValue(false);
    mockRateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ data: { id: 'contact-uuid-1' }, error: null });
    mockUpdate.mockResolvedValue({ error: null });
  });

  it('silently accepts submissions when honeypot is populated', async () => {
    const fd = makeFormData({
      email: 'bot@spam.com',
      website: 'https://spammy-link.xyz',
    });

    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({
      success: true,
      message: "You're on the list! Thank you for standing with Indivisible Fair Oaks-Carmichael.",
    });
    expect(mockAdminClient.from).not.toHaveBeenCalled();
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

  it('short-circuits in E2E mode without contacting database', async () => {
    mockIsE2EMode.mockReturnValue(true);
    const fd = makeFormData({ email: 'e2e@example.com' });

    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({
      success: true,
      message: "You're on the list! Thank you for standing with Indivisible Fair Oaks-Carmichael.",
      alreadySubscribed: false,
    });
    expect(mockAdminClient.from).not.toHaveBeenCalled();
  });

  it('inserts new contact and logs activity when email is not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const fd = makeFormData({
      email: 'new.activist@example.com',
      name: 'Taylor Reed',
    });

    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({
      success: true,
      message: "You're on the list! Thank you for standing with Indivisible Fair Oaks-Carmichael.",
      alreadySubscribed: false,
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertPayload = mockInsert.mock.calls[0][0];
    expect(insertPayload.email).toBe('new.activist@example.com');
    expect(insertPayload.first_name).toBe('Taylor Reed');
    expect(insertPayload.do_not_email).toBe(false);
    expect(insertPayload.tags).toEqual(['action-alerts', 'newsletter']);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/news');
  });

  it('updates existing contact, clears do_not_email, and merges tags', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'contact-uuid-99',
        email: 'prior.volunteer@example.com',
        first_name: null,
        tags: ['town-hall-2025'],
        do_not_email: true,
      },
      error: null,
    });

    const fd = makeFormData({
      email: 'prior.volunteer@example.com',
      name: 'Morgan',
    });

    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({
      success: true,
      message: "You're on the list! Thank you for standing with Indivisible Fair Oaks-Carmichael.",
      alreadySubscribed: false,
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updatePayload = mockUpdate.mock.calls[0][0];
    expect(updatePayload.do_not_email).toBe(false);
    expect(updatePayload.unsubscribed_at).toBeNull();
    expect(updatePayload.first_name).toBe('Morgan');
    expect(updatePayload.tags).toEqual(['town-hall-2025', 'action-alerts', 'newsletter']);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/news');
  });

  it('returns graceful error message when database insertion fails', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database connection terminated' },
    });

    const fd = makeFormData({ email: 'error.test@example.com' });
    const result = await subscribeActionAlerts(fd);
    expect(result).toEqual({
      error: 'Failed to save subscription. Please email us directly.',
    });
  });
});
