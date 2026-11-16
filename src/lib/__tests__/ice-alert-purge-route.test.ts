// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAdminClient } from './supabase-mock';

const TEST_SECRET = vi.hoisted(() => 'test-ice-alert-cron-secret');
const getIceAlertStore = vi.hoisted(() => vi.fn());
const getIceReportStore = vi.hoisted(() => vi.fn());
const purgeExpiredIceReports = vi.hoisted(() => vi.fn(async () => 0));
const purgeExpiredPublicIceReports = vi.hoisted(() => vi.fn(async () => 0));
const isE2E = vi.hoisted(() => vi.fn(() => false));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SECRET_KEY: TEST_SECRET,
    CRON_SECRET: 'cron-secret',
  },
}));

vi.mock('@/lib/e2e-mode', () => ({ isE2EMode: isE2E }));

vi.mock('@/lib/ice-alert-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ice-alert-store')>();
  return {
    ...actual,
    getIceAlertStore: () => getIceAlertStore(),
  };
});

vi.mock('@/lib/ice-report-intake', () => ({
  getIceReportStore: () => getIceReportStore(),
  purgeExpiredIceReports,
  purgeExpiredPublicIceReports,
}));

const { POST } = await import('@/app/api/ice-rapid/purge/route');

const DAY = 24 * 60 * 60 * 1_000;

function ago(days: number) {
  return new Date(Date.now() - days * DAY).toISOString();
}

function subscriber(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    email: `${id}@example.com`,
    email_normalized: `${id}@example.com`,
    state_code: 'CA',
    city: 'Oakland',
    email_opt_in: true,
    push_opt_in: false,
    push_subscription: null,
    confirm_token: crypto.randomUUID(),
    confirm_token_expires_at: null,
    unsubscribe_token: crypto.randomUUID(),
    confirmed_at: '2026-01-01T00:00:00.000Z',
    confirmation_sent_at: null,
    last_notified_at: null,
    last_surge_key: null,
    unsubscribed_at: null,
    created_at: ago(60),
    updated_at: ago(60),
    ...overrides,
  };
}

function request(authorized = true) {
  return new Request('https://site.test/api/ice-rapid/purge', {
    method: 'POST',
    headers: authorized ? { authorization: 'Bearer cron-secret' } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  isE2E.mockReturnValue(false);
  getIceReportStore.mockReturnValue({});
  purgeExpiredIceReports.mockResolvedValue(0);
  purgeExpiredPublicIceReports.mockResolvedValue(0);
});

describe('POST /api/ice-rapid/purge retention', () => {
  it('deletes old pending and old unsubscribed rows but keeps live rows', async () => {
    const rows = [
      subscriber('pending-old', {
        confirmed_at: null,
        created_at: ago(8),
      }),
      subscriber('pending-new', {
        confirmed_at: null,
        created_at: ago(2),
        updated_at: ago(2),
      }),
      // A pending row created long ago but reissued a fresh confirmation link
      // today has a live token and must survive the purge.
      subscriber('pending-reactivated', {
        confirmed_at: null,
        created_at: ago(60),
        updated_at: ago(1),
      }),
      subscriber('confirmed-old', {
        confirmed_at: '2026-01-01T00:00:00.000Z',
        created_at: ago(60),
      }),
      subscriber('unsubscribed-old', {
        email_opt_in: false,
        confirmed_at: null,
        unsubscribed_at: ago(31),
      }),
      subscriber('unsubscribed-new', {
        email_opt_in: false,
        confirmed_at: null,
        unsubscribed_at: ago(3),
      }),
      // A long-unsubscribed row that just requested a fresh link has a live
      // token, so its old unsubscribe timestamp alone must not delete it.
      subscriber('unsubscribed-reactivated', {
        email_opt_in: false,
        confirmed_at: null,
        unsubscribed_at: ago(31),
        updated_at: ago(1),
      }),
    ];
    getIceAlertStore.mockReturnValue(
      createMockAdminClient({ ice_alert_subscribers: { rows } })
    );

    const response = await POST(request());
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      deleted: 2,
      pending: 1,
      unsubscribed: 1,
    });
    expect(rows.map((row) => row.id).sort()).toEqual([
      'confirmed-old',
      'pending-new',
      'pending-reactivated',
      'unsubscribed-new',
      'unsubscribed-reactivated',
    ]);
  });

  it('is a no-op when nothing has crossed a retention window', async () => {
    const rows = [
      subscriber('pending-new', {
        confirmed_at: null,
        created_at: ago(2),
        updated_at: ago(2),
      }),
      subscriber('unsubscribed-new', { unsubscribed_at: ago(3) }),
    ];
    getIceAlertStore.mockReturnValue(
      createMockAdminClient({ ice_alert_subscribers: { rows } })
    );

    const response = await POST(request());
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      deleted: 0,
      pending: 0,
      unsubscribed: 0,
    });
    expect(rows).toHaveLength(2);
  });

  it('requires the cron bearer secret', async () => {
    const rows = [subscriber('pending-old', { confirmed_at: null, created_at: ago(8) })];
    getIceAlertStore.mockReturnValue(
      createMockAdminClient({ ice_alert_subscribers: { rows } })
    );

    const response = await POST(request(false));

    expect(response.status).toBe(401);
    expect(rows).toHaveLength(1);
    expect(getIceAlertStore).not.toHaveBeenCalled();
  });

  it('skips deletion in an e2e build', async () => {
    isE2E.mockReturnValue(true);
    const rows = [subscriber('pending-old', { confirmed_at: null, created_at: ago(8) })];
    getIceAlertStore.mockReturnValue(
      createMockAdminClient({ ice_alert_subscribers: { rows } })
    );

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ skipped: 'test-build', deleted: 0 });
    expect(rows).toHaveLength(1);
  });

  it('fails closed when the store is not configured', async () => {
    getIceAlertStore.mockReturnValue(null);

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'store-not-configured' });
  });

  it('fails closed when the private report store is not configured', async () => {
    getIceAlertStore.mockReturnValue(createMockAdminClient({ ice_alert_subscribers: { rows: [] } }));
    getIceReportStore.mockReturnValue(null);

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'store-not-configured' });
  });

  it('reports a deletion failure instead of claiming the rows were removed', async () => {
    const rows = [subscriber('pending-old', { confirmed_at: null, created_at: ago(8) })];
    getIceAlertStore.mockReturnValue(
      createMockAdminClient({
        ice_alert_subscribers: {
          rows,
          deleteError: { message: 'permission denied' },
        },
      })
    );

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: 'server-error' });
    expect(rows).toHaveLength(1);
  });
});
