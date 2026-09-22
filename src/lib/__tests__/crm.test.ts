import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock env
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    RESEND_API_KEY: 're_test_dummy_key',
    RESEND_FROM_EMAIL: 'contact@indivisiblefairoaks.org',
    ADMIN_ORDER_EMAIL: 'contact@indivisiblefairoaks.org',
  },
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock sendEmail from '@/lib/email'
const mockSendEmail = vi.fn();
vi.mock('@/lib/email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email')>();
  return {
    ...actual,
    sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  };
});

// Mock requireAdmin
const mockAdminClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(async () => ({
    adminClient: mockAdminClient,
    adminUserId: 'admin-user-uuid-1234',
  })),
}));

import {
  addCRMNote,
  getBroadcastRecipientCount,
  getCRMContacts,
  getCRMStats,
  saveCRMContact,
  sendCRMBroadcast,
  sendCRMDirectEmail,
} from '@/lib/actions/crm';

// Helper to create a chainable query builder
function createMockQueryBuilder(terminalResult: Record<string, unknown> = {}) {
  const promise = Promise.resolve(terminalResult);
  const qb = Object.assign(promise, {
    select: vi.fn(() => qb),
    insert: vi.fn(() => qb),
    update: vi.fn(() => qb),
    delete: vi.fn(() => qb),
    eq: vi.fn(() => qb),
    in: vi.fn(() => qb),
    contains: vi.fn(() => qb),
    or: vi.fn(() => qb),
    order: vi.fn(() => qb),
    range: vi.fn(() => Promise.resolve(terminalResult)),
    single: vi.fn(() => Promise.resolve(terminalResult)),
    gt: vi.fn(() => Promise.resolve(terminalResult)),
  });
  return qb;
}

