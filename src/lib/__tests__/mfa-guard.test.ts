import { describe, expect, it, vi } from 'vitest';
import {
  assertMfaVerified,
  isMfaStepUpError,
  isStepUpChallenge,
  MFA_STEP_UP_ERROR,
} from '@/lib/mfa-guard';

interface FactorShape {
  status?: string;
  factor_type?: string;
}

function makeClient(
  options: {
    user?: { id: string } | null;
    mfa?: boolean;
    listFactors?: {
      data?: { totp?: FactorShape[]; phone?: FactorShape[]; all?: FactorShape[] };
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
  const getUser = vi.fn().mockResolvedValue({
    data: { user: options.user === undefined ? { id: 'user-1' } : options.user },
  });

  return {
    client: {
      auth: {
        getUser,
        ...(options.mfa === false
          ? {}
          : {
              mfa: {
                listFactors,
                getAuthenticatorAssuranceLevel: getAal,
              },
            }),
      },
    } as unknown as Parameters<typeof assertMfaVerified>[0],
    listFactors,
    getAal,
    getUser,
  };
}

describe('assertMfaVerified', () => {
  it('rejects unauthenticated users as a sign-in problem, not a step-up one', async () => {
    const { client } = makeClient({ user: null });
    const result = await assertMfaVerified(client);
    expect(result).toEqual({
      ok: false,
      reason: 'not_authenticated',
      error: 'Not authenticated',
    });
    // The distinction is the whole point: a signed-out visitor must not be told
    // to go and find an authenticator.
    expect(isStepUpChallenge(result)).toBe(false);
  });

  it('fails closed when the MFA API is unavailable', async () => {
    const { client } = makeClient({ mfa: false });
    const result = await assertMfaVerified(client);
    expect(result).toEqual({
      ok: false,
      reason: 'unavailable',
      error: 'MFA verification is unavailable.',
    });
    expect(isStepUpChallenge(result)).toBe(false);
  });

  it('fails closed when factors cannot be read', async () => {
    const { client } = makeClient({ listFactors: { error: new Error('temporary failure') } });
    const result = await assertMfaVerified(client);
    expect(result).toEqual({
      ok: false,
      reason: 'state_unknown',
      error: 'Unable to verify MFA enrollment.',
    });
    expect(isStepUpChallenge(result)).toBe(false);
  });

  it('allows a user without verified factors', async () => {
    const { client } = makeClient();
    expect(await assertMfaVerified(client)).toEqual({ ok: true });
  });

  /**
   * An unverified factor is an enrollment somebody abandoned. It must not
   * produce a step-up requirement, or `/auth/mfa` shows a code box for a factor
   * that cannot be answered.
   */
  it('allows a user whose only factor is unverified', async () => {
    const { client, getAal } = makeClient({
      listFactors: { data: { all: [{ status: 'unverified', factor_type: 'totp' }] } },
    });
    expect(await assertMfaVerified(client)).toEqual({ ok: true });
    expect(getAal).not.toHaveBeenCalled();
  });

  it('fails closed when the assurance level cannot be read', async () => {
    const { client } = makeClient({
      listFactors: { data: { all: [{ status: 'verified' }] } },
      aal: { error: new Error('unavailable') },
    });
    expect(await assertMfaVerified(client)).toEqual({
      ok: false,
      reason: 'state_unknown',
      error: 'Unable to verify MFA status.',
    });
  });

  /**
   * `getAuthenticatorAssuranceLevel` rejecting rather than resolving with an
   * error is a real shape — the SDK's own call can throw if the client is
   * misconfigured — and it has to reach the same fail-closed result as the
   * resolved-with-error path rather than escaping to the outer catch with a
   * different message.
   */
  it('fails closed when the assurance level call throws', async () => {
    const { client } = makeClient({
      listFactors: { data: { all: [{ status: 'verified' }] } },
      aal: new Error('no session'),
    });
    expect(await assertMfaVerified(client)).toEqual({
      ok: false,
      reason: 'state_unknown',
      error: 'Unable to verify MFA status.',
    });
  });

  /**
   * Anything unexpected still fails closed, and it is reported as
   * `state_unknown` rather than `step_up_required` — a caller must not send
   * someone to a code box because of an internal error.
   */
  it('fails closed as state_unknown when getUser itself throws', async () => {
    const { client } = makeClient();
    vi.mocked(client.auth.getUser).mockRejectedValue(new Error('socket hang up'));

    const result = await assertMfaVerified(client);
    expect(result.ok).toBe(false);
    expect(result).toEqual({
      ok: false,
      reason: 'state_unknown',
      error: 'We could not verify your sign-in. Nothing has been changed — try again in a moment.',
    });
    expect(isStepUpChallenge(result)).toBe(false);

    /*
     * The message must not ask for a code. A catch-all means the state could not
     * be read, so "complete 2FA" is advice that cannot work — and `UserSettings`
     * renders `reason`-appropriate advice *and* this string, so a volunteer who
     * cannot verify their session was told to do both. Pinned because the string
     * is the only thing that reaches a generic error box.
     */
    expect(result.ok === false && result.error).not.toMatch(/2FA|verification required/i);
  });

  it('requires AAL2 for a verified factor, and says so by reason', async () => {
    const { client } = makeClient({
      listFactors: { data: { all: [{ status: 'verified', factor_type: 'totp' }] } },
      aal: { data: { currentLevel: 'aal1', nextLevel: 'aal2' } },
    });
    const result = await assertMfaVerified(client);
    expect(result).toEqual({
      ok: false,
      reason: 'step_up_required',
      error: 'MFA verification required. Please complete 2FA.',
    });
    expect(isStepUpChallenge(result)).toBe(true);
  });

  it('allows a verified factor at AAL2', async () => {
    const { client } = makeClient({
      listFactors: { data: { all: [{ status: 'verified', factor_type: 'totp' }] } },
      aal: { data: { currentLevel: 'aal2', nextLevel: 'aal2' } },
    });
    expect(await assertMfaVerified(client)).toEqual({ ok: true });
  });

  /**
   * TOTP in either bucket is enrollment, because the SDK populates `totp` and
   * `all` inconsistently between versions. Dropping either would silently
   * un-enrol a user and let an AAL1 session through a mutating action — so both
   * are read, and the test pins that neither alone is load-bearing.
   */
  it.each([
    ['totp', { totp: [{ status: 'verified' }] }],
    ['all', { all: [{ status: 'verified' }] }],
    ['all, with an explicit factor_type', { all: [{ status: 'verified', factor_type: 'totp' }] }],
  ])('requires step-up for a verified TOTP factor in the %s bucket', async (_label, data) => {
    const { client } = makeClient({ listFactors: { data } });
    const result = await assertMfaVerified(client);
    expect(result.ok).toBe(false);
    expect(isStepUpChallenge(result)).toBe(true);
  });

  /**
   * A factor this site cannot answer is not enrollment.
   *
   * Both step-up surfaces render a six-digit box and nothing else, so a phone or
   * webauthn factor is not a challenge the user can complete. When the guard
   * counted one it produced a permanent loop — guard says `step_up_required`,
   * challenge says `no-factor`, `/auth/mfa` redirects to `/account`, `/account`'s
   * gate declines to redirect because there is no TOTP to answer with, and the
   * retry returns to the guard. Four hops with no way out.
   *
   * So the guard asks the question the challenge asks. It is weaker than
   * demanding a second factor, and it is the honest trade: the alternative is a
   * requirement no interface the site offers can satisfy.
   */
  it.each([
    ['phone', { phone: [{ status: 'verified' }] }],
    [
      'a phone factor surfaced through all',
      { all: [{ status: 'verified', factor_type: 'phone' }] },
    ],
    [
      'phone alongside totp, totp unverified',
      {
        all: [
          { status: 'verified', factor_type: 'phone' },
          { status: 'unverified', factor_type: 'totp' },
        ],
      },
    ],
  ])(
    'does not demand a step-up for %s, which the challenge cannot answer',
    async (_label, data) => {
      const { client } = makeClient({ listFactors: { data } });
      // AAL1, so a wrong implementation would produce `step_up_required` here.
      const result = await assertMfaVerified(client);
      expect(result).toEqual({ ok: true });
      expect(isStepUpChallenge(result)).toBe(false);
    }
  );

  it('still requires step-up when a phone factor sits beside a verified TOTP one', async () => {
    // The inverse of the case above: the presence of an unanswerable factor must
    // not *disqualify* an answerable one.
    const { client } = makeClient({
      listFactors: {
        data: {
          all: [
            { status: 'verified', factor_type: 'phone' },
            { status: 'verified', factor_type: 'totp' },
          ],
        },
      },
    });
    const result = await assertMfaVerified(client);
    expect(result.ok).toBe(false);
    expect(isStepUpChallenge(result)).toBe(true);
  });
});

describe('isMfaStepUpError', () => {
  /**
   * The client half of the contract.
   *
   * A server action's rejection crosses a `startTransition` as an opaque error —
   * React reports it in the console and the caller gets nothing useful — so
   * `OrderStatusSelect` has to recognise a step-up request by something. It
   * recognises it by `error.name`, and this is the only place that name is
   * asserted.
   *
   * The property being tested is the *discriminant*: a rejection that is not a
   * step-up request must not be answered with a link to `/auth/mfa`, because
   * following that link dead-ends on a page that has no code to enter.
   */
  it('recognises the tagged rejection', () => {
    const err = new Error('MFA verification required. Please complete 2FA.');
    err.name = MFA_STEP_UP_ERROR;
    expect(isMfaStepUpError(err)).toBe(true);
  });

  it('rejects an ordinary Error, however similar its message', () => {
    // The message is identical to the step-up one. Matching on text would send a
    // volunteer with a genuine database failure to a challenge they cannot pass.
    const err = new Error('MFA verification required. Please complete 2FA.');
    expect(isMfaStepUpError(err)).toBe(false);
  });

  it('rejects anything that is not an Error', () => {
    // A rejected action can hand over a string, an object, or nothing.
    expect(isMfaStepUpError('MFA verification required')).toBe(false);
    expect(isMfaStepUpError({ name: MFA_STEP_UP_ERROR })).toBe(false);
    expect(isMfaStepUpError(null)).toBe(false);
    expect(isMfaStepUpError(undefined)).toBe(false);
  });

  it('accepts a subclass that sets the same name', () => {
    // Not a hypothetical concern to over-engineer: the point of the check is that
    // a *specific* throw site is recognisable, and a plain structural check is
    // what keeps an unrelated error from claiming the same name.
    class Unrelated extends Error {
      constructor() {
        super('unrelated');
        this.name = MFA_STEP_UP_ERROR;
      }
    }
    // Documented as accepted: this is the shape that a future refactor could
    // produce, and the assertion records that it *is* accepted — so changing that
    // is a deliberate act rather than an accident. The name previously read "does
    // not match a subclass", which is the opposite of what it asserted — a title
    // claiming rejection over a passing assertion is how a property quietly rots.
    expect(isMfaStepUpError(new Unrelated())).toBe(true);
  });
});

describe('isStepUpChallenge', () => {
  it('is false for a pass', () => {
    expect(isStepUpChallenge({ ok: true })).toBe(false);
  });

  /**
   * The redirect loop, stated as a property. `requireAdmin()` used to redirect
   * on every non-ok result, so an unreadable factor list sent the user to
   * /auth/mfa, which could not read its factors either, pushed to /login, and
   * middleware bounced the still-signed-in user off /login to a gated route.
   * Only `step_up_required` may be answered by a challenge.
   */
  it.each(['not_authenticated', 'unavailable', 'state_unknown'] as const)(
    'is false for %s, so no fault is routed to the code box',
    (reason) => {
      expect(isStepUpChallenge({ ok: false, reason, error: 'x' })).toBe(false);
    }
  );
});
