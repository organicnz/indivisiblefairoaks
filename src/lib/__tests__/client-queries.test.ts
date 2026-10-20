// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCoalitionLinks,
  getDataPoints,
  getFaqs,
  getPartners,
  getTickerEvents,
  saveDataPoint,
} from '@/lib/queries/civic-client';
import { getGalleryPhotos } from '@/lib/queries/content-client';
import { installFetchMock } from './fetch-mock';

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

      installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, photos: mockPhotos }),
        } as unknown as Response)
      );

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
      installFetchMock(vi.fn().mockRejectedValue(new Error('Network error')));
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

      installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, events: mockEvents }),
        } as unknown as Response)
      );

      const events = await getTickerEvents();

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/civic/events');
      expect(events).toHaveLength(1);
      expect(events[0].label).toBe('General Meeting');
      expect(events[0].detail).toBe('Oct 20, 2026 • 6:30 PM');
      expect(events[0].href).toBe('/events');
      expect(events[0].badge).toBe('Meeting');
    });

    it('returns empty array when /api/civic/events fetch fails', async () => {
      installFetchMock(vi.fn().mockRejectedValue(new Error('Network error')));
      const events = await getTickerEvents();
      expect(events).toEqual([]);
    });
  });

  describe('getFaqs()', () => {
    it('fetches faqs and categories from /api/faqs', async () => {
      const mockData = {
        success: true,
        faqs: [
          {
            id: 1,
            slug: 'meetings',
            category: 'General',
            question: 'When?',
            answer: 'Tuesdays',
            sort_order: 10,
          },
        ],
        categories: ['General'],
      };

      installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockData,
        } as unknown as Response)
      );

      const res = await getFaqs();
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/faqs');
      expect(res.faqs).toHaveLength(1);
      expect(res.categories).toContain('General');
    });
  });

  describe('getPartners()', () => {
    it('fetches partners from /api/partners', async () => {
      installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            success: true,
            partners: [{ slug: 'p1', name: 'Partner One' }],
          }),
        } as unknown as Response)
      );

      const partners = await getPartners();
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/partners');
      expect(partners).toHaveLength(1);
      expect(partners[0].name).toBe('Partner One');
    });
  });

  describe('getCoalitionLinks()', () => {
    it('fetches coalition links from /api/coalition-links', async () => {
      installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            success: true,
            links: [{ slug: 'l1', name: 'Link One' }],
          }),
        } as unknown as Response)
      );

      const links = await getCoalitionLinks();
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/coalition-links');
      expect(links).toHaveLength(1);
      expect(links[0].name).toBe('Link One');
    });
  });

  describe('getDataPoints() and saveDataPoint()', () => {
    it('fetches data points via Supabase Edge Function or API fallback', async () => {
      const fetchMock = installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            success: true,
            dataPoints: { 'home.headline': 'Headline Text' },
            rows: [{ key: 'home.headline', value: 'Headline Text' }],
          }),
        } as unknown as Response)
      );

      const res = await getDataPoints('home');
      const [calledUrl] = fetchMock.mock.calls[0];
      expect(calledUrl).toMatch(/(functions\/v1\/data-points|\/api\/data-points)\?group=home/);
      expect(res.dataPoints['home.headline']).toBe('Headline Text');
    });

    it('falls back to /api/data-points when Edge Function throws', async () => {
      const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const prevKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';

      try {
        installFetchMock(
          vi
            .fn()
            .mockRejectedValueOnce(new Error('Edge network timeout'))
            .mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                success: true,
                dataPoints: { 'home.headline': 'Fallback Text' },
                rows: [{ key: 'home.headline', value: 'Fallback Text' }],
              }),
            } as unknown as Response)
        );

        const res = await getDataPoints('home');
        expect(res.dataPoints['home.headline']).toBe('Fallback Text');
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = prevKey;
      }
    });

    it('saves data point via POST /api/data-points', async () => {
      installFetchMock(
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            success: true,
            dataPoint: { key: 'home.hero', value: 'Saved Text' },
          }),
        } as unknown as Response)
      );

      const res = await saveDataPoint({ key: 'home.hero', value: 'Saved Text' });
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/data-points', expect.any(Object));
      expect(res.success).toBe(true);
      expect(res.dataPoint?.value).toBe('Saved Text');
    });
  });
});
