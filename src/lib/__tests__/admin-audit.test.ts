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

function clientWith(insert: ReturnType<typeof vi.fn>) {
  return {
    from: vi.fn(() => ({ insert })),
    insert,
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
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[admin-audit] write failed',
      expect.objectContaining({ action: 'crm.contact.delete', error: 'audit table offline' })
    );
  });

  it('catches a throwing client instead of failing the mutation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const insert = vi.fn().mockRejectedValue(new Error('connection reset'));

    await expect(recordAdminAudit(clientWith(insert), entry)).resolves.toEqual({
      ok: false,
      error: 'connection reset',
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[admin-audit] write threw',
      expect.objectContaining({ error: 'connection reset' })
    );
  });

  it('refuses an incomplete entry rather than writing an unattributable row', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = clientWith(insert);

    await expect(
      recordAdminAudit(client, { ...entry, actorUserId: '' })
    ).resolves.toMatchObject({ ok: false });
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
