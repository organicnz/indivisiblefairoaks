'use server';

import { revalidatePath } from 'next/cache';
import { recordAdminAudit } from '@/lib/admin-audit';
import {
  assertMfaVerified,
  isMfaEnrollmentRequired,
  isStepUpChallenge,
  MFA_ENROLLMENT_ERROR,
  MFA_STEP_UP_ERROR,
} from '@/lib/mfa-guard';
import { createAdminClient, createServerClient } from '@/lib/supabase-server';

async function requireAdminClient() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const adminClient = await createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('is_admin')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle();

  // A failed read is not a denied role. Only an empty profile means the user
  // has no admin grant; a database failure must remain retryable.
  if (profileError) throw new Error('Could not verify admin access. Try again.');
  if (!profile?.is_admin) throw new Error('Not authorised');

  const mfa = await assertMfaVerified(supabase, { requireEnrollment: true });
  if (!mfa.ok) {
    const error = new Error(mfa.error);
    if (isStepUpChallenge(mfa)) error.name = MFA_STEP_UP_ERROR;
    if (isMfaEnrollmentRequired(mfa)) error.name = MFA_ENROLLMENT_ERROR;
    throw error;
  }

  return {
    adminClient,
    adminUserId: user.id,
    adminEmail: user.email || '',
    mfaLevel: 'aal2' as const,
  };
}

export async function markAdminUser(profileId: string, isAdmin: boolean) {
  const { adminClient, adminUserId, adminEmail, mfaLevel } = await requireAdminClient();

  // Read the target first so the audit record carries the value that changed,
  // not merely the value that was requested. The update itself still reports
  // whether a row matched, so a concurrent delete is not reported as a grant.
  const { data: target, error: targetError } = await adminClient
    .from('profiles')
    .select('id, is_admin, email')
    .eq('id', profileId)
    .maybeSingle();
  if (targetError) throw new Error(targetError.message);
  if (!target) throw new Error('That profile no longer exists');

  const targetLabel = target.email || null;
  const before = { is_admin: target.is_admin };
  const after = { is_admin: isAdmin };

  const { data: updated, error } = await adminClient
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', profileId)
    .select('id')
    .maybeSingle();

  if (error) {
    await recordAdminAudit(adminClient, {
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: isAdmin ? 'admin.role.grant' : 'admin.role.revoke',
      targetType: 'profile',
      targetId: profileId,
      targetLabel,
      before,
      after,
      mfaLevel,
      outcome: 'failure',
      error: error.message,
    });
    throw new Error(error.message);
  }
  if (!updated) {
    await recordAdminAudit(adminClient, {
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: isAdmin ? 'admin.role.grant' : 'admin.role.revoke',
      targetType: 'profile',
      targetId: profileId,
      targetLabel,
      before,
      after,
      mfaLevel,
      outcome: 'failure',
      error: 'That profile no longer exists',
    });
    throw new Error('That profile no longer exists');
  }

  await recordAdminAudit(adminClient, {
    actorUserId: adminUserId,
    actorEmail: adminEmail,
    action: isAdmin ? 'admin.role.grant' : 'admin.role.revoke',
    targetType: 'profile',
    targetId: profileId,
    targetLabel,
    before,
    after,
    mfaLevel,
    outcome: 'success',
  });

  revalidatePath('/admin/crm');
  revalidatePath('/admin');
}
