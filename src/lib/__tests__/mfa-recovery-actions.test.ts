// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashRecoveryCode } from '@/lib/mfa-recovery-server';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: mocks.createServerClient,
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit }));

const {
  generateMfaRecoveryCodesAction,
  getMfaRecoveryCodeStatusAction,
  redeemMfaRecoveryCodeAction,
} = await import('@/lib/actions/mfa-recovery');

const TOTP = { id: 'totp-1', status: 'verified', factor_type: 'totp', friendly_name: 'Phone' };
const PHONE = { id: 'phone-1', status: 'verified', factor_type: 'phone', friendly_name: 'SMS' };
const CODE = 'ABCD-EFGH-JKLM-NPQR';

function sessionClient({
  aal = 'aal2',
  factors = [TOTP],
  user = { id: 'user-1' },
}: {
  aal?: string;
  factors?: { id?: string; status?: string; factor_type?: string }[];
  user?: { id: string } | null;
} = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      mfa: {
        listFactors: vi.fn().mockResolvedValue({ data: { all: factors }, error: null }),
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: aal, nextLevel: 'aal2' },
          error: null,
        }),
      },
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 });
  mocks.createServerClient.mockResolvedValue(sessionClient());
  mocks.createAdminClient.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ error: null }) });
});

describe('generateMfaRecoveryCodesAction', () => {
  it('stores ten hashes and returns the plaintext set once', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createAdminClient.mockResolvedValue({ rpc });

    const result = await generateMfaRecoveryCodesAction();

    expect(result).toHaveProperty('codes');
    if (!('codes' in result)) throw new Error('expected generated codes');
    expect(result.codes).toHaveLength(10);
    expect(new Set(result.codes).size).toBe(10);
    expect(rpc).toHaveBeenCalledWith('replace_mfa_recovery_codes', {
      p_user_id: 'user-1',
      p_code_hashes: result.codes.map(hashRecoveryCode),
    });
  });

  it('does not generate at AAL1 when a TOTP factor exists', async () => {
    mocks.createServerClient.mockResolvedValue(sessionClient({ aal: 'aal1' }));

    const result = await generateMfaRecoveryCodesAction();

    expect(result).toMatchObject({ reason: 'step_up_required' });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('requires a verified TOTP factor, not merely any signed-in account', async () => {
    mocks.createServerClient.mockResolvedValue(sessionClient({ factors: [] }));

    const result = await generateMfaRecoveryCodesAction();

    expect(result).toMatchObject({ error: expect.stringContaining('authenticator') });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});

describe('getMfaRecoveryCodeStatusAction', () => {
  it('reports total and unused counts without exposing hashes', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ used_at: null }, { used_at: null }, { used_at: '2026-11-17T12:00:00Z' }],
      error: null,
    });
    const select = vi.fn(() => ({ eq }));
    mocks.createAdminClient.mockResolvedValue({ from: vi.fn(() => ({ select })) });

    await expect(getMfaRecoveryCodeStatusAction()).resolves.toEqual({
      total: 3,
      remaining: 2,
    });
    expect(select).toHaveBeenCalledWith('used_at');
  });
});

describe('redeemMfaRecoveryCodeAction', () => {
  it('rate-limits repeated redemption attempts before touching the admin client', async () => {
    mocks.rateLimit.mockReturnValue({ ok: false, retryAfterSec: 42 });

    const result = await redeemMfaRecoveryCodeAction(CODE);

    expect(result).toEqual({ error: 'Too many recovery attempts. Try again in 42s.' });
    expect(mocks.rateLimit).toHaveBeenCalledWith('mfa-recovery:user-1', 5, 10 * 60_000);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('claims one code, removes only verified TOTP factors, and signs out', async () => {
    const session = sessionClient();
    mocks.createServerClient.mockResolvedValue(session);
    const lookupMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'code-1' }, error: null });
    const lookupIs = vi.fn(() => ({ maybeSingle: lookupMaybeSingle }));
    const lookupCodeEq = vi.fn(() => ({ is: lookupIs }));
    const lookupUserEq = vi.fn(() => ({ eq: lookupCodeEq }));
    const select = vi.fn(() => ({ eq: lookupUserEq }));

    const consumedMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'code-1' }, error: null });
    const consumedSelect = vi.fn(() => ({ maybeSingle: consumedMaybeSingle }));
    const consumedIs = vi.fn(() => ({ select: consumedSelect }));
    const consumedEq = vi.fn(() => ({ is: consumedIs }));
    const update = vi.fn(() => ({ eq: consumedEq }));

    const listFactors = vi.fn().mockResolvedValue({
      data: { factors: [TOTP, PHONE] },
      error: null,
    });
    const deleteFactor = vi.fn().mockResolvedValue({ data: { id: 'totp-1' }, error: null });
    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({ select, update })),
      auth: { admin: { mfa: { listFactors, deleteFactor } } },
    });

    await expect(redeemMfaRecoveryCodeAction(CODE)).resolves.toEqual({
      success: true,
      removedFactors: 1,
    });

    expect(lookupUserEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(lookupCodeEq).toHaveBeenCalledWith('code_hash', hashRecoveryCode(CODE));
    expect(update).toHaveBeenCalledWith({ used_at: expect.any(String) });
    expect(deleteFactor).toHaveBeenCalledWith({ userId: 'user-1', id: 'totp-1' });
    expect(deleteFactor).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'phone-1' })
    );
    expect(session.auth.signOut).toHaveBeenCalled();
  });

  it('rejects a code that does not match before claiming anything', async () => {
    const lookupMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const lookupIs = vi.fn(() => ({ maybeSingle: lookupMaybeSingle }));
    const lookupCodeEq = vi.fn(() => ({ is: lookupIs }));
    const lookupUserEq = vi.fn(() => ({ eq: lookupCodeEq }));
    const select = vi.fn(() => ({ eq: lookupUserEq }));
    const update = vi.fn();
    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({ select, update })),
      auth: {
        admin: {
          mfa: {
            listFactors: vi.fn().mockResolvedValue({ data: { factors: [TOTP] }, error: null }),
          },
        },
      },
    });

    await expect(redeemMfaRecoveryCodeAction(CODE)).resolves.toEqual({
      error: 'That recovery code is not valid or has already been used.',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('does not consume a code when no TOTP authenticator is enrolled', async () => {
    const select = vi.fn();
    const update = vi.fn();
    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({ select, update })),
      auth: {
        admin: {
          mfa: {
            listFactors: vi.fn().mockResolvedValue({ data: { factors: [PHONE] }, error: null }),
          },
        },
      },
    });

    await expect(redeemMfaRecoveryCodeAction(CODE)).resolves.toMatchObject({
      error: expect.stringContaining('No authenticator app is enrolled'),
    });
    expect(select).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('leaves the code unclaimed when the authenticator list cannot be read', async () => {
    const update = vi.fn();
    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({ update })),
      auth: {
        admin: {
          mfa: {
            listFactors: vi.fn().mockResolvedValue({ data: null, error: { message: 'blip' } }),
          },
        },
      },
    });

    await expect(redeemMfaRecoveryCodeAction(CODE)).resolves.toMatchObject({
      error: expect.stringContaining('was not used'),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a malformed code without touching the admin client', async () => {
    await expect(redeemMfaRecoveryCodeAction('too short')).resolves.toMatchObject({
      error: expect.stringContaining('not valid'),
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
