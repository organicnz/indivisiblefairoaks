import { AdminNav } from '@/components/admin/AdminNav';
import { requireAdmin } from '@/lib/admin-auth';
import { isE2EMode } from '@/lib/e2e-mode';

// Deliberate Cache Components opt-out (Block): requireAdmin() session gate covers every admin segment.
export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="bg-white min-h-screen pt-(--header-h) pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {isE2EMode() && (
          <div
            role="status"
            className="mb-6 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950"
          >
            E2E test build — email delivery is disabled and broadcasts cannot be sent. This is a
            Playwright-only configuration, not a production failure.
          </div>
        )}
        <AdminNav />
        {children}
      </div>
    </div>
  );
}
