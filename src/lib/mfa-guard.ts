import type { createServerClient } from '@/lib/supabase-server';

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

/**
 * Why a step-up check failed.
 *
 * Two of these are actionable (enroll or enter a code) and the rest are not, and
 * the difference decides what a caller should *do*. Before this existed every
 * caller branched on the message string — `admin/actions.ts` threw whatever
 * text arrived, `settings.ts` returned it to a generic error box whose only
 * advice was "try a hard reload", and `admin-auth.ts` redirected to
 * `/auth/mfa` on all of them alike. A `listFactors` network blip therefore
 * surfaced as "MFA verification required. Please complete 2FA." and a user with
 * no authenticator at all was told to go and fetch one.
 *
 *   `not_authenticated`  — no session. Sign in, do not step up.
 *   `unavailable`        — the MFA API is not exposed on this client at all.
 *   `state_unknown`      — factors or assurance level could not be read. Fail
 *                          closed, but this is a fault, not a request for a code.
 *   `step_up_required`   — the user has a verified factor and this session is
 *                          AAL1. This is the only reason to send someone to
 *                          `/auth/mfa`.
 *   `enrollment_required` — an admin surface, but the account has no verified
 *                          TOTP factor. Send them to account settings to enroll,
 *                          never to the code box.
 */
export type MfaFailureReason =
  | 'not_authenticated'
  | 'unavailable'
  | 'state_unknown'
  | 'step_up_required'
  | 'enrollment_required';

export type MfaGuardResult = { ok: true } | { ok: false; reason: MfaFailureReason; error: string };

export type MfaGuardOptions = {
  /**
   * Admin surfaces pass this. A verified TOTP factor is then mandatory even
   * when the account has never enrolled; ordinary account surfaces still allow
   * an account with no factor to use the site, matching the public policy.
   */
  requireEnrollment?: boolean;
};

export interface MfaFactorLike {
  status?: string;
  factor_type?: string;
}

export interface MfaFactorsLike {
  totp?: MfaFactorLike[];
  all?: MfaFactorLike[];
}

function deny(reason: MfaFailureReason, error: string): MfaGuardResult {
  return { ok: false, reason, error };
}

/**
 * The single definition of "this account can answer a TOTP challenge".
 *
 * `totp` is the SDK bucket; `all` is the fallback for versions that do not
 * populate it. A phone or webauthn factor is deliberately not enrollment here:
 * both step-up surfaces render a TOTP box and cannot answer those factors.
 */
export function hasVerifiedTotpFactor(factors: MfaFactorsLike | null | undefined): boolean {
  const totpFactors = factors?.totp ?? [];
  const allFactors = factors?.all ?? [];
  return [...totpFactors, ...allFactors].some(
    (f) => f.status === 'verified' && (f.factor_type === undefined || f.factor_type === 'totp')
  );
}

/**
 * Enforces step-up auth for account-mutating operations.
 *
 * If the user has no verified TOTP factor, ordinary account surfaces pass (the
 * site cannot challenge a factor the account does not have), while admin
 * surfaces pass `requireEnrollment` and deny with `enrollment_required`.
 * If they do have a verified TOTP factor, the session must already be AAL2 —
 * otherwise the caller must send the user to /auth/mfa instead of writing.
 *
 * Fails closed on unreadable state (`state_unknown`), which is the deliberate
 * asymmetry: an outage must not become a write path. Callers should show
 * `state_unknown` as an error to retry, not as a prompt for a code — hence the
 * `reason` discriminant.
 */
