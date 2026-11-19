// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock('server-only', () => ({}));

const mockAdminClient = { from: vi.fn(), rpc: vi.fn() };

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(async () => ({
    adminClient: mockAdminClient,
    adminUserId: 'admin-user-uuid-1234',
    adminEmail: 'organizer@indivisiblefairoaks.org',
    mfaLevel: 'aal2',
  })),
}));

import { previewBulkCRMContactUpdate } from '@/lib/actions/crm';
import type { MockTableConfig } from './supabase-mock';
import { createMockAdminClient } from './supabase-mock';

let tables: Record<string, MockTableConfig>;

describe('previewBulkCRMContactUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminClient.from.mockReset();
    tables = {};
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);
  });

  it('reports status distribution and excludes contacts already at the planned value', async () => {
    tables.crm_contacts = {
      rows: [
        { id: 'c1', status: 'supporter' },
        { id: 'c2', status: 'active_volunteer' },
        { id: 'c3', status: 'organizer' },
      ],
    };

    const res = await previewBulkCRMContactUpdate({
      contactIds: ['c1', 'c2', 'c3', 'missing'],
      status: 'organizer',
    });

    expect(res.success).toBe(true);
    expect(res.preview).toMatchObject({
      field: 'status',
      selectedCount: 4,
      foundCount: 3,
      changedCount: 2,
      unchangedCount: 1,
      plannedValue: 'organizer',
    });
    expect(res.preview?.distribution).toEqual([
      { value: 'active_volunteer', count: 1 },
      { value: 'organizer', count: 1 },
      { value: 'supporter', count: 1 },
    ]);
  });

  it('maps the tri-state consent column into its three current values', async () => {
    tables.crm_contacts = {
      rows: [
        { id: 'c1', do_not_email: false },
        { id: 'c2', do_not_email: true },
        { id: 'c3', do_not_email: null },
      ],
    };

    const res = await previewBulkCRMContactUpdate({
      contactIds: ['c1', 'c2', 'c3'],
      consent: 'opted_out',
    });

    expect(res.preview).toMatchObject({
      field: 'consent',
      changedCount: 2,
      unchangedCount: 1,
      plannedValue: 'opted_out',
    });
    expect(res.preview?.distribution).toEqual([
      { value: 'opted_in', count: 1 },
      { value: 'opted_out', count: 1 },
      { value: 'unasked', count: 1 },
    ]);
  });

  it('reports district distribution, including contacts with no district', async () => {
    tables.crm_contacts = {
      rows: [
        { id: 'c1', district: 'CA-06' },
        { id: 'c2', district: null },
        { id: 'c3', district: 'CA-03' },
        { id: 'c4', district: 'CA-06' },
      ],
    };

    const res = await previewBulkCRMContactUpdate({
      contactIds: ['c1', 'c2', 'c3', 'c4'],
      district: 'CA-06',
    });

    expect(res.preview).toMatchObject({
      field: 'district',
      changedCount: 2,
      unchangedCount: 2,
      plannedValue: 'CA-06',
    });
    expect(
      Object.fromEntries((res.preview?.distribution ?? []).map((e) => [e.value, e.count]))
    ).toEqual({ '': 1, 'CA-03': 1, 'CA-06': 2 });
  });

  it('counts a tag case-insensitively and reports untagged contacts', async () => {
    tables.crm_contacts = {
      rows: [
        { id: 'c1', tags: ['Canvass', 'donor'] },
        { id: 'c2', tags: ['other'] },
        { id: 'c3', tags: null },
      ],
    };

    const res = await previewBulkCRMContactUpdate({
      contactIds: ['c1', 'c2', 'c3'],
      addTag: 'canvass',
    });

    expect(res.preview).toMatchObject({
      field: 'tags',
      changedCount: 2,
      unchangedCount: 1,
      plannedValue: 'canvass',
    });
    expect(
      Object.fromEntries((res.preview?.distribution ?? []).map((e) => [e.value, e.count]))
    ).toEqual({ '': 1, Canvass: 1, donor: 1, other: 1 });
  });

  it('rejects ambiguous or invalid plans without reading contacts', async () => {
    const ambiguous = await previewBulkCRMContactUpdate({
      contactIds: ['c1'],
      status: 'supporter',
      consent: 'opted_in',
    });
    expect(ambiguous).toEqual({
      success: false,
      error: 'Choose exactly one bulk change to preview',
    });

    const invalidTag = await previewBulkCRMContactUpdate({
      contactIds: ['c1'],
      addTag: 'has,comma',
    });
    expect(invalidTag.success).toBe(false);
    expect(invalidTag.error).toMatch(/^Invalid tag/);
    expect(mockAdminClient.from).not.toHaveBeenCalled();
  });

  it('surfaces a read failure instead of showing an empty distribution', async () => {
    tables.crm_contacts = { rows: [], error: { message: 'connection reset' } };

    const res = await previewBulkCRMContactUpdate({
      contactIds: ['c1'],
      status: 'organizer',
    });

    expect(res).toEqual({ success: false, error: 'connection reset' });
  });
});
