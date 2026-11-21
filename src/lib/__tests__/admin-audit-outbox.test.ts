// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  ADMIN_AUDIT_OUTBOX_DISPLAY_LIMIT,
  ADMIN_AUDIT_OUTBOX_FAILING_ATTEMPTS,
  getAdminAuditOutboxHealth,
  isAdminAuditOutboxRowFailing,
  isAdminAuditOutboxRowOverdue,
} from '@/lib/admin-audit-outbox';
import { createMockAdminClient } from './supabase-mock';

const NOW = new Date('2026-11-20T12:00:00.000Z');
const CHECKED_AT = NOW.toISOString();

function outboxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    created_at: '2026-11-20T11:40:00.000Z',
    attempts: 0,
    next_attempt_at: '2026-11-20T12:10:00.000Z',
    last_error: null,
    payload: {
      action: 'crm.contact.delete',
      target_type: 'crm_contact',
      target_id: 'contact-1',
      target_label: 'member@example.org',
      outcome: 'success',
      actor_email: 'organizer@example.org',
    },
    ...overrides,
  };
}

describe('getAdminAuditOutboxHealth', () => {
  it('counts overdue and repeatedly failing records separately and shows payload context', async () => {
    const rows = [
      outboxRow({
        id: 'overdue',
        created_at: '2026-11-20T11:20:00.000Z',
        attempts: 1,
        next_attempt_at: '2026-11-20T11:50:00.000Z',
        last_error: 'connection reset',
        payload: {
          action: 'crm.contact.delete',
          target_type: 'crm_contact',
          target_id: 'contact-1',
          target_label: 'Robin',
          outcome: 'success',
          actor_email: 'organizer@example.org',
        },
      }),
      outboxRow({
        id: 'failing',
        created_at: '2026-11-20T11:45:00.000Z',
        attempts: ADMIN_AUDIT_OUTBOX_FAILING_ATTEMPTS,
        next_attempt_at: '2026-11-20T12:10:00.000Z',
        last_error: 'audit table offline',
        payload: {
          action: 'content.publish',
          target_type: 'content',
          target_id: '42',
          target_label: 'Town Hall',
          outcome: 'success',
          actor_email: 'editor@example.org',
        },
      }),
      outboxRow({
        id: 'waiting',
        created_at: '2026-11-20T11:55:00.000Z',
        attempts: 0,
        next_attempt_at: '2026-11-20T12:05:00.000Z',
        payload: {
          action: 'crm.task.create',
          target_type: 'crm_task',
          target_id: 'task-1',
          target_label: 'Call Robin',
          outcome: 'success',
          actor_email: null,
        },
      }),
    ];
    const client = createMockAdminClient({ admin_audit_outbox: { rows } });

    const health = await getAdminAuditOutboxHealth(client, NOW);

    expect(health).toMatchObject({
      totalCount: 3,
      overdueCount: 1,
      failingCount: 1,
      severity: 'critical',
      checkedAt: CHECKED_AT,
    });
    // Repeated failures come first, then the oldest retry among the rest.
    expect(health.rows.map((row) => row.id)).toEqual(['failing', 'overdue', 'waiting']);
    expect(health.rows[0]).toMatchObject({
      action: 'content.publish',
      target_type: 'content',
      target_label: 'Town Hall',
      actor_email: 'editor@example.org',
      attempts: ADMIN_AUDIT_OUTBOX_FAILING_ATTEMPTS,
      last_error: 'audit table offline',
    });
    expect(health.rows[1]).toMatchObject({
      action: 'crm.contact.delete',
      target_type: 'crm_contact',
      target_label: 'Robin',
      actor_email: 'organizer@example.org',
      attempts: 1,
      last_error: 'connection reset',
    });
  });

  it('shows repeatedly failing rows ahead of a larger healthy backlog', async () => {
    const healthyRows = Array.from({ length: 75 }, (_, index) =>
      outboxRow({
        id: `healthy-${index}`,
        attempts: 1,
        next_attempt_at: '2026-11-20T11:50:00.000Z',
      })
    );
    const failingRows = Array.from({ length: 5 }, (_, index) =>
      outboxRow({
        id: `failing-${index}`,
        attempts: ADMIN_AUDIT_OUTBOX_FAILING_ATTEMPTS,
        next_attempt_at: '2026-11-20T12:30:00.000Z',
      })
    );
    const client = createMockAdminClient({
      admin_audit_outbox: { rows: [...healthyRows, ...failingRows] },
    });

    const health = await getAdminAuditOutboxHealth(client, NOW);

    expect(health.totalCount).toBe(80);
    expect(health.failingCount).toBe(5);
    expect(health.rows).toHaveLength(ADMIN_AUDIT_OUTBOX_DISPLAY_LIMIT);
    expect(health.rows.slice(0, 5).map((row) => row.id)).toEqual([
      'failing-0',
      'failing-1',
      'failing-2',
      'failing-3',
      'failing-4',
    ]);
  });

  it('keeps exact counts when the backlog is larger than the displayed slice', async () => {
    const rows = Array.from({ length: 75 }, (_, index) =>
      outboxRow({
        id: `row-${index}`,
        attempts: index < 10 ? ADMIN_AUDIT_OUTBOX_FAILING_ATTEMPTS : 1,
        next_attempt_at: index < 60 ? '2026-11-20T11:50:00.000Z' : '2026-11-20T12:10:00.000Z',
      })
    );
    const client = createMockAdminClient({ admin_audit_outbox: { rows } });

    const health = await getAdminAuditOutboxHealth(client, NOW);

    expect(health.totalCount).toBe(75);
    expect(health.overdueCount).toBe(60);
    expect(health.failingCount).toBe(10);
    expect(health.rows).toHaveLength(ADMIN_AUDIT_OUTBOX_DISPLAY_LIMIT);
    expect(health.severity).toBe('critical');
  });

  it('applies the grace period and attempt threshold exactly at the boundary', async () => {
    const client = createMockAdminClient({
      admin_audit_outbox: {
        rows: [
          outboxRow({ id: 'on-time', next_attempt_at: '2026-11-20T11:55:00.000Z' }),
          outboxRow({ id: 'late', next_attempt_at: '2026-11-20T11:54:59.999Z' }),
          outboxRow({ id: 'failing-2', attempts: ADMIN_AUDIT_OUTBOX_FAILING_ATTEMPTS - 1 }),
          outboxRow({ id: 'failing-3', attempts: ADMIN_AUDIT_OUTBOX_FAILING_ATTEMPTS }),
        ],
      },
    });

    const health = await getAdminAuditOutboxHealth(client, NOW);

    expect(health.overdueCount).toBe(1);
    expect(health.failingCount).toBe(1);
    expect(health.severity).toBe('critical');
  });

  it('reports a warning when rows are overdue but none has failed repeatedly', async () => {
    const client = createMockAdminClient({
      admin_audit_outbox: {
        rows: [
          outboxRow({
            id: 'late',
            attempts: 1,
            next_attempt_at: '2026-11-20T11:50:00.000Z',
          }),
        ],
      },
    });

    const health = await getAdminAuditOutboxHealth(client, NOW);

    expect(health.severity).toBe('warning');
    expect(health.overdueCount).toBe(1);
    expect(health.failingCount).toBe(0);
  });

  it('is healthy when every retry is still within its window', async () => {
    const client = createMockAdminClient({
      admin_audit_outbox: {
        rows: [outboxRow({ attempts: 1, next_attempt_at: '2026-11-20T12:10:00.000Z' })],
      },
    });

    const health = await getAdminAuditOutboxHealth(client, NOW);

    expect(health.severity).toBe('healthy');
    expect(health.totalCount).toBe(1);
    expect(health.overdueCount).toBe(0);
    expect(health.failingCount).toBe(0);
    expect(health.rows).toHaveLength(1);
  });

  it('treats the grace boundary as on time and marks the first millisecond past it overdue', () => {
    expect(
      isAdminAuditOutboxRowOverdue({ next_attempt_at: '2026-11-20T11:55:00.000Z' }, CHECKED_AT)
    ).toBe(false);
    expect(
      isAdminAuditOutboxRowOverdue({ next_attempt_at: '2026-11-20T11:54:59.999Z' }, CHECKED_AT)
    ).toBe(true);
    expect(isAdminAuditOutboxRowFailing({ attempts: 3 })).toBe(true);
    expect(isAdminAuditOutboxRowFailing({ attempts: 2 })).toBe(false);
  });

  it('rejects instead of reporting an empty outbox when the read fails', async () => {
    const client = createMockAdminClient({
      admin_audit_outbox: { rows: [], error: { message: 'outbox offline' } },
    });

    await expect(getAdminAuditOutboxHealth(client, NOW)).rejects.toThrow(
      /Could not load the audit outbox: outbox offline/i
    );
  });

  it('rejects when the database omits an exact count', async () => {
    const client = createMockAdminClient({
      admin_audit_outbox: { rows: [outboxRow()], count: null },
    });

    await expect(getAdminAuditOutboxHealth(client, NOW)).rejects.toThrow(
      /Could not count the audit outbox/i
    );
  });
});