export async function assertMfaVerified(
  supabase: ServerClient,
  options: MfaGuardOptions = {}
): Promise<MfaGuardResult> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return deny('not_authenticated', 'Not authenticated');

    if (!supabase.auth?.mfa) {
      return deny('unavailable', 'MFA verification is unavailable.');
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError || !factors) {
      return deny('state_unknown', 'Unable to verify MFA enrollment.');
    }
    /*
     * TOTP only, and that is a decision rather than an omission.
     *
     * The guard used to count a verified factor in *any* modality bucket —
     * `totp`, `phone`, and `all`. Both step-up surfaces (`/account` and
     * `/auth/mfa`) require a verified **TOTP** factor before they will render a
     * six-digit box, because `listFactors().all` mixes totp, phone and webauthn
     * and picking the first verified factor of any type once sent an SMS and
     * then rejected the typed digits permanently, with no explanation.
     *
     * With the guard counting phone factors and the challenge refusing to answer
     * them, an account whose only verified factor is a phone was caught in a
     * permanent loop: the guard said `step_up_required`, the challenge said
     * `no-factor`, `/auth/mfa` redirected to `/account`, `/account`'s gate
     * declined to redirect because there was no TOTP factor to answer with, and
     * the retry sent the volunteer back to the guard. Four hops with no way out —
     * the exact class of failure the reason discriminant was introduced to
     * eliminate.
     *
     * So the guard asks the same question the challenge does: *can this session
     * be stepped up by the code we can render?* A phone-only account therefore
     * passes here rather than being sent somewhere it cannot arrive. That is
     * weaker than demanding a second factor, and it is honest: the alternative
     * is a requirement the user cannot satisfy through any interface the site
     * offers.
     *
     * `factors.totp` is the bucket to read, with `all` as the fallback for SDK
     * versions that do not populate it — filtered on `factor_type` either way, so
     * a phone factor surfacing through `all` cannot reintroduce the loop.
     */
    const hasVerifiedTotp = hasVerifiedTotpFactor(factors as MfaFactorsLike);
    if (!hasVerifiedTotp) {
      if (options.requireEnrollment) {
        return deny(
          'enrollment_required',
          'MFA enrollment required. Set up an authenticator app to continue.'
        );
      }
      return { ok: true }; // ordinary account surface: nothing this site can challenge
    }

    let aalCurrent: string | null = null;
    try {
      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError || !aal?.currentLevel) {
        return deny('state_unknown', 'Unable to verify MFA status.');
      }
      aalCurrent = aal.currentLevel;
    } catch {
      return deny('state_unknown', 'Unable to verify MFA status.');
    }
    if (aalCurrent === 'aal2') return { ok: true };

    return deny('step_up_required', 'MFA verification required. Please complete 2FA.');
  } catch {
    /*
     * Fail closed on unexpected guard errors for mutating paths — page-level
     * gates already redirect AAL1 sessions, so reaching here is unexpected but
     * we err on the side of safety.
     *
     * The message deliberately does NOT say "complete 2FA". A catch-all means we
     * could not read the state, which is a fault: the two are different things
     * and a volunteer shown both is told to do a thing that will not help.
     * `UserSettings.tsx` renders `reason`-appropriate advice, so this string is
     * what a fault actually looks like in a generic error box.
     */
    return deny(
      'state_unknown',
      'We could not verify your sign-in. Nothing has been changed — try again in a moment.'
    );
  }
}

/**
 * Whether a guard failure should send the user to the challenge.
 *
 * The single place that decides it. `admin-auth.ts` used to redirect on
 * *every* non-ok result, so a `listFactors` failure turned into a redirect loop:
 * /auth/mfa could not read its factors either, pushed to /login, and middleware
 * bounced the still-signed-in user off /login to /account, which sent them
 * straight back. Four hops with no message and no way out.
 */
export function isStepUpChallenge(result: MfaGuardResult): boolean {
  return !result.ok && result.reason === 'step_up_required';
}

/** Whether an admin must enroll a TOTP factor before the gate can pass. */
export function isMfaEnrollmentRequired(result: MfaGuardResult): boolean {
  return !result.ok && result.reason === 'enrollment_required';
}

/**
 * The `name` on an `Error` thrown by a step-up-guarded action.
 *
 * Lives here, not in the action module, for two reasons. A `'use server'` file
 * may only export async functions — the build rejects anything else — so a
 * constant or a predicate cannot sit next to the actions it describes. And the
 * client half needs it: a server action's rejection crosses a `startTransition`
 * as an opaque error, so the component that has to render a link to `/auth/mfa`
 * needs something it can actually test.
 */
export const MFA_STEP_UP_ERROR = 'MfaStepUpRequired';

/** Whether a rejection from a guarded action is a recoverable step-up request. */
export function isMfaStepUpError(err: unknown): boolean {
  return err instanceof Error && err.name === MFA_STEP_UP_ERROR;
}

/**
 * The rejection name for an admin action reached before TOTP enrollment.
 *
 * Kept distinct from `MFA_STEP_UP_ERROR`: sending this user to `/auth/mfa`
 * would show a code box for a factor that does not exist yet.
 */
export const MFA_ENROLLMENT_ERROR = 'MfaEnrollmentRequired';

export function isMfaEnrollmentError(err: unknown): boolean {
  return err instanceof Error && err.name === MFA_ENROLLMENT_ERROR;
}
