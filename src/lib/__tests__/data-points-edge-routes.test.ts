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

function adminSession(supabase: unknown) {
  return {
    ok: true as const,
    session: {
      supabase,
      adminClient: supabase,
      adminUserId: 'admin-1',
      adminEmail: 'admin@example.com',
    },
  };
}

const {
  GET: getDataPoints,
  POST: postDataPoint,
  DELETE: deleteDataPoint,
} = await import('@/app/api/data-points/route');

describe('Data Points Edge API Route (/api/data-points)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns mapped key-value pairs and row list', async () => {
    const mockRows = [
      {
        key: 'home.hero.headline',
        value: 'Democracy in action',
        group_name: 'home',
        label: 'Hero Headline',
        updated_at: '2026-10-14T00:00:00Z',
      },
    ];

    createPublicClient.mockReturnValue({
      from: () => ({
        select: () => Promise.resolve({ data: mockRows, error: null }),
      }),
    });

    const req = new Request(
      'https://indivisiblefairoaks.org/api/data-points'
    ) as unknown as NextRequest;
    const res = await getDataPoints(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.dataPoints['home.hero.headline']).toBe('Democracy in action');
    expect(json.rows).toHaveLength(1);
  });

  it('POST rejects unauthenticated users with 401', async () => {
    requireAdminApi.mockResolvedValue({ ok: false, status: 401, error: 'Unauthenticated' });

    const req = new Request('https://indivisiblefairoaks.org/api/data-points', {
      method: 'POST',
      body: JSON.stringify({ key: 'test.key', value: 'Hello' }),
    }) as unknown as NextRequest;

    const res = await postDataPoint(req);
    expect(res.status).toBe(401);
  });

  it('POST rejects non-admin users with 403', async () => {
    requireAdminApi.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Admin privileges required',
    });

    const req = new Request('https://indivisiblefairoaks.org/api/data-points', {
      method: 'POST',
      body: JSON.stringify({ key: 'test.key', value: 'Hello' }),
    }) as unknown as NextRequest;

    const res = await postDataPoint(req);
    expect(res.status).toBe(403);
  });

  it('POST saves data point when user is admin', async () => {
    const mockSaved = {
      key: 'home.hero.headline',
      value: 'Updated Headline',
      group_name: 'home',
      label: 'Hero Headline',
      updated_at: '2026-10-14T12:00:00Z',
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

    const req = new Request('https://indivisiblefairoaks.org/api/data-points', {
      method: 'POST',
      body: JSON.stringify({
        key: 'home.hero.headline',
        value: 'Updated Headline',
        group_name: 'home',
      }),
    }) as unknown as NextRequest;

    const res = await postDataPoint(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.dataPoint.value).toBe('Updated Headline');
  });

  it('DELETE deletes data point by key when user is admin', async () => {
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
      'https://indivisiblefairoaks.org/api/data-points?key=home.hero.headline',
      {
        method: 'DELETE',
      }
    ) as unknown as NextRequest;

    const res = await deleteDataPoint(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
