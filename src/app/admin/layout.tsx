import { AdminNav } from '@/components/admin/AdminNav';
import { ClientOnly } from '@/components/ui/ClientOnly';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { requireAdminPage } from '@/lib/admin-auth';
import { isE2EMode } from '@/lib/e2e-mode';

// Deliberate Cache Components opt-out (Block): requireAdminPage() session gate covers every admin segment.
export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
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
        <ClientOnly fallback={<div className="mb-12 h-10" aria-hidden="true" />}>
          <AdminNav />
        </ClientOnly>
        {children}
      </div>
    </div>
  );
}
