// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isAdminUser, requireAdmin, requireAdminPage } from '@/lib/admin-auth';

const { mockRedirect, mockCreateServerClient, mockCreateAdminClient, mockConnection } = vi.hoisted(
  () => ({
    mockRedirect: vi.fn(),
    mockCreateServerClient: vi.fn(),
    mockCreateAdminClient: vi.fn(),
    mockConnection: vi.fn(),
  })
);

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('next/server', () => ({
  connection: mockConnection,
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

function mockProfileClient(
  profile: { is_admin: boolean; email?: string } | null,
  error: { code?: string; message: string } | null = null
) {
  const single = vi.fn().mockResolvedValue({ data: profile, error });
  const or = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ or });
  return { from: vi.fn().mockReturnValue({ select }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConnection.mockResolvedValue(undefined);
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

    expect(await redirectUrl(() => requireAdmin())).toBe('/login?next=%2Fadmin');
  });

  it('remembers the page an admin was trying to reach, not just /admin', async () => {
    mockCreateServerClient.mockResolvedValue(mockSessionClient({ user: null }));

    // The composer is outside /admin, and a shared /compose/23 link is how a
    // page gets handed to a colleague. Hard-coding /admin there dropped them at
    // the section root and lost the row.
    expect(await redirectUrl(() => requireAdmin('/compose/23'))).toBe(
      '/login?next=%2Fcompose%2F23'
    );
  });

  it('refuses an external return path', async () => {
    mockCreateServerClient.mockResolvedValue(mockSessionClient({ user: null }));

    expect(await redirectUrl(() => requireAdmin('//evil.example/compose/23'))).toBe(
      '/login?next=%2Fadmin'
    );
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
    mockCreateAdminClient.mockResolvedValue(
      mockProfileClient({ is_admin: true, email: 'a@example.com' })
    );

    expect(await redirectUrl(() => requireAdmin())).toBe('/auth/mfa?next=%2Fadmin');
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
    mockCreateAdminClient.mockResolvedValue(
      mockProfileClient({ is_admin: true, email: 'a@example.com' })
    );

    const url = await redirectUrl(() => requireAdmin());
    expect(url).not.toBe('/auth/mfa');
    expect(url).toBe('/auth/mfa?next=%2Fadmin');
  });

  it('throws — rather than redirecting — when the admin profile read fails', async () => {
    mockCreateServerClient.mockResolvedValue(mockSessionClient());
    mockCreateAdminClient.mockResolvedValue(
      mockProfileClient(null, { code: '08006', message: 'connection failure' })
    );

    await expect(requireAdmin()).rejects.toThrow('Could not verify admin access. Try again.');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('still sends a signed-in user with no profile to the account page', async () => {
    mockCreateServerClient.mockResolvedValue(mockSessionClient());
    mockCreateAdminClient.mockResolvedValue(
      mockProfileClient(null, { code: 'PGRST116', message: 'no rows returned' })
    );

    expect(await redirectUrl(() => requireAdmin())).toBe('/account?error=admin_required');
  });

  it('throws — rather than redirecting — when the MFA state cannot be read', async () => {
    mockCreateServerClient.mockResolvedValue(
      mockSessionClient({ factorsError: new Error('socket hang up') })
    );
    mockCreateAdminClient.mockResolvedValue(
      mockProfileClient({ is_admin: true, email: 'a@example.com' })
    );

    await expect(requireAdmin()).rejects.toThrow('Unable to verify MFA enrollment.');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('sends an admin whose only verified factor is a phone factor to TOTP enrollment', async () => {
    // A phone factor cannot answer the six-digit challenge this site renders,
    // so an admin without a TOTP factor does not have the factor the admin
    // surface requires — even though the factor is verified.
    mockCreateServerClient.mockResolvedValue(
      mockSessionClient({
        factors: { all: [{ status: 'verified', factor_type: 'phone' }] },
        aal: { currentLevel: 'aal1', nextLevel: 'aal2' },
      })
    );
    mockCreateAdminClient.mockResolvedValue(
      mockProfileClient({ is_admin: true, email: 'a@example.com' })
    );

    expect(await redirectUrl(() => requireAdmin())).toBe(
      '/account?tab=settings&mfa=enroll&next=%2Fadmin'
    );
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

  it('sends an admin with no enrolled factors to TOTP enrollment', async () => {
    mockCreateServerClient.mockResolvedValue(mockSessionClient({ factors: { all: [] } }));
    mockCreateAdminClient.mockResolvedValue(
      mockProfileClient({ is_admin: true, email: 'a@example.com' })
    );

    expect(await redirectUrl(() => requireAdmin())).toBe(
      '/account?tab=settings&mfa=enroll&next=%2Fadmin'
    );
  });

  it('sends a signed-in non-admin away rather than throwing', async () => {
    mockCreateServerClient.mockResolvedValue(mockSessionClient({ factors: { all: [] } }));
    mockCreateAdminClient.mockResolvedValue(mockProfileClient({ is_admin: false }));

    expect(await redirectUrl(() => requireAdmin())).toBe('/account?error=admin_required');
  });
});

describe('requireAdminPage', () => {
  it('waits for a request before reading the admin session', async () => {
    const order: string[] = [];
    mockConnection.mockImplementation(async () => {
      order.push('connection');
    });
    mockCreateServerClient.mockImplementation(async () => {
      order.push('session');
      return mockSessionClient({
        factors: { all: [{ status: 'verified', factor_type: 'totp' }] },
        aal: { currentLevel: 'aal2', nextLevel: 'aal2' },
      });
    });
    mockCreateAdminClient.mockResolvedValue(
      mockProfileClient({ is_admin: true, email: 'a@example.com' })
    );

    await requireAdminPage();

    expect(order).toEqual(['connection', 'session']);
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
