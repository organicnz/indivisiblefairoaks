'use server';

import { assertMfaVerified } from '@/lib/mfa-guard';
import { createServerClient } from '@/lib/supabase-server';

export type UpdatePasswordResult = { success: true } | { error: string; reason?: string };

/**
 * Rotate the account password behind the step-up gate.
 *
 * The page used to call `supabase.auth.updateUser({ password })` straight from
 * the browser, with the gate as React state in the component. An AAL1 session
 * holder who never rendered the component could call GoTrue's `PUT
 * /auth/v1/user` directly — authorised by nothing but the access token — and
 * rotate the password of a 2FA account. The page's own comment said the whole
 * point of enrolling a second factor is that a stolen password is not enough;
 * the gate did not deliver it, because there was no server in the path to
 * enforce anything.
 *
 * Now the write goes through here. `assertMfaVerified` reads live
 * `listFactors()` and the assurance level from the server client, so a stale
 * cookie snapshot cannot decide in either direction — the thing the old client
 * gate got wrong by checking AAL before factors. The client gate stays as UX
 * (it directs the volunteer to the challenge before they type); this is the
 * enforcement.
 *
 * `reason` travels with the error in the same shape as
 * `updateUserSettingsAction`, so the page can tell "go enter a code" from "we
 * could not read your MFA state" instead of collapsing both into one string.
 */
export async function updatePasswordAction(password: string): Promise<UpdatePasswordResult> {
  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in. Sign in again and retry.' };

  const mfa = await assertMfaVerified(supabase);
  if (!mfa.ok) return { error: mfa.error, reason: mfa.reason };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { success: true };
}
