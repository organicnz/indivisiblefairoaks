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
  isStepUpChallenge: vi.fn(() => false),
  MFA_STEP_UP_ERROR: 'MFA_STEP_UP',
}));

const { markAdminUser } = await import('@/app/admin/actions');

function adminClientWithProfile(profileResult: { data: unknown; error: unknown }) {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));
  const maybeSingle = vi.fn().mockResolvedValue(profileResult);
  const or = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ or }));
  const from = vi.fn(() => ({ select, update }));
  return { client: { from }, update, updateEq };
}

describe('admin authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }),
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

  it('updates and revalidates for a verified admin', async () => {
    const { client, update } = adminClientWithProfile({
      data: { is_admin: true },
      error: null,
    });
    mocks.createAdminClient.mockResolvedValue(client);

    await markAdminUser('profile-1', true);

    expect(update).toHaveBeenCalledWith({ is_admin: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin');
  });
});
