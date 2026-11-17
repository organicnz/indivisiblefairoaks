// @vitest-environment node
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  });

  it('DELETE removes event by slug when user is admin', async () => {
    requireAdminApi.mockResolvedValue(
      adminSession({
        from: () => ({
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
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

  it('POST saves newsletter when user is admin', async () => {
    const mockSaved = {
      slug: 'winter-bulletin-2026',
      title: 'Winter Bulletin',
      date_label: 'December 2026',
      description: 'End of year review',
      topics: ['Review'],
      sort_order: 20,
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
    expect(revalidateTag).toHaveBeenCalledWith('newsletters', 'hours');
    expect(revalidatePath).toHaveBeenCalledWith('/newsletters');
  });

  it('DELETE removes newsletter by slug when user is admin', async () => {
    requireAdminApi.mockResolvedValue(
      adminSession({
        from: () => ({
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      })
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
    expect(revalidateTag).toHaveBeenCalledWith('newsletters', 'hours');
    expect(revalidatePath).toHaveBeenCalledWith('/newsletters');
  });
});
