'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertMfaVerified,
  hasVerifiedTotpFactor,
  type MfaFailureReason,
} from '@/lib/mfa-guard';
import { isRecoveryCodeShape, normalizeRecoveryCode } from '@/lib/mfa-recovery';
import { generateRecoveryCodes, hashRecoveryCode } from '@/lib/mfa-recovery-server';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient, createServerClient } from '@/lib/supabase-server';

type RecoveryFailure = { error: string; reason?: MfaFailureReason };
export type MfaRecoveryCodeStatus = { total: number; remaining: number };
export type GenerateMfaRecoveryCodesResult = { codes: string[] } | RecoveryFailure;
export type RedeemMfaRecoveryCodeResult =
  | { success: true; removedFactors: number }
  | RecoveryFailure;

function untypedClient(adminClient: Awaited<ReturnType<typeof createAdminClient>>) {
  // `mfa_recovery_codes` is newer than the generated database types. The table
  // has RLS with no client policies and is reached only through this
  // service-role client, so the cast does not widen a browser path.
  return adminClient as unknown as SupabaseClient;
}

export async function getMfaRecoveryCodeStatusAction(): Promise<
  MfaRecoveryCodeStatus | RecoveryFailure
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in. Sign in again and retry.' };

  try {
    const adminClient = await createAdminClient();
    const { data, error } = await untypedClient(adminClient)
      .from('mfa_recovery_codes')
      .select('used_at')
      .eq('user_id', user.id);

    if (error) return { error: 'Could not read recovery codes. Try again in a moment.' };

    const rows = (data ?? []) as { used_at: string | null }[];
    return {
      total: rows.length,
      remaining: rows.filter((row) => row.used_at === null).length,
    };
  } catch {
    return { error: 'Could not read recovery codes. Try again in a moment.' };
  }
}

export async function generateMfaRecoveryCodesAction(): Promise<GenerateMfaRecoveryCodesResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in. Sign in again and retry.' };

  const mfa = await assertMfaVerified(supabase);
  if (!mfa.ok) return { error: mfa.error, reason: mfa.reason };

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError || !factors) {
    return { error: 'Could not read your authenticator setup. Try again in a moment.' };
  }
  if (!hasVerifiedTotpFactor(factors)) {
    return { error: 'Set up an authenticator app before generating recovery codes.' };
  }

  const codes = generateRecoveryCodes();
  try {
    const adminClient = await createAdminClient();
    const { error } = await untypedClient(adminClient).rpc('replace_mfa_recovery_codes', {
      p_user_id: user.id,
      p_code_hashes: codes.map(hashRecoveryCode),
    });
    if (error) return { error: 'Could not save recovery codes. Try again in a moment.' };
    return { codes };
  } catch {
    return { error: 'Could not save recovery codes. Try again in a moment.' };
  }
}

/**
 * Consume one recovery code and remove the account's verified TOTP factors.
 *
 * The code proves possession of the recovery sheet; deleting the factors is
 * what turns that proof into something the Auth server will accept as a clean
 * slate. The user must then sign in again and enroll a new authenticator. This
 * is deliberately a reset, not an app-level AAL2: an app cookie must never be
 * able to impersonate Supabase's assurance level.
 */
export async function redeemMfaRecoveryCodeAction(
  code: string
): Promise<RedeemMfaRecoveryCodeResult> {
  const normalized = normalizeRecoveryCode(code);
  if (!isRecoveryCodeShape(normalized)) {
    return { error: 'That recovery code is not valid or has already been used.' };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in. Sign in again and retry.' };

  // Recovery codes are high entropy, but guessing attempts still deserve a
  // ceiling: a stolen session should not get unlimited oracle calls.
  const gate = rateLimit(`mfa-recovery:${user.id}`, 5, 10 * 60_000);
  if (!gate.ok) {
    return {
      error: `Too many recovery attempts. Try again in ${gate.retryAfterSec}s.`,
    };
  }

  try {
    const adminClient = await createAdminClient();

    // Read the factors before claiming the code. A transient Admin API failure
    // must not burn a one-time recovery code the user still needs.
    const { data: factorData, error: factorsError } = await adminClient.auth.admin.mfa.listFactors(
      { userId: user.id }
    );
    if (factorsError || !factorData) {
      return {
        error: 'Could not read your authenticator setup. Your recovery code was not used — try again.',
      };
    }

    const totpFactors = factorData.factors.filter(
      (factor) => factor.status === 'verified' && factor.factor_type === 'totp'
    );
    if (totpFactors.length === 0) {
      return {
        error: 'No authenticator app is enrolled. Nothing was reset and your code was not used.',
      };
    }

    const table = untypedClient(adminClient).from('mfa_recovery_codes');
    const { data: row, error: lookupError } = await table
      .select('id')
      .eq('user_id', user.id)
      .eq('code_hash', hashRecoveryCode(normalized))
      .is('used_at', null)
      .maybeSingle();

    if (lookupError) {
      return { error: 'Could not verify that recovery code. Try again in a moment.' };
    }
    if (!row?.id) {
      return { error: 'That recovery code is not valid or has already been used.' };
    }

    // Claim the code before deleting anything. A second concurrent request must
    // not be able to replay the same code while the deletion is in flight.
    const { data: consumed, error: consumeError } = await table
      .update({ used_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('used_at', null)
      .select('id')
      .maybeSingle();
    if (consumeError || !consumed?.id) {
      return { error: 'That recovery code is not valid or has already been used.' };
    }

    for (const factor of totpFactors) {
      const { error: deleteError } = await adminClient.auth.admin.mfa.deleteFactor({
        userId: user.id,
        id: factor.id,
      });
      if (deleteError) {
        // The factor list is refreshed on retry, so releasing the code is safe
        // even when an earlier factor in this loop was already deleted.
        await untypedClient(adminClient)
          .from('mfa_recovery_codes')
          .update({ used_at: null })
          .eq('id', row.id);
        return {
          error:
            'Could not remove the authenticator. Your recovery code was released — try again, or contact a chapter organiser.',
        };
      }
    }

    // The reset screen tells the user to sign in again. Signing out here is
    // what makes that true: /login redirects an existing session straight back
    // to the destination, so leaving the reset session alive would skip the
    // password step entirely. Ignore a sign-out error because the factors and
    // code are already consumed; the client still leaves for /login.
    try {
      await supabase.auth.signOut();
    } catch {
      // Best effort. The factor reset has already happened.
    }

    return { success: true, removedFactors: totpFactors.length };
  } catch {
    return { error: 'Could not verify that recovery code. Try again in a moment.' };
  }
}
