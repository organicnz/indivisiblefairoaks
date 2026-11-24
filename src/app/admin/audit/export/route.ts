import { NextResponse } from 'next/server';
import type { AdminApiSession } from '@/lib/admin-api-auth';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { type AdminAuditResult, recordAdminAudit } from '@/lib/admin-audit';
import {
  type AdminAuditCsvExport,
  AdminAuditExportTooLargeError,
  type AdminAuditFilters,
  exportAdminAuditCsv,
  parseAdminAuditFilters,
} from '@/lib/admin-audit-read';

export const maxDuration = 60;

const NO_STORE = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

const AUDIT_EXPORT_TARGET_ID = 'admin-audit-export';
const AUDIT_EXPORT_TARGET_LABEL = 'Audit log CSV export';

function failure(status: number, message: string) {
  return new NextResponse(message, {
    status,
    headers: {
      ...NO_STORE,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

interface ExportAuditDetails {
  rowCount: number;
  operationIds: string[];
  /** The filtered total when an export was refused before rows were read. */
  matchedCount?: number;
  reason?: 'row_cap' | 'read_failure';
}

/**
 * Record one audit-explorer export.
 *
 * The actor, MFA level and outcome live in the audit log's own columns; the
 * metadata carries what the exported evidence set was. Operation IDs are the
 * exact rows serialized into the CSV, in CSV order, so a later review can
 * identify every record that left the building without re-running the filters.
 *
 * A transient write is retried and queued by `recordAdminAudit`. The caller
 * decides whether a failure is safe to ignore: on success it is not, because an
 * export that could not be recorded must not be released.
 */
async function recordExportAudit(
  session: AdminApiSession,
  outcome: 'success' | 'failure',
  filters: AdminAuditFilters,
  details: ExportAuditDetails,
  error: string | null
): Promise<AdminAuditResult> {
  try {
    return await recordAdminAudit(session.adminClient, {
      actorUserId: session.adminUserId,
      actorEmail: session.adminEmail,
      action: 'admin.audit.export',
      targetType: 'admin_audit',
      targetId: AUDIT_EXPORT_TARGET_ID,
      targetLabel: AUDIT_EXPORT_TARGET_LABEL,
      mfaLevel: session.mfaLevel,
      outcome,
      error,
      metadata: {
        format: 'csv',
        filters,
        row_count: details.rowCount,
        operation_ids: details.operationIds,
        ...(details.matchedCount === undefined ? {} : { matched_count: details.matchedCount }),
        ...(details.reason ? { reason: details.reason } : {}),
      },
    });
  } catch (auditError) {
    // `recordAdminAudit` already catches database faults; this only guards a
    // truly unexpected recorder failure from turning the export response into
    // an unhandled route error.
    console.error('[admin-audit-export] audit recorder threw', {
      error: auditError instanceof Error ? auditError.message : String(auditError),
    });
    return { ok: false, error: 'audit recorder failed', queued: false };
  }
}

/**
 * Privileged CSV export. The list page is a server component behind
 * `requireAdminPage`; this route repeats the full admin + AAL2 check because a
 * download URL can be called directly and must not rely on the page shell.
 *
 * Access to the evidence is itself evidence: every successful export appends an
 * `admin.audit.export` row before the file is released. Refused exports append a
 * failure row as well, so an attempt to pull an oversized set or a read fault is
 * visible in the same accountable history.
 */
export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return failure(auth.status, auth.error);

  const url = new URL(request.url);
  const filters = parseAdminAuditFilters(Object.fromEntries(url.searchParams));

  try {
    const exported: AdminAuditCsvExport = await exportAdminAuditCsv(
      auth.session.adminClient,
      filters
    );

    const audit = await recordExportAudit(
      auth.session,
      'success',
      filters,
      {
        rowCount: exported.rowCount,
        operationIds: exported.operationIds,
      },
      null
    );

    /*
     * A direct write or an outbox enqueue both make the record durable. If
     * neither happened, returning the CSV would grant access to evidence with
     * no accountable record of who read it. The export is already in memory, so
     * refusing here is the last point at which it can be withheld.
     */
    if (!audit.ok && !audit.queued) {
      return failure(
        503,
        'The export could not be recorded in the audit log, so it was not released. Try again.'
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(exported.csv, {
      status: 200,
      headers: {
        ...NO_STORE,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="admin-audit-${stamp}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof AdminAuditExportTooLargeError) {
      await recordExportAudit(
        auth.session,
        'failure',
        filters,
        {
          rowCount: 0,
          operationIds: [],
          matchedCount: error.totalCount,
          reason: 'row_cap',
        },
        error.message
      );
      return failure(413, error.message);
    }

    const message = 'The audit export is temporarily unavailable. Try again.';
    await recordExportAudit(
      auth.session,
      'failure',
      filters,
      {
        rowCount: 0,
        operationIds: [],
        reason: 'read_failure',
      },
      error instanceof Error ? error.message : message
    );
    return failure(500, message);
  }
}
