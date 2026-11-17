// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
  assertMfaVerified: vi.fn(),
}));

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: mocks.createServerClient,
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/mfa-guard', () => ({
  assertMfaVerified: mocks.assertMfaVerified,
  isStepUpChallenge: (result: { ok: boolean; reason?: string }) =>
    !result.ok && result.reason === 'step_up_required',
}));

const { requireAdminApi } = await import('@/lib/admin-api-auth');

function sessionClient(user: { id: string; email?: string } | null = { id: 'admin-1' }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
}

function profileClient(
  profile: { is_admin: boolean; email?: string } | null,
  error: { message: string } | null = null
) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error });
  const or = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ or }));
  return { from: vi.fn(() => ({ select })) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServerClient.mockResolvedValue(sessionClient());
  mocks.assertMfaVerified.mockResolvedValue({ ok: true });
  mocks.createAdminClient.mockResolvedValue(
    profileClient({ is_admin: true, email: 'admin@example.com' })
  );
});

describe('requireAdminApi', () => {
  it('returns 401 without a session and never builds an admin client', async () => {
    mocks.createServerClient.mockResolvedValue(sessionClient(null));

    await expect(requireAdminApi()).resolves.toMatchObject({
      ok: false,
      status: 401,
      error: 'Unauthenticated',
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('returns a step-up challenge instead of letting an AAL1 session write', async () => {
    mocks.assertMfaVerified.mockResolvedValue({
      ok: false,
      reason: 'step_up_required',
      error: 'MFA verification required. Please complete 2FA.',
    });

    await expect(requireAdminApi()).resolves.toMatchObject({
      ok: false,
      status: 403,
      mfaRequired: true,
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('treats an unreadable MFA state as a retryable service fault', async () => {
    mocks.assertMfaVerified.mockResolvedValue({
      ok: false,
      reason: 'state_unknown',
      error: 'Unable to verify MFA enrollment.',
    });

    await expect(requireAdminApi()).resolves.toMatchObject({
      ok: false,
      status: 503,
      error: 'Unable to verify MFA enrollment.',
    });
  });

  it('does not turn a profile read failure into a non-admin denial', async () => {
    mocks.createAdminClient.mockResolvedValue(
      profileClient(null, { message: 'connection reset' })
    );

    await expect(requireAdminApi()).resolves.toMatchObject({
      ok: false,
      status: 503,
      error: 'Could not verify admin access. Try again.',
    });
  });

  it('denies a signed-in profile without the admin grant', async () => {
    mocks.createAdminClient.mockResolvedValue(profileClient({ is_admin: false }));

    await expect(requireAdminApi()).resolves.toMatchObject({
      ok: false,
      status: 403,
      error: 'Admin privileges required',
    });
  });

  it('returns the session for a verified admin', async () => {
    const adminClient = profileClient({ is_admin: true, email: 'admin@example.com' });
    mocks.createAdminClient.mockResolvedValue(adminClient);

    const result = await requireAdminApi();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected an admin session');
    expect(result.session.supabase).toBeDefined();
    expect(result.session.adminUserId).toBe('admin-1');
    expect(result.session.adminEmail).toBe('admin@example.com');
    expect(result.session.adminClient).toBe(adminClient);
  });

  it('turns an admin-client configuration failure into a 503, not a crash', async () => {
    mocks.createAdminClient.mockRejectedValue(new Error('SUPABASE_SECRET_KEY is not configured'));

    await expect(requireAdminApi()).resolves.toMatchObject({
      ok: false,
      status: 503,
      error: 'Could not verify admin access. Try again.',
    });
  });
});
