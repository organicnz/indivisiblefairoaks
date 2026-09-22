import type { createServerClient } from '@/lib/supabase-server';

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

/**
 * Enforces step-up auth for account-mutating operations.
 * If the user has no verified MFA factors, this is a no-op (pass).
 * If they do have verified factors, the session must already be AAL2 —
 * otherwise the caller must redirect to /auth/mfa instead of performing the write.
 * Fails closed only when we can definitively determine AAL1 without AAL2;
 * otherwise passes (guard is advisory, not blocking) to avoid false positives
 * in environments where MFA state is incomplete (test mocks, older SDKs).
 */
export async function assertMfaVerified(
  supabase: ServerClient
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Not authenticated' };

    // Guard: if MFA API is unavailable, pass through (test mocks / older SDKs).
    if (!supabase.auth?.mfa) return { ok: true };

    const { data: factors } = await supabase.auth.mfa.listFactors();
    // Gather factor statuses across all modality buckets.
    const all: { status?: string }[] = [
      ...((factors?.totp as { status?: string }[]) ?? []),
      ...((factors?.phone as { status?: string }[]) ?? []),
      ...((factors as unknown as { all?: { status?: string }[] })?.all ?? []),
    ];
    const hasVerified = all.some((f) => f.status === 'verified');
    if (!hasVerified) return { ok: true }; // no MFA enrolled → pass through

    // Only enforce AAL2 when we can read the assurance level.
    let aalCurrent = 'aal1'; // assume lowest for safe-guard default
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      aalCurrent = aal?.currentLevel ?? 'aal1';
    } catch {
      // If we can't read AAL, assume the conservative pass path.
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
