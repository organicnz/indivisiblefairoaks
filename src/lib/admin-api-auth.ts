import { assertMfaVerified, isStepUpChallenge } from '@/lib/mfa-guard';
import { createAdminClient, createServerClient } from '@/lib/supabase-server';

export type AdminApiSession = {
  /** Session-scoped client; keeps RLS as a second check on writes. */
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  /** Service client used only for the profile grant read. */
  adminClient: Awaited<ReturnType<typeof createAdminClient>>;
  adminUserId: string;
  adminEmail: string;
};

export type AdminApiFailure = {
  ok: false;
  status: 401 | 403 | 503;
  error: string;
  mfaRequired?: boolean;
};

export type AdminApiResult = { ok: true; session: AdminApiSession } | AdminApiFailure;

/**
 * The JSON-route counterpart of `requireAdmin`.
 *
 * Route handlers must return a status instead of calling `redirect()`, but they
 * need the same two checks the page gate performs: a verified MFA step-up when
 * the account has a TOTP factor, and a current `profiles.is_admin` grant. Doing
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

    const mfa = await assertMfaVerified(supabase);
    if (!mfa.ok) {
      if (isStepUpChallenge(mfa)) {
        return { ok: false, status: 403, error: mfa.error, mfaRequired: true };
      }
      if (mfa.reason === 'not_authenticated') {
        return { ok: false, status: 401, error: mfa.error };
      }
      return { ok: false, status: 503, error: mfa.error };
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

    return {
      ok: true,
      session: {
        supabase,
        adminUserId: user.id,
        adminEmail: profile.email || user.email || '',
        adminClient,
      },
    };
  } catch {
    return { ok: false, status: 503, error: 'Could not verify admin access. Try again.' };
  }
}
