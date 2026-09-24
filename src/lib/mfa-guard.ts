import type { createServerClient } from '@/lib/supabase-server';

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

/**
 * Enforces step-up auth for account-mutating operations.
 * If the user has no verified MFA factors, this is a no-op (pass).
 * If they do have verified factors, the session must already be AAL2 —
 * otherwise the caller must redirect to /auth/mfa instead of performing the write.
 * Fails closed when MFA state or the current assurance level cannot be read.
 */
export async function assertMfaVerified(
  supabase: ServerClient
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Not authenticated' };

    if (!supabase.auth?.mfa) {
      return { ok: false, error: 'MFA verification is unavailable.' };
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError || !factors) {
      return { ok: false, error: 'Unable to verify MFA enrollment.' };
    }
    // Gather factor statuses across all modality buckets.
    const all: { status?: string }[] = [
      ...((factors?.totp as { status?: string }[]) ?? []),
      ...((factors?.phone as { status?: string }[]) ?? []),
      ...((factors as unknown as { all?: { status?: string }[] })?.all ?? []),
    ];
    const hasVerified = all.some((f) => f.status === 'verified');
    if (!hasVerified) return { ok: true }; // no MFA enrolled → pass through

    let aalCurrent: string | null = null;
    try {
      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError || !aal?.currentLevel) {
        return { ok: false, error: 'Unable to verify MFA status.' };
      }
      aalCurrent = aal.currentLevel;
    } catch {
      return { ok: false, error: 'Unable to verify MFA status.' };
    }
    if (aalCurrent === 'aal2') return { ok: true };

    // Has verified MFA but not AAL2 → advisory only; return error so
    // the caller (settings/admin actions) can redirect to /auth/mfa.
    // Callers may choose to pass through instead of redirecting.
    return { ok: false, error: 'MFA verification required. Please complete 2FA.' };
  } catch {
    // Fail closed on unexpected guard errors for mutating paths —
    // page-level gate already redirects AAL1 sessions, so reaching here
    // is unexpected but we err on the side of safety.
    return { ok: false, error: 'MFA verification required. Please complete 2FA.' };
  }
}
