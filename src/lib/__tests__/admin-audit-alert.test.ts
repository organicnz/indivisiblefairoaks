// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookies = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ cookies }));

const { ADMIN_AUDIT_LOSS_COOKIE, clearAdminAuditLoss, markAdminAuditLoss } = await import(
  '@/lib/admin-audit-alert'
);

describe('admin audit loss marker', () => {
  const set = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cookies.mockResolvedValue({ set });
  });

  it('sets an http-only admin-scoped cookie with only the reported timestamp', async () => {
    await markAdminAuditLoss('2026-11-20T12:00:00.000Z');

    expect(cookies).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(ADMIN_AUDIT_LOSS_COOKIE, '2026-11-20T12:00:00.000Z', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/admin',
      maxAge: 604_800,
    });
  });

  it('clears the cookie with maxAge zero on acknowledgement', async () => {
    await clearAdminAuditLoss();

    expect(set).toHaveBeenCalledWith(ADMIN_AUDIT_LOSS_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/admin',
      maxAge: 0,
    });
  });

  it('does not let a non-request context turn a lost audit record into a thrown failure', async () => {
    cookies.mockRejectedValue(new Error('cookies was called outside a request scope'));

    await expect(markAdminAuditLoss()).resolves.toBeUndefined();
  });
});
