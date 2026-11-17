import {
  assertMfaVerified,
  isMfaEnrollmentRequired,
  isStepUpChallenge,
} from '@/lib/mfa-guard';
import { createAdminClient, createServerClient } from '@/lib/supabase-server';

export type AdminApiSession = {
  /** Session-scoped client; keeps RLS as a second check on writes. */
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  /** Service client used only for the profile grant read. */
  adminClient: Awaited<ReturnType<typeof createAdminClient>>;
  adminUserId: string;
  adminEmail: string;
  /** `assertMfaVerified(..., { requireEnrollment: true })` just proved AAL2. */
  mfaLevel: 'aal2';
};

export type AdminApiFailure = {
  ok: false;
  status: 401 | 403 | 503;
  error: string;
  mfaRequired?: boolean;
  /** The account is an admin but has no verified TOTP factor yet. */
  mfaEnrollmentRequired?: boolean;
};

export type AdminApiResult = { ok: true; session: AdminApiSession } | AdminApiFailure;

/**
 * The JSON-route counterpart of `requireAdmin`.
 *
 * Route handlers must return a status instead of calling `redirect()`, but they
 * need the same three checks the page gate performs: a current
 * `profiles.is_admin` grant, a verified TOTP factor, and an AAL2 session. Doing
 * only the profile check here let an AAL1 admin session call the write endpoint
 * directly and bypass the step-up the UI enforces.
 */
export async function requireAdminApi(): Promise<AdminApiResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { ok: false, status: 401, error: 'Unauthenticated' };
    }

    const adminClient = await createAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('is_admin, email')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();

    // A failed read is not a denied role. A database fault must stay retryable,
    // rather than being reported as “not an admin” to the operator.
    if (profileError) {
      return { ok: false, status: 503, error: 'Could not verify admin access. Try again.' };
    }
    if (!profile?.is_admin) {
      return { ok: false, status: 403, error: 'Admin privileges required' };
    }

    const mfa = await assertMfaVerified(supabase, { requireEnrollment: true });
    if (!mfa.ok) {
      if (isStepUpChallenge(mfa)) {
        return { ok: false, status: 403, error: mfa.error, mfaRequired: true };
      }
      if (isMfaEnrollmentRequired(mfa)) {
        return {
          ok: false,
          status: 403,
          error: mfa.error,
          mfaEnrollmentRequired: true,
        };
      }
      if (mfa.reason === 'not_authenticated') {
        return { ok: false, status: 401, error: mfa.error };
      }
      return { ok: false, status: 503, error: mfa.error };
    }

    return {
      ok: true,
      session: {
        supabase,
        adminUserId: user.id,
        adminEmail: profile.email || user.email || '',
        mfaLevel: 'aal2',
        adminClient,
      },
    };
  } catch {
    return { ok: false, status: 503, error: 'Could not verify admin access. Try again.' };
  }
}
