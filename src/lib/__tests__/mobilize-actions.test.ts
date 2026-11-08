// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-auth', () => ({ requireAdmin }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/env', () => ({ env: {} }));

const { importMobilizeEvent, previewMobilizeSource, setEventSyncLock, setMobilizeEventHidden } =
  await import('@/lib/actions/mobilize');
const { createMockAdminClient } = await import('./supabase-mock');
import type { MockTableConfig } from './supabase-mock';

const EVENT = {
  id: 1011420,
  title: 'Mobilize test event',
  description: '<p>Join us.</p>',
  browser_url: 'https://www.mobilize.us/indivisible/event/1011420/',
  event_type: 'MEETING',
  timezone: 'America/Los_Angeles',
  is_virtual: false,
  high_priority: false,
  location: {
    venue: 'Fair Oaks Library',
    address_lines: ['1 Main St'],
    locality: 'Fair Oaks',
    region: 'CA',
    postal_code: '95628',
  },
  timeslots: [{ id: 1, start_date: 1893456000, end_date: 1893459600 }],
};

function respondWithEvent() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ data: EVENT }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('importMobilizeEvent ownership reads', () => {
  it('does not import when the external-id lookup fails', async () => {
    respondWithEvent();
    const tables: Record<string, MockTableConfig> = {
      events: {
        rows: [],
        errors: [
          {
            kind: 'eq',
            column: 'external_id',
            error: { message: 'connection reset' },
          },
        ],
      },
    };
    requireAdmin.mockResolvedValue({ adminClient: createMockAdminClient(tables) });

    const res = await importMobilizeEvent(
      'https://www.mobilize.us/indivisible/event/1011420/'
    );

    expect(res).toMatchObject({ success: false, error: 'connection reset' });
    expect(tables.events.rows).toHaveLength(0);
  });

  it('adopts a hand-made row whose RSVP link matches the event', async () => {
    respondWithEvent();
    const tables: Record<string, MockTableConfig> = {
      events: {
        rows: [
          {
            slug: 'handmade-event',
            external_id: null,
            rsvp_url: 'https://www.mobilize.us/indivisible/event/1011420/',
          },
        ],
      },
    };
    requireAdmin.mockResolvedValue({ adminClient: createMockAdminClient(tables) });

    const res = await importMobilizeEvent(
      'https://www.mobilize.us/indivisible/event/1011420/'
    );

    expect(res).toMatchObject({
      success: true,
      data: { slug: 'handmade-event', converted: true },
    });
    expect(tables.events.rows?.[0]).toMatchObject({ external_id: '1011420' });
  });

  it('does not import when the hand-made-row lookup fails', async () => {
    respondWithEvent();
    const tables: Record<string, MockTableConfig> = {
      events: {
        rows: [],
        errors: [
          {
            kind: 'is',
            column: 'external_id',
            error: { message: 'connection reset' },
          },
        ],
      },
    };
    requireAdmin.mockResolvedValue({ adminClient: createMockAdminClient(tables) });

    const res = await importMobilizeEvent(
      'https://www.mobilize.us/indivisible/event/1011420/'
    );

    expect(res).toMatchObject({ success: false, error: 'connection reset' });
    expect(tables.events.rows).toHaveLength(0);
  });

  it('reports an already-owned event removed before the refresh write', async () => {
    respondWithEvent();
    requireAdmin.mockResolvedValue({
      adminClient: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { slug: 'owned-event' },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      },
    });

    const res = await importMobilizeEvent(
      'https://www.mobilize.us/indivisible/event/1011420/'
    );

    expect(res).toEqual({ success: false, error: 'That event no longer exists' });
  });

  it('reports a hand-made event removed before the adoption write', async () => {
    respondWithEvent();
    requireAdmin.mockResolvedValue({
      adminClient: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
            is: () => ({
              ilike: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: { slug: 'handmade-event' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      },
    });

    const res = await importMobilizeEvent(
      'https://www.mobilize.us/indivisible/event/1011420/'
    );

    expect(res).toEqual({ success: false, error: 'That event no longer exists' });
  });
});

describe('previewMobilizeSource reads', () => {
  it('does not show a preview when the rule read fails', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const tables: Record<string, MockTableConfig> = {
      mobilize_event_rules: { rows: [], error: { message: 'connection reset' } },
    };
    requireAdmin.mockResolvedValue({ adminClient: createMockAdminClient(tables) });

    const res = await previewMobilizeSource();

    expect(res).toMatchObject({ success: false, error: 'connection reset' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not mark every event as new when import markers cannot be read', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const tables: Record<string, MockTableConfig> = {
      events: { rows: [], error: { message: 'connection reset' } },
    };
    requireAdmin.mockResolvedValue({ adminClient: createMockAdminClient(tables) });

    const res = await previewMobilizeSource();

    expect(res).toMatchObject({ success: false, error: 'connection reset' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Mobilize event toggles', () => {
  it('reports a missing event when hiding it', async () => {
    const tables: Record<string, MockTableConfig> = { events: { rows: [] } };
    requireAdmin.mockResolvedValue({ adminClient: createMockAdminClient(tables) });

    const res = await setMobilizeEventHidden('1011420', true);

    expect(res).toMatchObject({ success: false, error: 'That event no longer exists' });
  });

  it('reports a missing event when locking it', async () => {
    const tables: Record<string, MockTableConfig> = { events: { rows: [] } };
    requireAdmin.mockResolvedValue({ adminClient: createMockAdminClient(tables) });

    const res = await setEventSyncLock('mobilize-1011420', true);

    expect(res).toMatchObject({ success: false, error: 'That event no longer exists' });
  });

  it('updates an existing imported event when hiding it', async () => {
    const tables: Record<string, MockTableConfig> = {
      events: {
        rows: [{ slug: 'mobilize-1011420', external_id: '1011420', is_hidden: false }],
      },
    };
    requireAdmin.mockResolvedValue({ adminClient: createMockAdminClient(tables) });

    const res = await setMobilizeEventHidden('1011420', true);

    expect(res).toMatchObject({ success: true, data: null });
    expect(tables.events.rows?.[0]).toMatchObject({ is_hidden: true });
  });
});
