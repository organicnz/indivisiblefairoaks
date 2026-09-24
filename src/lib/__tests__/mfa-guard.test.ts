import { describe, expect, it, vi } from 'vitest';
import { assertMfaVerified } from '@/lib/mfa-guard';

function makeClient(
  options: {
    user?: { id: string } | null;
    mfa?: boolean;
    listFactors?: {
      data?: {
        totp?: { status?: string }[];
        phone?: { status?: string }[];
        all?: { status?: string }[];
      };
      error?: Error | null;
    };
    aal?:
      | { data?: { currentLevel?: string; nextLevel?: string } | null; error?: Error | null }
      | Error;
  } = {}
) {
  const listFactors = vi
    .fn()
    .mockResolvedValue(options.listFactors ?? { data: { all: [] }, error: null });
  const getAal = vi.fn().mockImplementation(async () => {
    if (options.aal instanceof Error) throw options.aal;
    return options.aal ?? { data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null };
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user === undefined ? { id: 'user-1' } : options.user },
      }),
      ...(options.mfa === false
        ? {}
        : {
            mfa: {
              listFactors,
              getAuthenticatorAssuranceLevel: getAal,
            },
          }),
    },
  } as unknown as Parameters<typeof assertMfaVerified>[0];
}

describe('assertMfaVerified', () => {
  it('rejects unauthenticated users', async () => {
    const result = await assertMfaVerified(makeClient({ user: null }));
    expect(result).toEqual({ ok: false, error: 'Not authenticated' });
  });

  it('fails closed when the MFA API is unavailable', async () => {
    const result = await assertMfaVerified(makeClient({ mfa: false }));
    expect(result.ok).toBe(false);
  });

  it('fails closed when factors cannot be read', async () => {
    const result = await assertMfaVerified(
      makeClient({ listFactors: { error: new Error('temporary failure') } })
    );
    expect(result).toEqual({ ok: false, error: 'Unable to verify MFA enrollment.' });
  });

  it('allows a user without verified factors', async () => {
    const result = await assertMfaVerified(makeClient());
    expect(result).toEqual({ ok: true });
  });

  it('fails closed when the assurance level cannot be read', async () => {
    const result = await assertMfaVerified(
      makeClient({
        listFactors: { data: { all: [{ status: 'verified' }] } },
        aal: { error: new Error('unavailable') },
      })
    );
    expect(result).toEqual({ ok: false, error: 'Unable to verify MFA status.' });
  });

  it('requires AAL2 for a verified factor', async () => {
    const result = await assertMfaVerified(
      makeClient({
        listFactors: { data: { all: [{ status: 'verified' }] } },
        aal: { data: { currentLevel: 'aal1', nextLevel: 'aal2' } },
      })
    );
    expect(result).toEqual({ ok: false, error: 'MFA verification required. Please complete 2FA.' });
  });

  it('allows a verified factor at AAL2', async () => {
    const result = await assertMfaVerified(
      makeClient({
        listFactors: { data: { all: [{ status: 'verified' }] } },
        aal: { data: { currentLevel: 'aal2', nextLevel: 'aal2' } },
      })
    );
    expect(result).toEqual({ ok: true });
  });
});