describe('Civic CRM Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveCRMContact', () => {
    it('creates a new contact with normalized email and logs initial activity', async () => {
      const qbContact = createMockQueryBuilder({
        data: { id: 'new-contact-123' },
        error: null,
      });
      const qbActivity = createMockQueryBuilder({
        data: null,
        error: null,
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') return qbContact;
        if (table === 'crm_activities') return qbActivity;
        return createMockQueryBuilder();
      });

      const res = await saveCRMContact({
        email: '  ACTIVIST@IndivisibleFairOaks.org  ',
        first_name: 'Jane',
        last_name: 'Organizer',
        district: 'CA-06',
        status: 'active_volunteer',
        tags: ['choir', 'mobilize'],
      });

      expect(res.success).toBe(true);
      expect(res.contactId).toBe('new-contact-123');
      expect(qbContact.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'activist@indivisiblefairoaks.org',
          first_name: 'Jane',
          status: 'active_volunteer',
          source: 'manual',
        })
      );
      expect(qbActivity.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'new-contact-123',
          type: 'note',
          title: 'Constituent Created',
          created_by: 'admin-user-uuid-1234',
        })
      );
    });

    it('rejects invalid email addresses', async () => {
      const res = await saveCRMContact({
        email: 'not-an-email',
        first_name: 'Test',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('updates an existing contact when valid uuid is provided', async () => {
      const validUuid = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
      const qbContact = createMockQueryBuilder({
        data: { id: validUuid },
        error: null,
      });
      const qbActivity = createMockQueryBuilder({
        data: null,
        error: null,
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') return qbContact;
        if (table === 'crm_activities') return qbActivity;
        return createMockQueryBuilder();
      });

      const res = await saveCRMContact({
        id: validUuid,
        email: 'jane@example.com',
        first_name: 'Jane',
        status: 'organizer',
        tags: ['leadership'],
      });

      expect(res.success).toBe(true);
      expect(res.contactId).toBe(validUuid);
      expect(qbContact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Jane',
          status: 'organizer',
        })
      );
    });
  });

  describe('getCRMStats', () => {
    it('aggregates constituent metrics and donor totals correctly', async () => {
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') {
          return {
            select: vi.fn((_cols, options) => {
              if (options?.head) {
                return {
                  count: 42,
                  in: vi.fn().mockResolvedValue({ count: 15 }),
                };
              }
              return {
                gt: vi.fn().mockResolvedValue({
                  data: [{ total_donated_cents: 5000 }, { total_donated_cents: 10000 }],
                }),
              };
            }),
          };
        }
        return createMockQueryBuilder();
      });

      const stats = await getCRMStats();
      expect(stats.totalContacts).toBe(42);
      expect(stats.totalDonors).toBe(2);
      expect(stats.totalDonationsCents).toBe(15000);
    });
  });

  describe('getCRMContacts', () => {
    it('applies query filters and pagination range', async () => {
      const qb = createMockQueryBuilder({
        data: [{ id: '1', email: 'test@example.com' }],
        count: 1,
        error: null,
      });

      mockAdminClient.from.mockReturnValue(qb);

      const res = await getCRMContacts({
        status: 'active_volunteer',
        district: 'CA-06',
        tag: 'choir',
        query: 'jane',
        page: 2,
        pageSize: 10,
      });

      expect(qb.eq).toHaveBeenCalledWith('status', 'active_volunteer');
      expect(qb.eq).toHaveBeenCalledWith('district', 'CA-06');
      expect(qb.contains).toHaveBeenCalledWith('tags', ['choir']);
      expect(qb.range).toHaveBeenCalledWith(10, 19);
      expect(res.contacts).toHaveLength(1);
    });
  });

  describe('addCRMNote', () => {
    it('creates a note activity linked to the contact', async () => {
      const qb = createMockQueryBuilder({ data: null, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const res = await addCRMNote({
        contactId: 'contact-uuid-1',
        title: 'Attended Rally',
        description: 'Brought 4 neighbors and signed up for phonebank.',
      });

      expect(res.success).toBe(true);
      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'contact-uuid-1',
          type: 'note',
          title: 'Attended Rally',
          description: 'Brought 4 neighbors and signed up for phonebank.',
          created_by: 'admin-user-uuid-1234',
        })
      );
    });

    it('rejects note with empty title', async () => {
      const res = await addCRMNote({
        contactId: 'contact-uuid-1',
        title: '   ',
        description: 'desc',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Title is required');
    });
  });

  describe('sendCRMDirectEmail', () => {
    it('dispatches email through Resend and logs activity', async () => {
      const qbContact = createMockQueryBuilder({
        data: {
          id: 'c-1',
          email: 'neighbor@example.com',
          first_name: 'Neighbor',
          last_name: 'Person',
        },
        error: null,
      });
      const qbActivity = createMockQueryBuilder({ data: null, error: null });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') return qbContact;
        if (table === 'crm_activities') return qbActivity;
        return createMockQueryBuilder();
      });

      mockSendEmail.mockResolvedValue({ ok: true, id: 'resend_msg_123' });

      const res = await sendCRMDirectEmail({
        contactId: 'c-1',
        subject: 'Welcome to the Movement',
        message: 'Thank you for connecting with Indivisible Fair Oaks!',
      });

      expect(res.success).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'neighbor@example.com',
          subject: 'Welcome to the Movement',
          replyTo: 'contact@indivisiblefairoaks.org',
        })
      );
      expect(qbActivity.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'c-1',
          type: 'email_sent',
          metadata: expect.objectContaining({ resend_id: 'resend_msg_123' }),
        })
      );
    });
  });

  describe('getBroadcastRecipientCount & sendCRMBroadcast', () => {
    it('calculates recipient count based on criteria', async () => {
      const qb = createMockQueryBuilder({ count: 28, error: null });
      mockAdminClient.from.mockReturnValue(qb);

      const count = await getBroadcastRecipientCount({
        targetStatus: ['active_volunteer'],
        targetDistricts: ['CA-06'],
        targetTags: ['choir'],
      });

      expect(count).toBe(28);
      expect(qb.in).toHaveBeenCalledWith('status', ['active_volunteer']);
      expect(qb.in).toHaveBeenCalledWith('district', ['CA-06']);
      expect(qb.contains).toHaveBeenCalledWith('tags', ['choir']);
    });

    it('broadcasts to matched recipients and updates campaign status', async () => {
      const recipients = [
        { id: 'u1', email: 'vol1@example.com', first_name: 'Alice', last_name: 'Smith' },
        { id: 'u2', email: 'vol2@example.com', first_name: 'Bob', last_name: 'Jones' },
      ];

      const qbContacts = createMockQueryBuilder({ data: recipients, error: null });
      const qbBroadcasts = createMockQueryBuilder({
        data: { id: 'broadcast-uuid-1' },
        error: null,
      });
      const qbActivities = createMockQueryBuilder({ data: null, error: null });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'crm_contacts') return qbContacts;
        if (table === 'crm_broadcasts') return qbBroadcasts;
        if (table === 'crm_activities') return qbActivities;
        return createMockQueryBuilder();
      });

      mockSendEmail.mockResolvedValue({ ok: true, id: 'resend-blast-1' });

      const res = await sendCRMBroadcast({
        subject: 'Chapter Meeting Next Tuesday',
        body: 'Please attend our monthly general meeting.',
        targetStatus: ['active_volunteer'],
      });

      expect(res.success).toBe(true);
      expect(res.recipientCount).toBe(2);
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
      expect(qbBroadcasts.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          recipient_count: 2,
        })
      );
    });
  });
});
