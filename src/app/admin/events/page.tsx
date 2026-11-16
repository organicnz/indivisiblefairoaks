import { BookOpen, Calendar } from 'lucide-react';
import { EventsAdminTabs } from '@/components/admin/civic/EventsAdminTabs';
import { requireAdminPage } from '@/lib/admin-auth';

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
  await requireAdminPage();

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
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
          Events &amp; mobilizations
        </h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
        <p className="mt-3 text-xs font-bold text-muted-foreground max-w-2xl">
          Schedule upcoming chapter gatherings, choir protests, rallies, and deep canvassing
          workshops. Automatically generates Google Calendar and .ics invitations for attendees.
        </p>
      </div>

      <section
        aria-labelledby="event-editor-guide"
        className="rounded-sm border border-border bg-surface-card p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary-ink dark:text-primary-on-dark">
            <BookOpen size={18} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              Chapter editor guide
            </p>
            <h2
              id="event-editor-guide"
              className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]"
            >
              How the next meeting is chosen
            </h2>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-muted-foreground">
              Add future chapter meetings here with their date and time. The homepage announces the
              next future highlighted chapter meeting automatically, so you can enter dates in
              advance and do not have to edit the homepage each month.
            </p>
            <ul className="mt-3 grid gap-1.5 text-xs leading-relaxed text-muted-foreground sm:grid-cols-3">
              <li>Past one-off events are hidden from the public Events page.</li>
              <li>“Ongoing” and “Every …” rows stay visible as recurring activity.</li>
              <li>December 1 is the fallback until a newer meeting is added.</li>
            </ul>
          </div>
        </div>
      </section>

      <div id="event-manager">
        <EventsAdminTabs />
      </div>
    </div>
  );
}
