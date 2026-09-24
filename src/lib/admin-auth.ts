import { redirect } from 'next/navigation';
import { assertMfaVerified } from '@/lib/mfa-guard';
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
  const mfa = await assertMfaVerified(supabase);
  if (!mfa.ok) redirect('/auth/mfa');

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
