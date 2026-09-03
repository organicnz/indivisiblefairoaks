import { AdminNav } from '@/components/admin/AdminNav';
import { requireAdmin } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out (Block): requireAdmin() session gate covers every admin segment.
export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="bg-white min-h-screen pt-(--header-h) pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminNav />
        {children}
      </div>
    </div>
  );
}
