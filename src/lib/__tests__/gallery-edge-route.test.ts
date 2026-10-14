import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createPublicClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase-server', () => ({
  createPublicClient,
}));

const { GET: getGallery } = await import('@/app/api/gallery/route');

describe('Gallery Edge API Route (/api/gallery)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns formatted photos with storage public URLs', async () => {
    const mockPhotos = [
      {
        id: 1,
        slug: 'protest-rally-1',
        storage_path: 'photos/rally1.jpg',
        caption: 'Singing Protest at Manzanita',
        location: 'Carmichael, CA',
        category: 'Protests',
        sign_quote: 'Democracy in Action',
        date_label: 'Oct 2026',
        photographer: 'Jane Doe',
        is_hero: true,
        is_pair: false,
        alt: 'Protest rally',
        sort_order: 10,
      },
    ];

    createPublicClient.mockReturnValue({
      from: () => ({
        select: () => ({
          order: () => ({
            limit: async () => ({ data: mockPhotos, error: null }),
          }),
        }),
      }),
      storage: {
        from: () => ({
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/media/${path}` },
          }),
        }),
      },
    });

    const req = new Request(
      'https://indivisiblefairoaks.org/api/gallery'
    ) as unknown as NextRequest;
    const res = await getGallery(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.photos).toHaveLength(1);
    expect(json.photos[0].id).toBe('protest-rally-1');
    expect(json.photos[0].url).toContain(
      'https://mock.supabase.co/storage/v1/object/public/media/photos/rally1.jpg'
    );
    expect(json.photos[0].is_hero).toBe(true);
  });
});
