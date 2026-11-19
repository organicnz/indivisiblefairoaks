// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recordAdminAudit } = await import('@/lib/admin-audit');

const entry = {
  actorUserId: 'admin-user-123',
  actorEmail: 'organizer@example.org',
  action: 'crm.contact.delete' as const,
  targetType: 'crm_contact' as const,
  targetId: 'contact-456',
  targetLabel: 'Robin@example.org',
  before: { id: 'contact-456', email: 'robin@example.org', tags: ['choir'] },
  after: null,
  mfaLevel: 'aal2' as const,
  outcome: 'success' as const,
};

function clientWith(
  auditInsert: ReturnType<typeof vi.fn>,
  outboxInsert: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue({ error: null })
) {
  return {
    from: vi.fn((table: string) => ({
      insert: table === 'admin_audit_outbox' ? outboxInsert : auditInsert,
    })),
    auditInsert,
    outboxInsert,
  };
}

describe('recordAdminAudit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the actor, target, before/after values, MFA level and outcome', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = clientWith(insert);

    await expect(recordAdminAudit(client, entry)).resolves.toEqual({ ok: true });

    expect(client.from).toHaveBeenCalledWith('admin_audit_log');
    expect(insert).toHaveBeenCalledWith({
      id: expect.any(String),
      actor_user_id: 'admin-user-123',
      actor_email: 'organizer@example.org',
      action: 'crm.contact.delete',
      target_type: 'crm_contact',
      target_id: 'contact-456',
      target_label: 'Robin@example.org',
      before: { id: 'contact-456', email: 'robin@example.org', tags: ['choir'] },
      after: null,
      mfa_level: 'aal2',
      outcome: 'success',
      error: null,
      metadata: null,
    });
  });

  it('records a failed outcome with its error', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = clientWith(insert);

    await recordAdminAudit(client, {
      ...entry,
      outcome: 'failure',
      error: 'permission denied',
      after: { id: 'contact-456', deleted: false },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failure',
        error: 'permission denied',
        after: { id: 'contact-456', deleted: false },
      })
    );
  });

  it('never turns a completed mutation into a failure when the audit write fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const insert = vi.fn().mockResolvedValue({ error: { message: 'audit table offline' } });

    await expect(recordAdminAudit(clientWith(insert), entry)).resolves.toEqual({
      ok: false,
      error: 'audit table offline',
      queued: true,
    });
    // Transient faults are retried before the caller is told delivery failed.
    expect(insert).toHaveBeenCalledTimes(3);
    expect(consoleError).toHaveBeenCalledWith(
      '[admin-audit] write failed',
      expect.objectContaining({
        action: 'crm.contact.delete',
        error: 'audit table offline',
        attempts: 3,
      })
    );
  });

  it('retries a transient insert failure and keeps one idempotency id', async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: 'connection reset' } })
      .mockResolvedValueOnce({ error: null });

    await expect(recordAdminAudit(clientWith(insert), entry)).resolves.toEqual({ ok: true });

    expect(insert).toHaveBeenCalledTimes(2);
    const ids = insert.mock.calls.map(([payload]) => payload.id);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('treats a duplicate id after an unacknowledged insert as delivered', async () => {
    const insert = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket closed after commit'))
      .mockResolvedValueOnce({
        error: { message: 'duplicate key value violates unique constraint', code: '23505' },
      });

    await expect(recordAdminAudit(clientWith(insert), entry)).resolves.toEqual({ ok: true });

    expect(insert).toHaveBeenCalledTimes(2);
    const ids = insert.mock.calls.map(([payload]) => payload.id);
    expect(ids[0]).toBe(ids[1]);
  });

  it('catches a throwing client instead of failing the mutation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const insert = vi.fn().mockRejectedValue(new Error('connection reset'));

    await expect(recordAdminAudit(clientWith(insert), entry)).resolves.toEqual({
      ok: false,
      error: 'connection reset',
      queued: true,
    });
    expect(insert).toHaveBeenCalledTimes(3);
    expect(consoleError).toHaveBeenCalledWith(
      '[admin-audit] write threw',
      expect.objectContaining({ error: 'connection reset', attempts: 3 })
    );
  });

  it('persists the complete failed payload to the durable outbox', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const insert = vi.fn().mockResolvedValue({ error: { message: 'audit table offline' } });
    const outboxInsert = vi.fn().mockResolvedValue({ error: null });
    const client = clientWith(insert, outboxInsert);

    await expect(recordAdminAudit(client, entry)).resolves.toEqual({
      ok: false,
      error: 'audit table offline',
      queued: true,
    });

    expect(outboxInsert).toHaveBeenCalledTimes(1);
    const payload = insert.mock.calls[0]?.[0];
    expect(outboxInsert).toHaveBeenCalledWith({
      id: payload.id,
      payload,
      last_error: 'audit table offline',
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[admin-audit] write failed',
      expect.objectContaining({ queued: true, attempts: 3 })
    );
  });

  it('retries a transient outbox failure before declaring the record lost', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const insert = vi.fn().mockResolvedValue({ error: { message: 'audit table offline' } });
    const outboxInsert = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: 'pooler reset' } })
      .mockResolvedValueOnce({ error: null });

    await expect(recordAdminAudit(clientWith(insert, outboxInsert), entry)).resolves.toEqual({
      ok: false,
      error: 'audit table offline',
      queued: true,
    });
    expect(outboxInsert).toHaveBeenCalledTimes(2);
  });

  it('reports queued:false when the outbox also rejects the record', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const insert = vi.fn().mockResolvedValue({ error: { message: 'audit table offline' } });
    const outboxInsert = vi.fn().mockResolvedValue({ error: { message: 'outbox offline' } });

    await expect(recordAdminAudit(clientWith(insert, outboxInsert), entry)).resolves.toEqual({
      ok: false,
      error: 'audit table offline',
      queued: false,
    });

    expect(consoleError).toHaveBeenCalledWith('[admin-audit] queue failed', {
      error: 'outbox offline',
      code: undefined,
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[admin-audit] write failed',
      expect.objectContaining({ queued: false, attempts: 3 })
    );
  });

  it('treats a duplicate outbox id as already queued', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const insert = vi.fn().mockResolvedValue({ error: { message: 'audit table offline' } });
    const outboxInsert = vi.fn().mockResolvedValue({
      error: { message: 'duplicate key value violates unique constraint', code: '23505' },
    });

    await expect(recordAdminAudit(clientWith(insert, outboxInsert), entry)).resolves.toEqual({
      ok: false,
      error: 'audit table offline',
      queued: true,
    });
  });

  it('refuses an incomplete entry rather than writing an unattributable row', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = clientWith(insert);

    await expect(recordAdminAudit(client, { ...entry, actorUserId: '' })).resolves.toMatchObject({
      ok: false,
    });
    expect(insert).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      '[admin-audit] refusing incomplete entry',
      expect.objectContaining({ action: 'crm.contact.delete' })
    );
  });

  it('normalises absent optional JSON values to null', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });

    await recordAdminAudit(clientWith(insert), {
      ...entry,
      before: undefined,
      after: undefined,
      metadata: undefined,
      targetLabel: undefined,
      actorEmail: undefined,
      mfaLevel: undefined,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_email: null,
        target_label: null,
        before: null,
        after: null,
        metadata: null,
        mfa_level: 'unknown',
      })
    );
  });
});
