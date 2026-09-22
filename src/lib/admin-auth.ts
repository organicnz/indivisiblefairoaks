import { redirect } from 'next/navigation';
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

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('is_admin, email')
    .or(`user_id.eq.${user.id},email.eq.${user.email}`)
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
    .or(`user_id.eq.${user.id},email.eq.${user.email}`)
    .single();

  return Boolean(profile?.is_admin);
}
