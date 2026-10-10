import { AlertCircle, Calendar, ExternalLink, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { InteractiveEventsCalendar } from '@/components/ui/InteractiveEventsCalendar';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { pageMetadata } from '@/lib/metadata';
import { getEvents } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'Events & Actions',
  description:
    'Join our upcoming chapter meetings, singing protests with the Carmichael Resistance Choir, weekly rallies, and voter mobilization events in Sacramento County.',
  path: '/events',
});

export default async function EventsPage() {
  let initialEvents: Awaited<ReturnType<typeof getEvents>> | undefined;
  try {
    const rows = await getEvents();
    if (rows.length > 0) initialEvents = rows;
  } catch {
    // calendar falls back to inline rows
  }
  return (
    <div className="w-full bg-background text-foreground dark:bg-secondary dark:text-white min-h-screen pt-(--header-clearance) pb-20">
      {/* Header Banner with VGPU Constellation Network */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border-b border-white/10 py-16">
        <VgpuCivicConstellation />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pointer-events-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-bright/10 border border-primary-on-dark-muted/30 text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4">
            <Calendar size={14} className="text-accent-gold" />
            <span>Community Actions & Calendar</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Upcoming Events & Mobilizations
          </h1>
          <p className="text-lg text-ink-on-dark max-w-2xl mx-auto leading-relaxed">
            Find out when and where our chapter is gathering. All community members committed to
            peaceful, democratic activism are warmly welcome.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <InteractiveEventsCalendar initialEvents={initialEvents} />

        {/* Trainings & Campaign Initiatives — copy region */}
        <div className="space-y-6 pt-6 border-t border-border dark:border-white/10">
          <h2 className="text-2xl font-black text-foreground dark:text-white tracking-tight flex items-center gap-2">
            <Users className="text-primary-ink dark:text-primary-on-dark-muted" />
            <span>Trainings & Action Labs</span>
          </h2>

          <CopyRegion id="events-trainings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-surface-card border border-border dark:bg-secondary/70 dark:border-white/10 space-y-3">
                <h3 className="text-lg font-bold text-foreground dark:text-white">
                  Deep Canvass Political Persuasion Training
                </h3>
                <p className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                  Learn the proven art of deep canvassing: connecting with conflicted voters through
                  empathetic listening and shared values to build durable election support.
                </p>
                <span className="inline-block text-[11px] font-bold text-primary-ink dark:text-accent-gold uppercase tracking-wider">
                  We The Fighters / Organizing to Fight Oligarchy
                </span>
              </div>

              <div className="p-6 rounded-2xl bg-surface-card border border-border dark:bg-secondary/70 dark:border-white/10 space-y-3">
                <h3 className="text-lg font-bold text-foreground dark:text-white">
                  Know Your Rights Civic Workshop
                </h3>
                <p className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                  Everyone has fundamental constitutional rights under U.S. law. Learn what your
                  rights are, how to safely exercise them in public, and what to do if your rights
                  are violated.
                </p>
                <a
                  href="https://www.aclu.org/know-your-rights"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-primary-ink dark:text-primary-on-dark-muted hover:text-primary-ink dark:text-primary-on-dark inline-flex items-center gap-1"
                >
                  <span>ACLU Know Your Rights Guide</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </CopyRegion>
        </div>

        {/* Nonviolence Banner */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border dark:bg-secondary dark:border-white/10 flex items-start gap-4">
          <AlertCircle className="text-accent dark:text-accent-gold shrink-0 mt-1" size={24} />
          <div className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed">
            <strong className="text-foreground dark:text-white block mb-1">
              Our Nonviolent Commitment:
            </strong>
            All Indivisible Fair Oaks-Carmichael events are strictly nonviolent. We expect all
            attendees to act lawfully and de-escalate any potential confrontation with
            counter-protesters. No weapons are permitted at any event.
          </div>
        </div>
      </div>
    </div>
  );
}
