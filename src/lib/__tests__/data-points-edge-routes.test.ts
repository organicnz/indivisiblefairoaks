// @vitest-environment node
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createPublicClient = vi.hoisted(() => vi.fn());
const createServerClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase-server', () => ({
  createPublicClient,
  createServerClient,
}));

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
    createServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
    });

    const req = new Request('https://indivisiblefairoaks.org/api/data-points', {
      method: 'POST',
      body: JSON.stringify({ key: 'test.key', value: 'Hello' }),
    }) as unknown as NextRequest;

    const res = await postDataPoint(req);
    expect(res.status).toBe(401);
  });

  it('POST rejects non-admin users with 403', async () => {
    createServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-789' } } }),
      },
      from: () => ({
        select: () => ({
          or: () => ({
            single: async () => ({ data: { is_admin: false } }),
          }),
        }),
      }),
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
