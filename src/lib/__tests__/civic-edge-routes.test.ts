// @vitest-environment node
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAdminClient } from './supabase-mock';

const createPublicClient = vi.hoisted(() => vi.fn());
const requireAdminApi = vi.hoisted(() => vi.fn());
const revalidateTag = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase-server', () => ({ createPublicClient }));
vi.mock('@/lib/admin-api-auth', () => ({ requireAdminApi }));
vi.mock('next/cache', () => ({ revalidateTag, revalidatePath }));

function adminSession(adminClient: unknown) {
  return {
    ok: true as const,
    session: {
      supabase: adminClient,
      adminClient,
      adminUserId: 'admin-123',
      adminEmail: 'admin@example.com',
      mfaLevel: 'aal2',
    },
  };
}

const {
  GET: getEvents,
  POST: postEvent,
  DELETE: deleteEvent,
} = await import('@/app/api/civic/events/route');
const {
  GET: getNewsletters,
  POST: postNewsletter,
  DELETE: deleteNewsletter,
} = await import('@/app/api/civic/newsletters/route');

describe('Civic Events Edge API Route (/api/civic/events)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns formatted civic events from public client', async () => {
    const mockEvents = [
      {
        slug: 'test-event',
        title: 'Community Gathering',
        category: 'Meetings',
        date_label: 'Nov 10, 2026',
        time_label: '6:30 PM',
        starts_at: '2026-11-10T18:30:00Z',
        ends_at: '2026-11-10T20:00:00Z',
        location_name: 'Community Hall',
        address: '123 Main St',
        description: 'Monthly gathering',
        rsvp_url: 'https://example.com/rsvp',
        highlight: true,
        sort_order: 10,
      },
    ];

    createPublicClient.mockReturnValue({
      from: () => ({
        select: () => ({
          // Issue #153: the read now excludes hidden Mobilize rows before the
          // two ordering clauses.
          eq: () => ({
            order: () => ({
              order: async () => ({ data: mockEvents, error: null }),
            }),
          }),
        }),
      }),
    });

    const req = new Request(
      'https://indivisiblefairoaks.org/api/civic/events'
    ) as unknown as NextRequest;
    const res = await getEvents(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.events).toHaveLength(1);
    expect(json.events[0].id).toBe('test-event');
    expect(json.events[0].title).toBe('Community Gathering');
    expect(json.events[0].highlight).toBe(true);
    expect(json.events[0].sortOrder).toBe(10);
  });

  it('POST rejects unauthenticated users', async () => {
    requireAdminApi.mockResolvedValue({ ok: false, status: 401, error: 'Unauthenticated' });

    const req = new Request('https://indivisiblefairoaks.org/api/civic/events', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Event' }),
    }) as unknown as NextRequest;

    const res = await postEvent(req);
    expect(res.status).toBe(401);
  });

  it('POST returns the step-up challenge instead of writing from an AAL1 session', async () => {
    requireAdminApi.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'MFA verification required. Please complete 2FA.',
      mfaRequired: true,
    });

    const req = new Request('https://indivisiblefairoaks.org/api/civic/events', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Event' }),
    }) as unknown as NextRequest;

    const res = await postEvent(req);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ mfaRequired: true });
  });

  it('POST tells an admin with no TOTP factor to enroll instead of retrying', async () => {
    requireAdminApi.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'MFA enrollment required. Set up an authenticator app to continue.',
      mfaEnrollmentRequired: true,
    });

    const req = new Request('https://indivisiblefairoaks.org/api/civic/events', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Event' }),
    }) as unknown as NextRequest;

    const res = await postEvent(req);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ mfaEnrollmentRequired: true });
  });

  it('POST saves new event when user is admin', async () => {
    const mockSaved = {
      slug: 'rally-2026',
      title: 'Democracy Rally',
      category: 'Rallies & Street Action',
      date_label: 'Oct 20, 2026',
      time_label: '10:00 AM',
      location_name: 'Square',
      address: 'Fair Oaks Blvd',
      description: 'Peaceful stand',
      rsvp_url: '',
      highlight: false,
      sort_order: 15,
    };

    const auditInsert = vi.fn(async () => ({ error: null }));
    requireAdminApi.mockResolvedValue(
      adminSession({
        from: (table: string) => {
          if (table === 'admin_audit_log') return { insert: auditInsert };
          return {
            upsert: () => ({
              select: () => ({
                single: async () => ({ data: mockSaved, error: null }),
              }),
            }),
          };
        },
      })
    );

    const req = new Request('https://indivisiblefairoaks.org/api/civic/events', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Democracy Rally',
        category: 'Rallies & Street Action',
        date_label: 'Oct 20, 2026',
        time_label: '10:00 AM',
      }),
    }) as unknown as NextRequest;

    const res = await postEvent(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.event.title).toBe('Democracy Rally');
    expect(revalidateTag).toHaveBeenCalledWith('events', 'hours');
    expect(revalidatePath).toHaveBeenCalledWith('/events');
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: 'admin-123',
        action: 'event.create',
        target_type: 'event',
        target_id: 'rally-2026',
        target_label: 'Democracy Rally',
        before: null,
        after: mockSaved,
        mfa_level: 'aal2',
        outcome: 'success',
      })
    );
  });

  it('POST renames an existing event in place instead of upserting a duplicate', async () => {
    const renamed = {
      slug: 'renaissance-rally',
      title: 'Renaissance Rally',
      category: 'Rallies & Street Action',
      date_label: 'Oct 20, 2026',
      time_label: '10:00 AM',
    };
    const update = vi.fn(() => ({
      eq: () => ({
        select: () => ({
          single: async () => ({ data: renamed, error: null }),
        }),
      }),
    }));
    const upsert = vi.fn();
    requireAdminApi.mockResolvedValue(
      adminSession({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { external_id: null }, error: null }),
            }),
          }),
          update,
          upsert,
        }),
      })
    );

    const req = new Request('https://indivisiblefairoaks.org/api/civic/events', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'renaissance-rally',
        original_slug: 'old-rally',
        title: 'Renaissance Rally',
        category: 'Rallies & Street Action',
        date_label: 'Oct 20, 2026',
        time_label: '10:00 AM',
      }),
    }) as unknown as NextRequest;

    const res = await postEvent(req);
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ slug: 'renaissance-rally' }));
    expect(upsert).not.toHaveBeenCalled();
  });

  it('DELETE removes event by slug when user is admin', async () => {
    const auditInsert = vi.fn(async () => ({ error: null }));
    requireAdminApi.mockResolvedValue(
      adminSession({
        from: (table: string) => {
          if (table === 'admin_audit_log') return { insert: auditInsert };
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { external_id: null }, error: null }),
              }),
            }),
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        },
      })
    );

    const req = new Request('https://indivisiblefairoaks.org/api/civic/events?slug=test-event', {
      method: 'DELETE',
    }) as unknown as NextRequest;

    const res = await deleteEvent(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.deletedSlug).toBe('test-event');
    expect(revalidateTag).toHaveBeenCalledWith('events', 'hours');
    expect(revalidatePath).toHaveBeenCalledWith('/events');
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: 'admin-123',
        action: 'event.delete',
        target_type: 'event',
        target_id: 'test-event',
        before: { external_id: null },
        after: null,
        mfa_level: 'aal2',
        outcome: 'success',
      })
    );
  });

  it('DELETE refuses a Mobilize-sourced event that the sync would recreate', async () => {
    const deleteEq = vi.fn(async () => ({ error: null }));
    requireAdminApi.mockResolvedValue(
      adminSession({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { external_id: '1011420' }, error: null }),
            }),
          }),
          delete: () => ({ eq: deleteEq }),
        }),
      })
    );

    const req = new Request(
      'https://indivisiblefairoaks.org/api/civic/events?slug=mobilize-1011420',
      { method: 'DELETE' }
    ) as unknown as NextRequest;

    const res = await deleteEvent(req);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: 'This event comes from Mobilize. Hide it instead of deleting it.',
    });
    expect(deleteEq).not.toHaveBeenCalled();
  });
});

