import {
  type CRMResult,
  crmAuditLostWarning,
  recordCRMAudit,
  requireCRMAdmin,
  revalidateCRMRoutes,
} from './shared';

/**
 * Backfill contacts from contact-form submissions, profiles and completed
 * orders. Idempotent: re-running it unions tags and only applies a donation
 * total the first time each order is seen.
 */
export async function triggerHistoricalCRMSync(): Promise<CRMResult<{ syncedCount?: number }>> {
  const admin = await requireCRMAdmin();
  const { adminClient } = admin;

  const { data, error } = await adminClient.rpc('crm_sync_historical_records');
  if (error) {
    await recordCRMAudit(admin, {
      action: 'crm.sync.historical',
      targetType: 'crm_operation',
      targetId: 'historical-sync',
      targetLabel: 'Historical CRM sync',
      before: null,
      after: null,
      outcome: 'failure',
      error: error.message,
    });
    return { success: false, error: error.message };
  }

  const result = data as { contacts_synced?: number; activities_created?: number } | null;

  const auditResult = await recordCRMAudit(admin, {
    action: 'crm.sync.historical',
    targetType: 'crm_operation',
    targetId: 'historical-sync',
    targetLabel: 'Historical CRM sync',
    before: null,
    after: result,
    outcome: 'success',
  });
  const warning = crmAuditLostWarning(auditResult, 'The historical sync completed');
  revalidateCRMRoutes();
  return {
    success: true,
    syncedCount: result?.contacts_synced ?? 0,
    ...(warning ? { warning } : {}),
  };
}
