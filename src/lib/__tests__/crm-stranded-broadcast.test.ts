import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markCRMBroadcastFailed } from '@/lib/actions/crm';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock('server-only', () => ({}));

const mockAdminClient = { from: vi.fn(), rpc: vi.fn() };
const session = vi.hoisted(() => ({ adminUserId: 'admin-user-uuid-1234' }));

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(async () => ({
    adminClient: mockAdminClient,
    get adminUserId() {
      return session.adminUserId;
    },
    get adminEmail() {
      return 'organizer@indivisiblefairoaks.org';
    },
  })),
}));

import type { MockTableConfig } from './supabase-mock';
import { createMockAdminClient } from './supabase-mock';

/**
 * `markCRMBroadcastFailed` — the one-directional escape hatch for a stranded send.
 *
 * `docs/crm-operations.md` documents the recovery for a row stuck at `sending`
 * and is emphatic that it must not be re-dispatched: clearing `dispatched_at`
 * re-mails everyone already delivered to. That guidance was correct and had no
 * UI behind it, so the only options were waiting or editing the database by hand.
 *
 * These tests are mostly about the refusals. The irreversible mistake available
 * here is cutting short a send that is merely slow, so every path that could do
 * that has to be refused — and a refusal that is easy to reach is a refusal that
 * gets reached.
 */
let tables: Record<string, MockTableConfig>;

/** 20 minutes ago: outside the "may still be delivering" window. */
const STALE = new Date(Date.now() - 20 * 60_000).toISOString();

/** 2 minutes ago: inside it. */
const RECENT = new Date(Date.now() - 2 * 60_000).toISOString();

const strandedRow = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  subject: 'Rally tomorrow',
  status: 'sending',
  recipient_count: 500,
  sent_count: 120,
  failed_count: 3,
  dispatched_at: STALE,
  ...over,
});

