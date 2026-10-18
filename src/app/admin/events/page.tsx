import { Calendar } from 'lucide-react';
import { CivicEventManager } from '@/components/admin/civic/CivicEventManager';
import { requireAdmin } from '@/lib/admin-auth';

export const instant = false;

export async function generateMetadata() {
  return {
    title: 'Events & Actions — Admin · Indivisible Fair Oaks',
    description:
      'Create, schedule, edit, and organize chapter meetings, choir rallies, and mobilizations.',
    robots: { index: false, follow: false },
  };
}

export default async function AdminEventsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs">
            <Calendar size={20} />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
            Admin Panel · Civic Actions
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground uppercase">
          Events &amp; Mobilizations
        </h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
        <p className="mt-3 text-xs font-bold text-muted-foreground max-w-2xl">
          Schedule upcoming chapter gatherings, choir protests, rallies, and deep canvassing
          workshops. Automatically generates Google Calendar and .ics invitations for attendees.
        </p>
      </div>

      <CivicEventManager />
    </div>
  );
}
