// @vitest-environment node
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createPublicClient = vi.hoisted(() => vi.fn());
const requireAdminApi = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase-server', () => ({ createPublicClient }));
vi.mock('@/lib/admin-api-auth', () => ({ requireAdminApi }));

const audits: Record<string, unknown>[] = [];

function adminSession(supabase: { from: (table: string) => unknown }) {
  const client = {
    from: (table: string) => {
      if (table === 'admin_audit_log') {
        return {
          insert: async (row: Record<string, unknown>) => {
            audits.push(row);
            return { error: null };
          },
        };
      }
      return supabase.from(table);
    },
  };
  return {
    ok: true as const,
    session: {
      supabase: client,
      adminClient: client,
      adminUserId: 'admin-1',
      adminEmail: 'admin@example.com',
      mfaLevel: 'aal2' as const,
    },
  };
}

const { GET: getFaqs, POST: postFaq, DELETE: deleteFaq } = await import('@/app/api/faqs/route');

describe('FAQs Edge API Route (/api/faqs)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audits.length = 0;
  });

  it('GET returns formatted faqs and distinct categories', async () => {
    const mockFaqs = [
      {
        id: 1,
        slug: 'meeting-times',
        category: 'Meetings',
        question: 'When do we meet?',
        answer: 'First Tuesday of every month.',
        sort_order: 10,
        created_at: '2026-10-14T00:00:00Z',
        updated_at: '2026-10-14T00:00:00Z',
      },
    ];

    createPublicClient.mockReturnValue({
      from: () => ({
        select: () => ({
          order: async () => ({ data: mockFaqs, error: null }),
        }),
      }),
    });

    const res = await getFaqs();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.faqs).toHaveLength(1);
    expect(json.categories).toContain('Meetings');
  });

  it('POST rejects unauthenticated requests with 401', async () => {
    requireAdminApi.mockResolvedValue({ ok: false, status: 401, error: 'Unauthenticated' });

    const req = new Request('https://indivisiblefairoaks.org/api/faqs', {
      method: 'POST',
      body: JSON.stringify({ question: 'Test' }),
    }) as unknown as NextRequest;

    const res = await postFaq(req);
    expect(res.status).toBe(401);
  });

  it('POST rejects non-admin users with 403', async () => {
    requireAdminApi.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Admin privileges required',
    });

    const req = new Request('https://indivisiblefairoaks.org/api/faqs', {
      method: 'POST',
      body: JSON.stringify({
        category: 'Chapter',
        question: 'What is this?',
        answer: 'A test.',
      }),
    }) as unknown as NextRequest;

    const res = await postFaq(req);
    expect(res.status).toBe(403);
  });

  it('POST upserts FAQ item when user is admin', async () => {
    const mockSaved = {
      id: 2,
      slug: 'how-to-join',
      category: 'Membership',
      question: 'How do I join?',
      answer: 'Just show up!',
      sort_order: 10,
    };

    requireAdminApi.mockResolvedValue(
      adminSession({
        from: () => ({
          upsert: () => ({
            select: () => ({
              single: async () => ({ data: mockSaved, error: null }),
            }),
          }),
        }),
      })
    );

    const req = new Request('https://indivisiblefairoaks.org/api/faqs', {
      method: 'POST',
      body: JSON.stringify({
        category: 'Membership',
        question: 'How do I join?',
        answer: 'Just show up!',
        sort_order: 10,
      }),
    }) as unknown as NextRequest;

    const res = await postFaq(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.faq.question).toBe('How do I join?');
    expect(audits[0]).toMatchObject({
      actor_user_id: 'admin-1',
      action: 'faq.save',
      target_type: 'faq',
      target_id: 'how-to-join',
      target_label: 'How do I join?',
      mfa_level: 'aal2',
      outcome: 'success',
    });
  });

  it('DELETE deletes FAQ by slug when user is admin', async () => {
    requireAdminApi.mockResolvedValue(
      adminSession({
        from: () => ({
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      })
    );

    const req = new Request('https://indivisiblefairoaks.org/api/faqs?slug=old-faq', {
      method: 'DELETE',
    }) as unknown as NextRequest;

    const res = await deleteFaq(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(audits[0]).toMatchObject({
      action: 'faq.delete',
      target_type: 'faq',
      target_id: 'old-faq',
      outcome: 'success',
      after: { deleted: true },
    });
  });

  it('POST audits a failed FAQ save', async () => {
    requireAdminApi.mockResolvedValue(
      adminSession({
        from: () => ({
          upsert: () => ({
            select: () => ({
              single: async () => ({ data: null, error: { message: 'faqs table is locked' } }),
            }),
          }),
        }),
      })
    );

    const req = new Request('https://indivisiblefairoaks.org/api/faqs', {
      method: 'POST',
      body: JSON.stringify({
        category: 'Chapter',
        question: 'What fails?',
        answer: 'A test.',
      }),
    }) as unknown as NextRequest;

    const res = await postFaq(req);
    expect(res.status).toBe(500);
    expect(audits[0]).toMatchObject({
      action: 'faq.save',
      target_id: 'what-fails',
      outcome: 'failure',
      error: 'faqs table is locked',
    });
  });

  it('DELETE audits a failed FAQ delete', async () => {
    requireAdminApi.mockResolvedValue(
      adminSession({
        from: () => ({
          delete: () => ({
            eq: async () => ({ error: { message: 'faqs delete failed' } }),
          }),
        }),
      })
    );

    const req = new Request('https://indivisiblefairoaks.org/api/faqs?slug=old-faq', {
      method: 'DELETE',
    }) as unknown as NextRequest;

    const res = await deleteFaq(req);
    expect(res.status).toBe(500);
    expect(audits[0]).toMatchObject({
      action: 'faq.delete',
      target_id: 'old-faq',
      outcome: 'failure',
      error: 'faqs delete failed',
    });
  });
});
