// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-auth', () => ({ requireAdmin }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/env', () => ({ env: {} }));

const { importMobilizeEvent } = await import('@/lib/actions/mobilize');
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
});
