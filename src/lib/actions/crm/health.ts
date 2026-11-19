import { env } from '@/lib/env';
import type { BackendStatus, EdgeFunctionHealth } from '@/types/unified';
import { requireCRMAdmin } from './shared';

/**
 * Probes health of Supabase Database, Supabase S3 Storage ('media' bucket),
 * and the broadcast sender Edge Function.
 *
 * Used by the CRM admin dashboard and broadcast composer to give real-time
 * visibility into infrastructure readiness before launching campaigns.
 */
export async function getCRMEdgeFunctionHealth(): Promise<BackendStatus> {
  let dbOk = false;
  let storageOk = false;
  let edgeOk = false;
  let edgeDetails: EdgeFunctionHealth | undefined;
  let errMessage: string | undefined;

  try {
    const { adminClient } = await requireCRMAdmin();

    // 1. Probe Database
    const { error: dbError } = await adminClient.from('crm_contacts').select('id').limit(1);
    dbOk = !dbError;

    // 2. Probe Storage
    const { error: storageError } = await adminClient.storage
      .from('media')
      .list('crm', { limit: 1 });
    storageOk = !storageError;

    // 3. Probe Edge Function
    const functionUrl =
      env.CRM_BROADCAST_FUNCTION_URL ||
      (env.NEXT_PUBLIC_SUPABASE_URL
        ? `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/health`
        : undefined);
    if (functionUrl) {
      const probeUrl = functionUrl.endsWith('/health')
        ? functionUrl
        : functionUrl.includes('/functions/v1/')
          ? `${functionUrl.split('/functions/v1/')[0]}/functions/v1/health`
          : `${functionUrl}/health`;
      const startTime = Date.now();
      try {
        const res = await fetch(probeUrl, {
          signal: AbortSignal.timeout(5_000),
        });
        const latencyMs = Date.now() - startTime;
        if (res.ok) {
          const body = (await res.json()) as { ok?: boolean; ready?: boolean; missing?: string[] };
          const isReady = body.ready ?? body.ok ?? true;
          edgeOk = isReady;
          edgeDetails = {
            ready: isReady,
            missing: body.missing,
            endpoint: functionUrl,
            checkedAt: new Date().toISOString(),
            latencyMs,
          };
        } else {
          edgeDetails = {
            ready: false,
            endpoint: functionUrl,
            checkedAt: new Date().toISOString(),
            latencyMs,
            missing: [`HTTP_${res.status}`],
          };
        }
      } catch {
        edgeDetails = {
          ready: false,
          endpoint: functionUrl,
          checkedAt: new Date().toISOString(),
          missing: ['UNREACHABLE_OR_TIMEOUT'],
        };
      }
    }
  } catch (err) {
    errMessage = err instanceof Error ? err.message : 'Failed to query CRM health';
  }

  return {
    database: dbOk,
    storage: storageOk,
    edgeFunction: edgeOk,
    edgeFunctionDetails: edgeDetails,
    error: errMessage,
  };
}
