import { type CRMResult, requireCRMAdmin, revalidateCRMRoutes } from './shared';

/**
 * Backfill contacts from contact-form submissions, profiles and completed
 * orders. Idempotent: re-running it unions tags and only applies a donation
 * total the first time each order is seen.
 */
export async function triggerHistoricalCRMSync(): Promise<CRMResult<{ syncedCount?: number }>> {
  const { adminClient } = await requireCRMAdmin();

  const { data, error } = await adminClient.rpc('crm_sync_historical_records');
  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as { contacts_synced?: number; activities_created?: number } | null;

  revalidateCRMRoutes();
  return {
    success: true,
    syncedCount: result?.contacts_synced ?? 0,
  };
}
