'use server';

import { revalidatePath } from 'next/cache';
import { assertMfaVerified, isStepUpChallenge, MFA_STEP_UP_ERROR } from '@/lib/mfa-guard';
import { createAdminClient, createServerClient } from '@/lib/supabase-server';

async function requireAdminClient() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const mfa = await assertMfaVerified(supabase);
  if (!mfa.ok) {
    const error = new Error(mfa.error);
    if (isStepUpChallenge(mfa)) error.name = MFA_STEP_UP_ERROR;
    throw error;
  }

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('is_admin')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .single();

  if (!profile?.is_admin) throw new Error('Not authorised');
  return adminClient;
}

export async function markAdminUser(profileId: string, isAdmin: boolean) {
  const adminClient = await requireAdminClient();
  const { error } = await adminClient
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', profileId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/crm');
  revalidatePath('/admin');
}
