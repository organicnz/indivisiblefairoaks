import { Link2 } from 'lucide-react';
import { CivicLinkManager } from '@/components/admin/civic/CivicLinkManager';
import { requireAdmin } from '@/lib/admin-auth';

export const instant = false;

export async function generateMetadata() {
  return {
    title: 'Coalition Links — Admin · Indivisible Fair Oaks',
    description:
      'Manage vetted coalition partners, voter resource links, and civic action websites.',
    robots: { index: false, follow: false },
  };
}

export default async function AdminLinksPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs">
            <Link2 size={20} />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
            Admin Panel · Civic Directory
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground uppercase">
          Coalition &amp; Action Links
        </h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
        <p className="mt-3 text-xs font-bold text-muted-foreground max-w-2xl">
          Publish, edit, and reorganize vetted grassroots coalition partners, ballot trackers, and
          civic education links displayed on the public links directory.
        </p>
      </div>

      <CivicLinkManager />
    </div>
  );
}
