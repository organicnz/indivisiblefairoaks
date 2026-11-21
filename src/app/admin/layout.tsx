import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AdminAuditLossBanner } from '@/components/admin/AdminAuditLossBanner';
import { AdminNav } from '@/components/admin/AdminNav';
import { ClientOnly } from '@/components/ui/ClientOnly';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { ADMIN_AUDIT_LOSS_COOKIE } from '@/lib/admin-audit-alert';
import { requireAdminPage } from '@/lib/admin-auth';
import { isE2EMode } from '@/lib/e2e-mode';

// Deliberate Cache Components opt-out (Block): requireAdminPage() session gate covers every admin segment.
export const instant = false;

export const metadata: Metadata = {
  // Admin pages already put "Admin · Indivisible Fair Oaks" in each title, so
  // the nearest template is the identity function rather than the root
  // `%s | Site` one, which would append the brand a second time.
  title: { default: 'Admin', template: '%s' },
  // Every admin page is noindex and must not inherit the root `/` canonical.
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const cookieStore = await cookies();
  const auditLossAt = cookieStore.get(ADMIN_AUDIT_LOSS_COOKIE)?.value ?? null;
  return (
    <div className="admin-surface relative min-h-screen overflow-hidden bg-surface-card pb-16 pt-(--header-clearance)">
      <VgpuCivicConstellation className="pointer-events-none opacity-20" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {isE2EMode() && (
          <div
            role="status"
            className="mb-6 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950"
          >
            E2E test build — email delivery is disabled and broadcasts cannot be sent. This is a
            Playwright-only configuration, not a production failure.
          </div>
        )}
        {auditLossAt ? <AdminAuditLossBanner reportedAt={auditLossAt} /> : null}
        <ClientOnly fallback={<div className="mb-12 h-10" aria-hidden="true" />}>
          <AdminNav />
        </ClientOnly>
        {children}
      </div>
    </div>
  );
}