describe('Civic Newsletters Edge API Route (/api/civic/newsletters)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns newsletters from database', async () => {
    const mockNewsletters = [
      {
        slug: 'fall-bulletin-2026',
        title: 'Fall Action Bulletin',
        date_label: 'October 2026',
        description: 'Organizing priorities',
        topics: ['Elections', 'Community'],
        sort_order: 10,
        published_at: '2026-10-01T00:00:00Z',
      },
    ];

    const or = vi.fn(() => ({
      order: () => ({
        order: async () => ({ data: mockNewsletters, error: null }),
      }),
    }));

    createPublicClient.mockReturnValue({
      from: () => ({
        select: () => ({ or }),
      }),
    });

    const res = await getNewsletters();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.newsletters).toHaveLength(1);
    expect(json.newsletters[0].slug).toBe('fall-bulletin-2026');
    expect(or).toHaveBeenCalledWith(
      expect.stringMatching(/^published_at\.is\.null,published_at\.lte\./)
    );
  });

  it('POST creates a newsletter when the slug is free', async () => {
    const rows: Record<string, unknown>[] = [];
    const audits: Record<string, unknown>[] = [];
    requireAdminApi.mockResolvedValue(
      adminSession(
        createMockAdminClient({
          newsletters: { rows },
          admin_audit_log: { rows: audits },
        })
      )
    );

    const req = new Request('https://indivisiblefairoaks.org/api/civic/newsletters', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Winter Bulletin',
        date_label: 'December 2026',
        description: 'End of year review',
        topics: ['Review'],
      }),
    }) as unknown as NextRequest;

    const res = await postNewsletter(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.newsletter.title).toBe('Winter Bulletin');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe('winter-bulletin');
    expect(audits[0]).toMatchObject({ action: 'newsletter.create', outcome: 'success' });
    expect(revalidateTag).toHaveBeenCalledWith('newsletters', 'hours');
    expect(revalidatePath).toHaveBeenCalledWith('/newsletters');
  });

  it('POST refuses to replace a bulletin when a create reuses its slug', async () => {
    const rows = [
      {
        slug: 'winter-bulletin',
        title: 'Original Winter Bulletin',
        date_label: 'December 2026',
        description: 'Original summary',
        topics: [],
        sort_order: 10,
        published_at: '2026-12-01T00:00:00Z',
      },
    ];
    requireAdminApi.mockResolvedValue(
      adminSession(createMockAdminClient({ newsletters: { rows } }))
    );

    const req = new Request('https://indivisiblefairoaks.org/api/civic/newsletters', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'winter-bulletin',
        title: 'Replacement',
        date_label: 'January 2027',
        description: 'This must not overwrite the original',
      }),
    }) as unknown as NextRequest;

    const res = await postNewsletter(req);
    expect(res.status).toBe(409);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Original Winter Bulletin');
  });

  it('POST renames an existing newsletter in place instead of creating a duplicate', async () => {
    const rows = [
      {
        slug: 'bulletin-summer',
        title: 'Summer Bulletin',
        date_label: 'July 2026',
        description: 'Summer organizing',
        topics: [],
        sort_order: 10,
        published_at: '2026-07-01T00:00:00Z',
      },
    ];
    requireAdminApi.mockResolvedValue(
      adminSession(createMockAdminClient({ newsletters: { rows } }))
    );

    const req = new Request('https://indivisiblefairoaks.org/api/civic/newsletters', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'bulletin-autumn',
        original_slug: 'bulletin-summer',
        title: 'Summer Bulletin',
        date_label: 'July 2026',
        description: 'Summer organizing',
      }),
    }) as unknown as NextRequest;

    const res = await postNewsletter(req);
    expect(res.status).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe('bulletin-autumn');
  });

  it('DELETE removes newsletter by slug when user is admin', async () => {
    const rows = [
      {
        slug: 'fall-bulletin-2026',
        title: 'Fall Bulletin',
        date_label: 'October 2026',
        description: 'Fall organizing',
        topics: [],
        sort_order: 10,
        published_at: '2026-10-01T00:00:00Z',
      },
    ];
    requireAdminApi.mockResolvedValue(
      adminSession(createMockAdminClient({ newsletters: { rows } }))
    );

    const req = new Request(
      'https://indivisiblefairoaks.org/api/civic/newsletters?slug=fall-bulletin-2026',
      { method: 'DELETE' }
    ) as unknown as NextRequest;

    const res = await deleteNewsletter(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.deletedSlug).toBe('fall-bulletin-2026');
    expect(rows).toHaveLength(0);
    expect(revalidateTag).toHaveBeenCalledWith('newsletters', 'hours');
    expect(revalidatePath).toHaveBeenCalledWith('/newsletters');
  });
});
