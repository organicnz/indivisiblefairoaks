import { describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-auth', () => ({ requireAdmin }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const {
  getCivicEventsAdmin,
  saveCivicEvent,
  deleteCivicEvent,
  getCivicNewslettersAdmin,
  saveCivicNewsletter,
  deleteCivicNewsletter,
  getCoalitionLinksAdmin,
  saveCoalitionLink,
  deleteCoalitionLink,
} = await import('@/lib/actions/civic');
const { createMockAdminClient } = await import('./supabase-mock');

describe('Civic Server Actions', () => {
  describe('getCivicEventsAdmin', () => {
    it('returns event rows from Supabase', async () => {
      const mockEvents = [
        {
          slug: 'monthly-gathering',
          title: 'Monthly Chapter Gathering',
          category: 'Meetings',
          date_label: 'Oct 14',
          time_label: '6:30 PM',
          starts_at: '2026-10-14T18:30:00Z',
          ends_at: '2026-10-14T20:00:00Z',
          location_name: 'Library',
          address: 'Fair Oaks',
          description: 'Monthly gathering',
          rsvp_url: 'https://mobilize.us',
          highlight: true,
          sort_order: 1,
        },
      ];

      requireAdmin.mockResolvedValue({
        adminClient: createMockAdminClient({ events: { rows: mockEvents } }),
      });

      const res = await getCivicEventsAdmin();
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.length).toBe(1);
        expect(res.data[0]?.slug).toBe('monthly-gathering');
      }
    });

    it('handles query failures gracefully', async () => {
      requireAdmin.mockResolvedValue({
        adminClient: {
          from: () => ({
            select: () => ({
              order: () => ({
                order: async () => ({ data: null, error: new Error('DB Connection Refused') }),
              }),
            }),
          }),
        },
      });

      const res = await getCivicEventsAdmin();
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('DB Connection Refused');
      }
    });
  });

  describe('saveCivicEvent', () => {
    it('saves a valid event and revalidates paths', async () => {
      const savedEvent = {
        slug: 'rallies-action',
        title: 'Peaceful Rally',
        category: 'Rallies & Street Action' as const,
        date_label: 'Saturday, Oct 24',
        time_label: '10:00 AM',
        starts_at: null,
        ends_at: null,
        location_name: 'Corner',
        address: 'Fair Oaks Blvd',
        description: 'Stand for democracy',
        rsvp_url: 'https://mobilize.us',
        highlight: false,
        sort_order: 10,
      };

      requireAdmin.mockResolvedValue({
        adminClient: {
          from: () => ({
            upsert: () => ({
              select: () => ({
                single: async () => ({ data: savedEvent, error: null }),
              }),
            }),
          }),
        },
      });

      const res = await saveCivicEvent(savedEvent);
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.slug).toBe('rallies-action');
        expect(res.data.title).toBe('Peaceful Rally');
      }
    });

    it('rejects invalid categories or empty titles', async () => {
      requireAdmin.mockResolvedValue({
        adminClient: createMockAdminClient({ events: { rows: [] } }),
      });

      const res = await saveCivicEvent({
        title: '',
        category: 'InvalidCategory' as unknown as 'Meetings',
        date_label: 'Oct 24',
        time_label: '10:00 AM',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeDefined();
      }
    });
  });

  describe('deleteCivicEvent', () => {
    it('deletes an event by slug', async () => {
      requireAdmin.mockResolvedValue({
        adminClient: {
          from: () => ({
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        },
      });

      const res = await deleteCivicEvent('monthly-gathering');
      expect(res.success).toBe(true);
    });
  });

  describe('Newsletters CRUD', () => {
    it('fetches newsletters', async () => {
      const mockNewsletters = [
        {
          slug: 'bulletin-summer',
          title: 'Summer Bulletin',
          date_label: 'July 2026',
          description: 'Summer organizing',
          topics: ['Election Defense'],
          sort_order: 1,
          published_at: '2026-07-01T00:00:00Z',
        },
      ];

      requireAdmin.mockResolvedValue({
        adminClient: createMockAdminClient({ newsletters: { rows: mockNewsletters } }),
      });

      const res = await getCivicNewslettersAdmin();
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.length).toBe(1);
        expect(res.data[0]?.title).toBe('Summer Bulletin');
      }
    });

    it('saves a newsletter and revalidates', async () => {
      const saved = {
        slug: 'bulletin-summer',
        title: 'Summer Bulletin',
        date_label: 'July 2026',
        description: 'Summer organizing',
        topics: ['Election Defense'],
        sort_order: 1,
        published_at: '2026-07-01T00:00:00Z',
      };

      requireAdmin.mockResolvedValue({
        adminClient: {
          from: () => ({
            upsert: () => ({
              select: () => ({
                single: async () => ({ data: saved, error: null }),
              }),
            }),
          }),
        },
      });

      const res = await saveCivicNewsletter(saved);
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.title).toBe('Summer Bulletin');
      }
    });

    it('deletes a newsletter by slug', async () => {
      requireAdmin.mockResolvedValue({
        adminClient: {
          from: () => ({
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        },
      });

      const res = await deleteCivicNewsletter('bulletin-summer');
      expect(res.success).toBe(true);
    });
  });

  describe('Coalition Links Admin Actions', () => {
    it('returns coalition links rows from Supabase', async () => {
      const mockLinks = [
        {
          slug: 'sister-district',
          name: 'Sister District Project',
          category: 'Electoral Strategy',
          url: 'https://sisterdistrict.com',
          description: 'Focusing resources on competitive state legislative races.',
          badge: 'Allies',
          sort_order: 10,
        },
      ];

      requireAdmin.mockResolvedValue({
        adminClient: createMockAdminClient({ coalition_links: { rows: mockLinks } }),
      });

      const res = await getCoalitionLinksAdmin();
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.length).toBe(1);
        expect(res.data[0]?.name).toBe('Sister District Project');
      }
    });

    it('validates and saves a coalition link', async () => {
      const saved = {
        slug: 'sister-district',
        name: 'Sister District Project',
        category: 'Electoral Strategy',
        url: 'https://sisterdistrict.com',
        description: 'Focusing resources on competitive state legislative races.',
        badge: 'Allies',
        sort_order: 10,
      };

      requireAdmin.mockResolvedValue({
        adminClient: {
          from: () => ({
            upsert: () => ({
              select: () => ({
                single: async () => ({ data: saved, error: null }),
              }),
            }),
          }),
        },
      });

      const res = await saveCoalitionLink(saved);
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.name).toBe('Sister District Project');
      }
    });

    it('rejects an invalid coalition link with missing fields', async () => {
      const invalid = {
        name: '',
        category: '',
        url: 'not-a-url',
        description: '',
      };

      const res = await saveCoalitionLink(
        invalid as unknown as Parameters<typeof saveCoalitionLink>[0]
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeDefined();
      }
    });

    it('deletes a coalition link by slug', async () => {
      requireAdmin.mockResolvedValue({
        adminClient: {
          from: () => ({
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        },
      });

      const res = await deleteCoalitionLink('sister-district');
      expect(res.success).toBe(true);
    });
  });
});
