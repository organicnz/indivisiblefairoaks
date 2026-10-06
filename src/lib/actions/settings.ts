'use server';

import { revalidatePath } from 'next/cache';
import { assertMfaVerified } from '@/lib/mfa-guard';
import type { UserSettings } from '@/lib/store/settings';
import { createServerClient } from '@/lib/supabase-server';
import type { Json } from '@/types/supabase';

/**
 * Server Action to update user settings.
 * This provides a secure way to update settings and handles cache invalidation.
 */
export async function updateUserSettingsAction(settings: Partial<UserSettings>) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    return { error: 'Unauthorized or missing email' };
  }

  // Step-up: MFA-enrolled sessions must be AAL2 before mutating account data.
  //
  // `reason` travels with the error so the caller can tell "go enter a code"
  // from "we could not read your MFA state". Collapsing both into one string is
  // why this action used to tell a volunteer whose session was fine to try a
  // hard reload.
  const mfa = await assertMfaVerified(supabase);
  if (!mfa.ok) return { error: mfa.error, reason: mfa.reason };

  // Allowlist, not a denylist: a new key must be added deliberately.
  // `preferred_currency` was removed here along with the dead currency picker —
  // the storefront has one price list, so the setting had no effect.
  const allowedKeys: (keyof UserSettings)[] = ['marketing_emails', 'order_updates'];
  const filteredSettings: Partial<UserSettings> = {};

  for (const key of allowedKeys) {
    if (key in settings) {
      (filteredSettings as Record<string, unknown>)[key] = settings[key];
    }
  }

  // Fetch current settings to merge
  let { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('settings')
    .eq('user_id', user.id)
    .single();

  if (fetchError && fetchError.code === 'PGRST116' && user.email) {
    // Try by email if user_id match fails (for legacy profiles)
    const { data: emailData, error: emailError } = await supabase
      .from('profiles')
      .select('settings')
      .eq('email', user.email)
      .single();

    if (!emailError) {
      profile = emailData;
      fetchError = null;
    }
  }

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Fetch error in updateUserSettingsAction:', fetchError);
    // Instead of failing, we'll proceed with just the new settings to ensure the user can save.
    // The upsert later will handle the database-side merge or create.
  }

  const updatedSettings = {
    ...(profile?.settings as Record<string, unknown>),
    ...filteredSettings,
  };

  const { error: upsertError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      user_id: user.id,
      email: user.email,
      settings: updatedSettings as Json,
    },
    {
      onConflict: 'user_id',
    }
  );

  if (upsertError) {
    // Final fallback by email if user_id conflict occurs or fails
    const { error: emailError } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        user_id: user.id,
        settings: updatedSettings,
      },
      {
        onConflict: 'email',
      }
    );

    if (emailError) {
      console.error('Upsert error in updateUserSettingsAction:', emailError);
      return { error: emailError.message };
    }
  }

  // Revalidate the entire app since settings can affect many pages (currency, etc)
  revalidatePath('/', 'layout');

  return { success: true, settings: updatedSettings };
}

export type UnenrollMfaResult = { success: true } | { error: string; reason?: string };

/**
 * Remove a verified MFA factor behind the step-up gate.
 *
 * Every factor mutation used to be `supabase.auth.mfa.*` straight from the
 * browser, with no server in the path at all — so no step-up could apply.
 * A session obtained by stealing only the password (AAL1, no second factor
 * presented) could call `unenroll` and permanently remove the account's 2FA,
 * and unlike a password rotation the victim cannot undo it: per `docs/mfa.md`
 * the only exit is an out-of-band dashboard reset.
 *
 * Only *removal of a verified factor* goes through here. Clearing an
 * *unverified* factor — the abandoned-enrollment cleanup in `startEnrollment`
 * and the dialog-cancel path — stays client-side on purpose: an unverified
 * factor is not a way in (the guard itself ignores it), so removing one cannot
 * reduce the account's security, and gating cleanup on AAL2 would strand
 * half-finished enrollments behind a challenge the user has no reason to
 * complete.
 *
 * `reason` travels with the error in the same shape as
 * `updateUserSettingsAction`, so the panel can render the step-up link for a
 * step-up request and the reload hint for everything else.
 */
export async function unenrollMfaFactorAction(factorId: string): Promise<UnenrollMfaResult> {
  if (!factorId || typeof factorId !== 'string') {
    return { error: 'No factor to remove.' };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in. Sign in again and retry.' };

  const mfa = await assertMfaVerified(supabase);
  if (!mfa.ok) return { error: mfa.error, reason: mfa.reason };

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };

  return { success: true };
}
