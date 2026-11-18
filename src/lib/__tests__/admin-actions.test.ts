// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  assertMfaVerified: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: mocks.createServerClient,
  createAdminClient: mocks.createAdminClient,
}));
vi.mock('@/lib/mfa-guard', () => ({
  assertMfaVerified: mocks.assertMfaVerified,
  isStepUpChallenge: (result: { ok: boolean; reason?: string }) =>
    !result.ok && result.reason === 'step_up_required',
  isMfaEnrollmentRequired: (result: { ok: boolean; reason?: string }) =>
    !result.ok && result.reason === 'enrollment_required',
  MFA_STEP_UP_ERROR: 'MFA_STEP_UP',
  MFA_ENROLLMENT_ERROR: 'MFA_ENROLLMENT',
}));

const { markAdminUser } = await import('@/app/admin/actions');

function adminClientWithProfile(
  profileResult: { data: unknown; error: unknown },
  updateResult: { data: unknown; error: unknown } = {
    data: { id: 'profile-1' },
    error: null,
  },
  targetResult: { data: unknown; error: unknown } = profileResult
) {
  const updateMaybeSingle = vi.fn().mockResolvedValue(updateResult);
  const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybeSingle }));
  const updateEq = vi.fn(() => ({ select: updateSelect }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const maybeSingle = vi.fn().mockResolvedValue(profileResult);
  const or = vi.fn(() => ({ maybeSingle }));
  const targetMaybeSingle = vi.fn().mockResolvedValue(targetResult);
  const targetEq = vi.fn(() => ({ maybeSingle: targetMaybeSingle }));
  const select = vi.fn(() => ({ or, eq: targetEq }));
  const auditInsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) =>
    table === 'admin_audit_log' ? { insert: auditInsert } : { select, update }
  );
  return { client: { from }, update, updateEq, updateMaybeSingle, auditInsert };
}

describe('admin authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } } }),
      },
    });
    mocks.assertMfaVerified.mockResolvedValue({ ok: true });
  });

  it('surfaces a profile read failure instead of denying the admin role', async () => {
    const { client, update } = adminClientWithProfile({
      data: null,
      error: { message: 'connection reset' },
    });
    mocks.createAdminClient.mockResolvedValue(client);

    await expect(markAdminUser('profile-1', true)).rejects.toThrow(
      'Could not verify admin access'
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('still denies a real non-admin profile', async () => {
    const { client } = adminClientWithProfile({
      data: { is_admin: false },
      error: null,
    });
    mocks.createAdminClient.mockResolvedValue(client);

    await expect(markAdminUser('profile-1', true)).rejects.toThrow('Not authorised');
  });

  it('rejects an update that matched no profile', async () => {
    const { client } = adminClientWithProfile(
      { data: { is_admin: true }, error: null },
      { data: null, error: null }
    );
    mocks.createAdminClient.mockResolvedValue(client);

    await expect(markAdminUser('missing-profile', true)).rejects.toThrow(
      'That profile no longer exists'
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('updates and revalidates for an AAL2 admin', async () => {
    const { client, update } = adminClientWithProfile({
      data: { is_admin: true },
      error: null,
    });
    mocks.createAdminClient.mockResolvedValue(client);

    await markAdminUser('profile-1', true);

    expect(mocks.assertMfaVerified).toHaveBeenCalledWith(expect.anything(), {
      requireEnrollment: true,
    });
    expect(update).toHaveBeenCalledWith({ is_admin: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin');
  });

  it('records the role grant with the before/after values and MFA level', async () => {
    const { client, auditInsert } = adminClientWithProfile(
      { data: { is_admin: true }, error: null },
      { data: { id: 'profile-1' }, error: null },
      { data: { id: 'profile-1', is_admin: false, email: 'member@example.com' }, error: null }
    );
    mocks.createAdminClient.mockResolvedValue(client);

    await markAdminUser('profile-1', true);

    expect(auditInsert).toHaveBeenCalledWith({
      actor_user_id: 'admin-1',
      actor_email: 'admin@example.com',
      action: 'admin.role.grant',
      target_type: 'profile',
      target_id: 'profile-1',
      target_label: 'member@example.com',
      before: { is_admin: false },
      after: { is_admin: true },
      mfa_level: 'aal2',
      outcome: 'success',
      error: null,
      metadata: null,
    });
  });

  it('rejects an admin with no TOTP factor using the enrollment error name', async () => {
    const { client, update } = adminClientWithProfile({
      data: { is_admin: true },
      error: null,
    });
    mocks.createAdminClient.mockResolvedValue(client);
    mocks.assertMfaVerified.mockResolvedValue({
      ok: false,
      reason: 'enrollment_required',
      error: 'MFA enrollment required. Set up an authenticator app to continue.',
    });

    await expect(markAdminUser('profile-1', true)).rejects.toMatchObject({
      name: 'MFA_ENROLLMENT',
    });
    expect(update).not.toHaveBeenCalled();
  });
});
