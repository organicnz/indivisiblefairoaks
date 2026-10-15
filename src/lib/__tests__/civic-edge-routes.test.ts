import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createPublicClient = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());
const createServerClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase-server', () => ({
  createPublicClient,
  createAdminClient,
  createServerClient,
}));

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
          order: () => ({
            order: async () => ({ data: mockEvents, error: null }),
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
    createServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
    });

    const req = new Request('https://indivisiblefairoaks.org/api/civic/events', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Event' }),
    }) as unknown as NextRequest;

    const res = await postEvent(req);
    expect(res.status).toBe(401);
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

    createServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: 'admin-123' } } }),
      },
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              or: () => ({
                single: async () => ({ data: { is_admin: true } }),
              }),
            }),
          };
        }
        return {
          upsert: () => ({
            select: () => ({
              single: async () => ({ data: mockSaved, error: null }),
            }),
          }),
        };
      },
    });

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
  });

  it('DELETE removes event by slug when user is admin', async () => {
    createServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: 'admin-123' } } }),
      },
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              or: () => ({
                single: async () => ({ data: { is_admin: true } }),
              }),
            }),
          };
        }
        return {
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      },
    });

    const req = new Request('https://indivisiblefairoaks.org/api/civic/events?slug=test-event', {
      method: 'DELETE',
    }) as unknown as NextRequest;

    const res = await deleteEvent(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.deletedSlug).toBe('test-event');
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

    createPublicClient.mockReturnValue({
      from: () => ({
        select: () => ({
          order: () => ({
            order: async () => ({ data: mockNewsletters, error: null }),
          }),
        }),
      }),
    });

    const res = await getNewsletters();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.newsletters).toHaveLength(1);
    expect(json.newsletters[0].slug).toBe('fall-bulletin-2026');
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

    createServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: 'admin-123' } } }),
      },
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              or: () => ({
                single: async () => ({ data: { is_admin: true } }),
              }),
            }),
          };
        }
        return {
          upsert: () => ({
            select: () => ({
              single: async () => ({ data: mockSaved, error: null }),
            }),
          }),
        };
      },
    });

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
  });

  it('DELETE removes newsletter by slug when user is admin', async () => {
    createServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: 'admin-123' } } }),
      },
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              or: () => ({
                single: async () => ({ data: { is_admin: true } }),
              }),
            }),
          };
        }
        return {
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      },
    });

    const req = new Request(
      'https://indivisiblefairoaks.org/api/civic/newsletters?slug=fall-bulletin-2026',
      { method: 'DELETE' }
    ) as unknown as NextRequest;

    const res = await deleteNewsletter(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.deletedSlug).toBe('fall-bulletin-2026');
  });
});
