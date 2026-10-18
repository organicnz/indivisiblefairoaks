import { Newspaper } from 'lucide-react';
import { CivicNewsletterManager } from '@/components/admin/civic/CivicNewsletterManager';
import { requireAdmin } from '@/lib/admin-auth';

export const instant = false;

export async function generateMetadata() {
  return {
    title: 'Newsletters & Bulletins — Admin · Indivisible Fair Oaks',
    description:
      'Publish, edit, and organize past chapter bulletins, newsletters, and action alerts.',
    robots: { index: false, follow: false },
  };
}

export default async function AdminNewsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs">
            <Newspaper size={20} />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
            Admin Panel · Chapter Bulletins
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground uppercase">
          Newsletters &amp; Bulletins
        </h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
        <p className="mt-3 text-xs font-bold text-muted-foreground max-w-2xl">
          Publish monthly chapter bulletins, legislative round-ups, and resistance updates. To
          publish full long-form articles, use Pages &amp; Posts with type &ldquo;Post&rdquo;.
        </p>
      </div>

      <CivicNewsletterManager />
    </div>
  );
}
