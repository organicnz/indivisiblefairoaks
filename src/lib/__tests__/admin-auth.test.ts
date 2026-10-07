import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isAdminUser, requireAdmin } from '@/lib/admin-auth';

const { mockRedirect, mockCreateServerClient, mockCreateAdminClient } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockCreateServerClient: vi.fn(),
  mockCreateAdminClient: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

/**
 * `redirect()` in production throws `NEXT_REDIRECT`; here it records the
 * destination and then throws a sentinel, so "redirected to X" and "threw"
 * are distinguishable outcomes rather than one blurred into the other.
 */
class RedirectSentinel extends Error {
  constructor(public readonly url: string) {
    super(`redirect:${url}`);
  }
}

function mockSessionClient(
  options: {
    user?: { id: string; email?: string } | null;
    factors?: { totp?: { status?: string }[]; all?: { status?: string; factor_type?: string }[] };
    factorsError?: Error | null;
    aal?: { currentLevel?: string; nextLevel?: string } | null;
    aalError?: Error | null;
  } = {}
) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user:
            options.user === undefined ? { id: 'user-1', email: 'a@example.com' } : options.user,
        },
      }),
      mfa: {
        listFactors: vi
          .fn()
          .mockResolvedValue(
            options.factorsError
              ? { data: null, error: options.factorsError }
              : { data: { totp: [], all: [], ...options.factors }, error: null }
          ),
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue(
          options.aalError
            ? { data: null, error: options.aalError }
            : {
                data: options.aal ?? { currentLevel: 'aal1', nextLevel: 'aal2' },
                error: null,
              }
        ),
      },
    },
  };
}

function mockProfileClient(profile: { is_admin: boolean; email?: string } | null) {
  const single = vi.fn().mockResolvedValue({ data: profile });
  const or = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ or });
  return { from: vi.fn().mockReturnValue({ select }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRedirect.mockImplementation((url: string) => {
    throw new RedirectSentinel(url);
  });
});

async function redirectUrl(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    if (err instanceof RedirectSentinel) return err.url;
    throw err;
  }
}

describe('requireAdmin', () => {
  it('sends a signed-out visitor to sign in, remembering the section', async () => {
    mockCreateServerClient.mockResolvedValue(mockSessionClient({ user: null }));

    expect(await redirectUrl(() => requireAdmin())).toBe('/login?next=/admin');
  });

  /**
   * Only `step_up_required` earns a redirect. Redirecting on every denial is
   * what built the four-hop loop: a `listFactors` failure pushed the user to
   * `/auth/mfa`, which could not read its own factors either, pushed to
   * `/login`, and middleware bounced the still-signed-in user back to a gated
   * route.
   */
  it('sends an AAL1 admin with a verified TOTP factor to the challenge, remembering /admin', async () => {
    mockCreateServerClient.mockResolvedValue(
      mockSessionClient({
        factors: { all: [{ status: 'verified', factor_type: 'totp' }] },
        aal: { currentLevel: 'aal1', nextLevel: 'aal2' },
      })
    );

    expect(await redirectUrl(() => requireAdmin())).toBe('/auth/mfa?next=/admin');
  });

  /**
   * A bare `/auth/mfa` defaults to `/account`, which used to drop an admin onto
   * their dashboard with the order status still unsaved. Pinned because the
   * `?next=` is the only thing standing between a completed step-up and a lost
   * write.
   */
  it('never redirects a step-up to the bare challenge without a return path', async () => {
    mockCreateServerClient.mockResolvedValue(
      mockSessionClient({
        factors: { totp: [{ status: 'verified' }] },
        aal: { currentLevel: 'aal1', nextLevel: 'aal2' },
      })
    );

    const url = await redirectUrl(() => requireAdmin());
    expect(url).not.toBe('/auth/mfa');
    expect(url).toBe('/auth/mfa?next=/admin');
  });

  it('throws — rather than redirecting — when the MFA state cannot be read', async () => {
    mockCreateServerClient.mockResolvedValue(
      mockSessionClient({ factorsError: new Error('socket hang up') })
    );

    await expect(requireAdmin()).rejects.toThrow('Unable to verify MFA enrollment.');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('throws for a verified phone-only factor the challenge cannot answer', async () => {
    // The guard asks the same question the challenge does (TOTP or nothing),
    // so a phone-only account passes the gate instead of being sent somewhere
    // it cannot arrive. But `requireAdmin` still needs the admin profile —
    // hence the admin-client mock below.
    mockCreateServerClient.mockResolvedValue(
      mockSessionClient({
        factors: { all: [{ status: 'verified', factor_type: 'phone' }] },
        aal: { currentLevel: 'aal1', nextLevel: 'aal2' },
      })
    );
    mockCreateAdminClient.mockResolvedValue(
      mockProfileClient({ is_admin: true, email: 'a@example.com' })
    );

    const session = await requireAdmin();
    expect(session.adminUserId).toBe('user-1');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('returns the session for an AAL2 admin', async () => {
    mockCreateServerClient.mockResolvedValue(
      mockSessionClient({
        factors: { all: [{ status: 'verified', factor_type: 'totp' }] },
        aal: { currentLevel: 'aal2', nextLevel: 'aal2' },
      })
    );
    mockCreateAdminClient.mockResolvedValue(
      mockProfileClient({ is_admin: true, email: 'a@example.com' })
    );

    const session = await requireAdmin();
    expect(session).toMatchObject({ adminUserId: 'user-1', adminEmail: 'a@example.com' });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('returns the session for an admin with no enrolled factors', async () => {
    mockCreateServerClient.mockResolvedValue(mockSessionClient({ factors: { all: [] } }));
    mockCreateAdminClient.mockResolvedValue(
      mockProfileClient({ is_admin: true, email: 'a@example.com' })
    );

    const session = await requireAdmin();
    expect(session.adminUserId).toBe('user-1');
  });

  it('sends a signed-in non-admin away rather than throwing', async () => {
    mockCreateServerClient.mockResolvedValue(mockSessionClient({ factors: { all: [] } }));
    mockCreateAdminClient.mockResolvedValue(mockProfileClient({ is_admin: false }));

    expect(await redirectUrl(() => requireAdmin())).toBe('/account?error=admin_required');
  });
});

describe('isAdminUser', () => {
  it('is false with no session, without touching the admin client', async () => {
    mockCreateServerClient.mockResolvedValue(mockSessionClient({ user: null }));

    expect(await isAdminUser()).toBe(false);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('reads the profile flag for a signed-in user', async () => {
    mockCreateServerClient.mockResolvedValue(mockSessionClient());
    mockCreateAdminClient.mockResolvedValue(mockProfileClient({ is_admin: true }));

    expect(await isAdminUser()).toBe(true);
  });
});
