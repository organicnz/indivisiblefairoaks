import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerEvents } from '@/lib/queries/civic-client';
import { getGalleryPhotos } from '@/lib/queries/content-client';

describe('Client queries through Edge API', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getGalleryPhotos()', () => {
    it('fetches gallery photos from /api/gallery and maps properties correctly', async () => {
      const mockPhotos = [
        {
          id: 'photo-1',
          dbId: 101,
          slug: 'photo-1',
          url: 'https://example.com/photo1.jpg',
          caption: 'Fair Oaks Rally',
          location: 'Fair Oaks, CA',
          category: 'Action',
          signQuote: 'Stand Together',
          date: '2026-10-14',
          photographer: 'Indivisible Member',
          is_hero: true,
          is_pair: false,
          alt: 'A protest rally in Fair Oaks',
          sort_order: 1,
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, photos: mockPhotos }),
      } as unknown as Response);

      const photos = await getGalleryPhotos();

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/gallery');
      expect(photos).toHaveLength(1);
      expect(photos[0].id).toBe('photo-1');
      expect(photos[0].dbId).toBe(101);
      expect(photos[0].url).toBe('https://example.com/photo1.jpg');
      expect(photos[0].caption).toBe('Fair Oaks Rally');
      expect(photos[0].is_hero).toBe(true);
    });

    it('returns empty array when /api/gallery fetch fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const photos = await getGalleryPhotos();
      expect(photos).toEqual([]);
    });
  });

  describe('getTickerEvents()', () => {
    it('fetches ticker events from /api/civic/events and maps items correctly', async () => {
      const mockEvents = [
        {
          title: 'General Meeting',
          dateLabel: 'Oct 20, 2026',
          timeLabel: '6:30 PM',
          category: 'Meeting',
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, events: mockEvents }),
      } as unknown as Response);

      const events = await getTickerEvents();

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/civic/events');
      expect(events).toHaveLength(1);
      expect(events[0].label).toBe('General Meeting');
      expect(events[0].detail).toBe('Oct 20, 2026 • 6:30 PM');
      expect(events[0].href).toBe('/events');
      expect(events[0].badge).toBe('Meeting');
    });

    it('returns empty array when /api/civic/events fetch fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const events = await getTickerEvents();
      expect(events).toEqual([]);
    });
  });
});
