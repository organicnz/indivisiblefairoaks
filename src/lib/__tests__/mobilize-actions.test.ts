// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-auth', () => ({ requireAdmin }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/env', () => ({ env: {} }));

const {
  getMobilizeEventPreview,
  getMobilizeSyncRuns,
  importMobilizeEvent,
  previewMobilizeSource,
  runMobilizeSyncNow,
  saveMobilizeSettings,
  setEventSyncLock,
  setMobilizeEventHidden,
  setMobilizeRule,
} = await import('@/lib/actions/mobilize');
const { createMockAdminClient } = await import('./supabase-mock');

import { env } from '@/lib/env';
import type { MockTableConfig } from './supabase-mock';

const ADMIN = {
  adminUserId: 'admin-user-uuid-1234',
  adminEmail: 'organizer@indivisiblefairoaks.org',
  mfaLevel: 'aal2' as const,
};

const asAdmin = (adminClient: unknown) => ({ ...ADMIN, adminClient });

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
    vi.fn(
      async () =>
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
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await importMobilizeEvent('https://www.mobilize.us/indivisible/event/1011420/');

    expect(res).toMatchObject({ success: false, error: 'connection reset' });
    expect(tables.events.rows).toHaveLength(0);
  });

  it('audits a newly created event', async () => {
    respondWithEvent();
    const tables: Record<string, MockTableConfig> = {
      events: { rows: [] },
      admin_audit_log: { rows: [] },
    };
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await importMobilizeEvent('https://www.mobilize.us/indivisible/event/1011420/');

    expect(res).toMatchObject({ success: true, data: { converted: false } });
    expect(tables.events.rows).toHaveLength(1);
    expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
      action: 'mobilize.event.import',
      target_type: 'event',
      target_id: expect.any(String),
      outcome: 'success',
      metadata: { external_id: '1011420', mode: 'created' },
    });
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
      admin_audit_log: { rows: [] },
    };
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await importMobilizeEvent('https://www.mobilize.us/indivisible/event/1011420/');

    expect(res).toMatchObject({
      success: true,
      data: { slug: 'handmade-event', converted: true },
    });
    expect(tables.events.rows?.[0]).toMatchObject({ external_id: '1011420' });
    expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
      action: 'mobilize.event.import',
      target_type: 'event',
      target_id: 'handmade-event',
      outcome: 'success',
      metadata: { external_id: '1011420', mode: 'adopted' },
    });
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
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await importMobilizeEvent('https://www.mobilize.us/indivisible/event/1011420/');

    expect(res).toMatchObject({ success: false, error: 'connection reset' });
    expect(tables.events.rows).toHaveLength(0);
  });

  it('reports an already-owned event removed before the refresh write', async () => {
    respondWithEvent();
    requireAdmin.mockResolvedValue({
      ...ADMIN,
      adminClient: {
        from: () => ({
          insert: async () => ({ error: null }),
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

    const res = await importMobilizeEvent('https://www.mobilize.us/indivisible/event/1011420/');

    expect(res).toEqual({ success: false, error: 'That event no longer exists' });
  });

  it('reports a hand-made event removed before the adoption write', async () => {
    respondWithEvent();
    requireAdmin.mockResolvedValue({
      ...ADMIN,
      adminClient: {
        from: () => ({
          insert: async () => ({ error: null }),
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

    const res = await importMobilizeEvent('https://www.mobilize.us/indivisible/event/1011420/');

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
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

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
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await previewMobilizeSource();

    expect(res).toMatchObject({ success: false, error: 'connection reset' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Mobilize action boundaries', () => {
  it('requires an admin before previewing a Mobilize event', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    requireAdmin.mockRejectedValue(new Error('Not authenticated'));

    const res = await getMobilizeEventPreview('https://www.mobilize.us/event/1011420/');

    expect(res).toEqual({ success: false, error: 'Not authenticated' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects an unknown per-event action before writing', async () => {
    const res = await setMobilizeRule('1011420', 'delete' as unknown as 'pin');

    expect(res).toEqual({ success: false, error: 'Invalid event rule action' });
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it('rejects non-boolean visibility and sync-lock values', async () => {
    await expect(setMobilizeEventHidden('1011420', 'yes' as unknown as boolean)).resolves.toEqual({
      success: false,
      error: 'Invalid visibility value',
    });
    await expect(setEventSyncLock('mobilize-1011420', 1 as unknown as boolean)).resolves.toEqual({
      success: false,
      error: 'Invalid sync lock value',
    });
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it('falls back to a safe limit when sync history receives NaN', async () => {
    const tables: Record<string, MockTableConfig> = {
      mobilize_sync_runs: {
        rows: [
          {
            id: 1,
            started_at: '2026-11-18T00:00:00Z',
            finished_at: null,
            checked: 1,
            imported: 0,
            updated: 0,
            hidden: 0,
            filtered: 0,
            error: null,
          },
        ],
      },
    };
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await getMobilizeSyncRuns(Number.NaN);

    expect(res).toMatchObject({ success: true });
    expect(res).toHaveProperty('data');
  });
});

describe('Mobilize event toggles', () => {
  it('reports a missing event when hiding it', async () => {
    const tables: Record<string, MockTableConfig> = {
      events: { rows: [] },
      admin_audit_log: { rows: [] },
    };
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await setMobilizeEventHidden('1011420', true);

    expect(res).toMatchObject({ success: false, error: 'That event no longer exists' });
    expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
      action: 'mobilize.event.visibility',
      outcome: 'failure',
      after: { is_hidden: true },
    });
  });

  it('reports a missing event when locking it', async () => {
    const tables: Record<string, MockTableConfig> = { events: { rows: [] } };
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await setEventSyncLock('mobilize-1011420', true);

    expect(res).toMatchObject({ success: false, error: 'That event no longer exists' });
  });

  it('updates an existing imported event when hiding it', async () => {
    const tables: Record<string, MockTableConfig> = {
      events: {
        rows: [{ id: 7, slug: 'mobilize-1011420', external_id: '1011420', is_hidden: false }],
      },
      admin_audit_log: { rows: [] },
    };
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await setMobilizeEventHidden('1011420', true);

    expect(res).toMatchObject({ success: true, data: null });
    expect(tables.events.rows?.[0]).toMatchObject({ is_hidden: true });
    expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
      action: 'mobilize.event.visibility',
      target_id: '1011420',
      outcome: 'success',
      after: { is_hidden: true },
    });
  });

  it('audits a successful sync-lock change', async () => {
    const tables: Record<string, MockTableConfig> = {
      events: {
        rows: [{ id: 7, slug: 'mobilize-1011420', sync_locked: false }],
      },
      admin_audit_log: { rows: [] },
    };
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await setEventSyncLock('mobilize-1011420', true);

    expect(res).toMatchObject({ success: true, data: null });
    expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
      action: 'mobilize.event.sync_lock',
      target_id: 'mobilize-1011420',
      outcome: 'success',
      after: { sync_locked: true },
    });
  });
});

describe('Mobilize settings and rules audits', () => {
  it('audits saved settings', async () => {
    const tables: Record<string, MockTableConfig> = {
      mobilize_settings: { rows: [] },
      admin_audit_log: { rows: [] },
    };
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await saveMobilizeSettings({
      enabled: true,
      org_id: 1,
      zipcode: '95628',
      max_dist: 30,
      locality_allowlist: ['Fair Oaks'],
      include_virtual: false,
      high_priority_only: false,
      auto_publish: true,
    });

    expect(res).toMatchObject({ success: true });
    expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
      action: 'mobilize.settings.save',
      target_type: 'mobilize_settings',
      target_id: '1',
      outcome: 'success',
    });
  });

  it('audits a pin rule', async () => {
    const tables: Record<string, MockTableConfig> = {
      mobilize_event_rules: { rows: [] },
      admin_audit_log: { rows: [] },
    };
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await setMobilizeRule('1011420', 'pin');

    expect(res).toEqual({ success: true, data: null });
    expect(tables.admin_audit_log.rows?.[0]).toMatchObject({
      action: 'mobilize.event.rule',
      target_type: 'mobilize_event_rule',
      target_id: '1011420',
      outcome: 'success',
      after: { external_id: '1011420', action: 'pin' },
    });
  });

  it('audits a manual sync run', async () => {
    const mockEnv = env as unknown as Record<string, string | undefined>;
    mockEnv.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    mockEnv.SUPABASE_SECRET_KEY = 'secret';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ checked: 1, imported: 0 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
      )
    );
    const tables: Record<string, MockTableConfig> = { admin_audit_log: { rows: [] } };
    requireAdmin.mockResolvedValue(asAdmin(createMockAdminClient(tables)));

    const res = await runMobilizeSyncNow();

    expect(res).toMatchObject({ success: true, data: { checked: 1 } });
    const audit = tables.admin_audit_log.rows?.[0];
    expect(audit).toMatchObject({
      action: 'mobilize.sync.run',
      target_type: 'mobilize_sync',
      outcome: 'success',
      actor_user_id: ADMIN.adminUserId,
      metadata: { requested_by: ADMIN.adminUserId },
    });
    const targetId = String(audit?.target_id);
    expect(targetId).not.toBe(ADMIN.adminUserId);
    expect(targetId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
