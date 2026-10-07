import { redirect } from 'next/navigation';
import { assertMfaVerified, isStepUpChallenge } from '@/lib/mfa-guard';
import { createAdminClient, createServerClient } from '@/lib/supabase-server';

export type AdminSession = {
  adminUserId: string;
  adminEmail: string;
  adminClient: Awaited<ReturnType<typeof createAdminClient>>;
};

export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  // Step-up: admins with MFA enrolled must hold an AAL2 session.
  //
  // Only `step_up_required` earns a redirect. Redirecting on *every* denial is
  // what built the loop: a `listFactors` failure on this page pushed the user to
  // /auth/mfa, which could not read its own factors either, pushed to /login,
  // and middleware bounced the still-signed-in user off /login back to a gated
  // route. Four hops, no message. A fault is surfaced as a fault.
  const mfa = await assertMfaVerified(supabase);
  if (!mfa.ok) {
    /*
     * `?next=/admin`, not a bare `/auth/mfa`. The challenge defaults to
     * `/account`, so a bare redirect dropped an admin onto their dashboard with
     * the order status still unsaved and no indication they had to redo it.
     * Every caller of this function is an admin route — the `/login?next=/admin`
     * above already says so — which is why the return path is the section
     * root rather than the exact page. The challenge re-validates it through
     * `getSafeNextPath`, so nothing untrusted reaches the redirect.
     */
    if (isStepUpChallenge(mfa)) redirect('/auth/mfa?next=/admin');
    throw new Error(mfa.error);
  }

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('is_admin, email')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .single();

  if (!profile?.is_admin) {
    redirect('/account?error=admin_required');
  }

  return {
    adminUserId: user.id,
    adminEmail: profile.email || user.email || '',
    adminClient,
  };
}

export async function isAdminUser(): Promise<boolean> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('is_admin')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .single();

  return Boolean(profile?.is_admin);
}
