import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-api-auth';
import {
  AdminAuditExportTooLargeError,
  exportAdminAuditCsv,
  parseAdminAuditFilters,
} from '@/lib/admin-audit-read';

export const maxDuration = 60;

const NO_STORE = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

function failure(status: number, message: string) {
  return new NextResponse(message, {
    status,
    headers: {
      ...NO_STORE,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

/**
 * Privileged CSV export. The list page is a server component behind
 * `requireAdminPage`; this route repeats the full admin + AAL2 check because a
 * download URL can be called directly and must not rely on the page shell.
 */
export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return failure(auth.status, auth.error);

  const url = new URL(request.url);
  const filters = parseAdminAuditFilters(Object.fromEntries(url.searchParams));

  try {
    const csv = await exportAdminAuditCsv(auth.session.adminClient, filters);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        ...NO_STORE,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="admin-audit-${stamp}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof AdminAuditExportTooLargeError) {
      return failure(413, error.message);
    }
    return failure(500, 'The audit export is temporarily unavailable. Try again.');
  }
}