describe('markCRMBroadcastFailed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminClient.from.mockReset();
    mockAdminClient.rpc.mockReset();
    tables = {};
    mockAdminClient.from.mockImplementation(createMockAdminClient(tables).from);
  });

  afterEach(() => {
    session.adminUserId = 'admin-user-uuid-1234';
  });

  it('marks a genuinely stranded row failed, with the undelivered remainder as the count', async () => {
    tables.crm_broadcasts = { rows: [strandedRow()] };

    const res = await markCRMBroadcastFailed('b1');

    expect(res.success).toBe(true);
    const row = tables.crm_broadcasts.rows?.[0];
    expect(row?.status).toBe('failed');
    // 500 - 120 = 380 never reached. Reporting `failed_count: 0` here would make
    // the history row claim a campaign went to everyone.
    expect(row?.failed_count).toBe(380);
    // Both audit columns, so a reader six months later can tell a sender-reported
    // failure from an organizer's decision.
    expect(row?.marked_failed_at).toBeTruthy();
    expect(row?.marked_failed_by).toBe('admin-user-uuid-1234');
  });

  it('never reports a negative remainder', async () => {
    // A row can hold more `sent_count` than `recipient_count` after a re-send or
    // a manual correction, and a negative count renders as "−40 did not send".
    tables.crm_broadcasts = {
      rows: [strandedRow({ recipient_count: 10, sent_count: 40 })],
    };

    await markCRMBroadcastFailed('b1');

    expect(tables.crm_broadcasts.rows?.[0]?.failed_count).toBe(0);
  });

  /**
   * The refusal that matters most. 5,000 recipients at ten per provider round
   * trip is a genuinely long send, so "still sending" is often just "sending",
   * and marking one of those dead would have the chapter believe the remainder
   * was never contacted when the sender may still be delivering it.
   */
  it('refuses a row dispatched in the last fifteen minutes', async () => {
    tables.crm_broadcasts = { rows: [strandedRow({ dispatched_at: RECENT })] };

    const res = await markCRMBroadcastFailed('b1');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/15 minutes/i);
    expect(tables.crm_broadcasts.rows?.[0]?.status).toBe('sending');
    expect(tables.crm_broadcasts.rows?.[0]?.marked_failed_at).toBeFalsy();
  });

  it('refuses a row that already finished', async () => {
    tables.crm_broadcasts = { rows: [strandedRow({ status: 'sent' })] };

    const res = await markCRMBroadcastFailed('b1');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/already finished/i);
    expect(tables.crm_broadcasts.rows?.[0]?.marked_failed_at).toBeFalsy();
  });

  /**
   * A draft is not a stuck campaign, and the wording matters: telling someone to
   * "mark a draft failed" invites them to look for a failure state a draft cannot
   * reach. It points at the control that does apply.
   */
  it('points at Discard for a draft rather than offering to fail it', async () => {
    tables.crm_broadcasts = { rows: [strandedRow({ status: 'draft' })] };

    const res = await markCRMBroadcastFailed('b1');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/discard/i);
  });

  it('refuses a row that no longer exists', async () => {
    tables.crm_broadcasts = { rows: [] };

    const res = await markCRMBroadcastFailed('gone');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no longer exists/i);
  });

  /**
   * `dispatched_at: null` is the never-dispatched case, and it must not be
   * treated as "recently dispatched" by accident. `Date.parse(null)` is NaN and a
   * NaN comparison is false, so this passes through to the update — which is
   * correct, and worth pinning because the alternative reading (refuse, because
   * we cannot tell how old it is) is equally defensible and would leave a queued
   * row permanently unmarkable.
   */
  it('allows a queued row that was never dispatched', async () => {
    tables.crm_broadcasts = {
      rows: [strandedRow({ status: 'queued', dispatched_at: null })],
    };

    const res = await markCRMBroadcastFailed('b1');

    expect(res.success).toBe(true);
    expect(tables.crm_broadcasts.rows?.[0]?.status).toBe('failed');
  });

  it('reports a read failure rather than assuming the row is stray', async () => {
    tables.crm_broadcasts = { rows: [], error: { message: 'connection reset' } };

    const res = await markCRMBroadcastFailed('b1');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/connection reset/);
  });

  /**
   * The race the status predicate closes. The guard is evaluated on a read, so
   * a sender `finish()` landing between the read and the write used to turn a
   * delivered campaign into `failed` with `failed_count = 0` — the write
   * matched on `.eq('id', …)` alone. Now the write carries
   * `.in('status', ['queued', 'sending'])`, so zero rows match and nothing
   * changes.
   *
   * Forced by serving a stranded row to the read and a finished row to the
   * write: the mock reads `config.rows` at query time, so a getter counts the
   * accesses. First access (the guard's read) sees `sending`; every later
   * access sees `sent`. If the write ever drops its predicate again, this is
   * the test that notices — it is the only one in the file where the read and
   * the write disagree.
   */
  it('refuses a preview row, which is not a campaign', async () => {
    // The composer hides this control for `test_only` rows, but hiding is not
    // a boundary — the action is. A preview stranded at `sending` is a stuck
    // preview, and marking it failed would write an organizer's fingerprints
    // onto a row whose only reader is the sender's own poll loop.
    tables.crm_broadcasts = { rows: [strandedRow({ test_only: true })] };

    const res = await markCRMBroadcastFailed('b1');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/preview/i);
    expect(tables.crm_broadcasts.rows?.[0]?.status).toBe('sending');
    expect(tables.crm_broadcasts.rows?.[0]?.marked_failed_at).toBeFalsy();
  });

  it('changes nothing when the campaign finishes between the read and the write', async () => {
    const finished = {
      ...strandedRow({
        status: 'sent',
        sent_count: 500,
        failed_count: 0,
      }),
      marked_failed_at: null,
      marked_failed_by: null,
    };
    let accesses = 0;
    tables.crm_broadcasts = { rows: [strandedRow()] };
    Object.defineProperty(tables.crm_broadcasts, 'rows', {
      configurable: true,
      get: () => {
        accesses += 1;
        return accesses === 1 ? [strandedRow()] : [finished];
      },
    });

    const res = await markCRMBroadcastFailed('b1');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/finished while you were deciding/i);
    // The write ran against the finished row and matched nothing: the status
    // predicate held. A subsequent read still shows the delivered campaign
    // untouched, with no organizer fingerprints on it.
    const after = tables.crm_broadcasts.rows?.[0] as Record<string, unknown>;
    expect(after?.status).toBe('sent');
    expect(after?.marked_failed_at).toBeFalsy();
    expect(after?.marked_failed_by).toBeFalsy();
  });
});
