/**
 * Unit tests for src/app/auth/callback/route.ts
 *
 * The OAuth callback handler:
 *  1. Exchanges an auth code for a session via Supabase
 *  2. Redirects to `next` on success (defaults to /account)
 *  3. Redirects to /login?error=Invalid_Token on failure or missing code
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockExchangeCodeForSession = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
        getUser: mockGetUser,
      },
      from: mockFrom,
    })
  ),
}));

// next/headers cookies() — called indirectly by createServerClient mock,
// but our mock above bypasses the real implementation entirely.
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

// Import AFTER mocks
import { GET } from '../../app/auth/callback/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string>): Request {
  const url = new URL('https://indivisiblefairoaks.org/auth/callback');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /auth/callback', () => {
  it('exchanges code and redirects to /account by default for non-admin', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'regular@example.com' } },
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { is_admin: false } }),
        }),
      }),
    });

    const req = makeRequest({ code: 'valid-code-123' });
    const res = await GET(req);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('valid-code-123');
    expect(res.status).toBe(307); // NextResponse.redirect
    expect(res.headers.get('location')).toBe('https://indivisiblefairoaks.org/account');
  });

  it('exchanges code and redirects to /admin by default for admin user', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-456', email: 'erin@indivisiblefairoaks.org' } },
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { is_admin: true } }),
        }),
      }),
    });

    const req = makeRequest({ code: 'valid-admin-code' });
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://indivisiblefairoaks.org/admin');
  });

  it('redirects to custom `next` param on success', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const req = makeRequest({ code: 'valid-code-456', next: '/account/orders' });
    const res = await GET(req);

    expect(res.headers.get('location')).toBe('https://indivisiblefairoaks.org/account/orders');
  });

  it('redirects to custom admin route when specified in `next`', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const req = makeRequest({ code: 'valid-code-789', next: '/admin/crm' });
    const res = await GET(req);

    expect(res.headers.get('location')).toBe('https://indivisiblefairoaks.org/admin/crm');
  });

  it('rejects protocol-relative open-redirect payloads and falls back to account', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = makeRequest({ code: 'valid-code', next: '//evil.com' });
    const res = await GET(req);

    expect(res.headers.get('location')).toBe('https://indivisiblefairoaks.org/account');
  });

  it('redirects to /login?error=Invalid_Token when exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'invalid JWT' },
    });

    const req = makeRequest({ code: 'bad-code' });
    const res = await GET(req);

    expect(res.headers.get('location')).toBe(
      'https://indivisiblefairoaks.org/login?error=Invalid_Token'
    );
  });

  it('redirects to /login?error=Invalid_Token when no code is provided', async () => {
    const req = makeRequest({});
    const res = await GET(req);

    // No code → skip exchange entirely → error redirect
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBe(
      'https://indivisiblefairoaks.org/login?error=Invalid_Token'
    );
  });
});
