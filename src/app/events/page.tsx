import { AlertCircle, Calendar, ExternalLink, Music, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { DataPoint } from '@/components/ui/DataPoint';
import { InteractiveEventsCalendar } from '@/components/ui/InteractiveEventsCalendar';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints, getEvents } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'Events & Actions',
  description:
    'Join our upcoming chapter meetings, singing protests with the Carmichael Resistance Choir, weekly rallies, and voter mobilization events in Sacramento County.',
  path: '/events',
});

export default async function EventsPage() {
  const [initialEventsRows, dataPoints] = await Promise.all([
    getEvents().catch(() => []),
    getDataPoints('events'),
  ]);
  const initialEvents = initialEventsRows.length > 0 ? initialEventsRows : undefined;
  return (
    <div className="w-full bg-background text-foreground min-h-screen pt-(--header-clearance) pb-20">
      {/* Header Banner with VGPU Constellation Network */}
      <div className="relative overflow-hidden bg-surface-muted border-b border-border text-foreground dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 dark:border-white/10 py-16">
        <VgpuCivicConstellation />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pointer-events-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary-ink dark:bg-primary-bright/10 dark:border-primary-on-dark-muted/30 dark:text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4">
            <Calendar size={14} className="text-accent-gold" />
            <DataPoint initialData={dataPoints} name="events.hero.eyebrow">
              Community Actions & Calendar
            </DataPoint>
          </div>
          <DataPoint
            initialData={dataPoints}
            name="events.hero.headline"
            as="h1"
            className="text-4xl sm:text-5xl font-black text-foreground dark:text-white tracking-tight mb-4"
          >
            Upcoming Events & Mobilizations
          </DataPoint>
          <DataPoint
            initialData={dataPoints}
            name="events.hero.intro"
            as="p"
            className="text-lg text-muted-foreground dark:text-ink-on-dark max-w-2xl mx-auto leading-relaxed"
          >
            Find out when and where our chapter is gathering. All community members committed to
            peaceful, democratic activism are warmly welcome.
          </DataPoint>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <InteractiveEventsCalendar initialEvents={initialEvents} />

        {/* Ongoing Street Corner Singing Protest Spotlight (Issue #87) */}
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/80 border border-border dark:from-blue-950/40 dark:via-slate-900 dark:to-indigo-950/40 dark:border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-card flex items-center justify-center text-accent dark:text-accent-gold shrink-0 mt-1 border border-border dark:border-white/10 shadow-xs">
              <Music size={24} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent-gold/15 border border-accent-gold/40 text-accent dark:text-accent-gold text-[11px] font-bold uppercase tracking-wide mb-1.5">
                <DataPoint initialData={dataPoints} as="span" name="events.spotlight.eyebrow">
                  Ongoing Community Action
                </DataPoint>
              </div>
              <DataPoint
                initialData={dataPoints}
                as="h2"
                name="events.spotlight.title"
                className="text-xl sm:text-2xl font-black text-foreground dark:text-white tracking-tight"
              >
                Carmichael Resistance Choir: Street Corner Singing Protest
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                as="p"
                name="events.spotlight.schedule"
                className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark mt-1 font-medium"
              >
                Every Saturday Afternoon • 3:00 PM – 4:30 PM • Corner of Fair Oaks Blvd &amp;
                Manzanita Ave, Carmichael, CA
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                as="p"
                name="events.spotlight.desc"
                className="text-xs text-muted-foreground dark:text-ink-muted-on-dark mt-2 leading-relaxed max-w-2xl"
              >
                We sing our protest to afternoon traffic and community patrons. Bring your signs,
                lawn chairs, and voices to stand up for democracy! No singing experience required —
                all community members are warmly welcomed.
              </DataPoint>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
            <Link
              href="/choir"
              className="w-full sm:w-auto text-center px-4 py-2.5 rounded-xl border border-border dark:border-white/10 bg-surface-card hover:bg-surface-muted text-foreground dark:bg-transparent dark:hover:bg-white/10 dark:text-ink-on-dark text-xs font-semibold uppercase tracking-wider transition-all"
            >
              <DataPoint initialData={dataPoints} as="span" name="events.spotlight.btn_songbook">
                Explore Songbook
              </DataPoint>
            </Link>
            <a
              href="https://www.mobilize.us/indivisible/event/1011420/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto text-center px-5 py-2.5 rounded-xl bg-primary-bright hover:bg-primary-light text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md"
            >
              <DataPoint initialData={dataPoints} as="span" name="events.spotlight.btn_protest">
                Join Next Protest
              </DataPoint>
            </a>
          </div>
        </div>

        {/* Trainings & Campaign Initiatives — copy region */}
        <div className="space-y-6 pt-6 border-t border-border dark:border-white/10">
          <h2 className="text-2xl font-black text-foreground dark:text-white tracking-tight flex items-center gap-2">
            <Users className="text-primary-ink dark:text-primary-on-dark-muted" />
            <DataPoint initialData={dataPoints} as="span" name="events.trainings.title">
              Trainings &amp; Action Labs
            </DataPoint>
          </h2>

          <CopyRegion id="events-trainings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-3">
                <DataPoint
                  initialData={dataPoints}
                  as="h3"
                  name="events.trainings.t1_title"
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  Deep Canvass Political Persuasion Training
                </DataPoint>
                <DataPoint
                  initialData={dataPoints}
                  as="p"
                  name="events.trainings.t1_desc"
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  Learn the proven art of deep canvassing: connecting with conflicted voters through
                  empathetic listening and shared values to build durable election support.
                </DataPoint>
                <DataPoint
                  initialData={dataPoints}
                  as="span"
                  name="events.trainings.t1_badge"
                  className="inline-block text-[11px] font-bold text-primary-ink dark:text-accent-gold uppercase tracking-wider"
                >
                  We The Fighters / Organizing to Fight Oligarchy
                </DataPoint>
              </div>

              <div className="p-6 rounded-2xl bg-surface-card border border-border space-y-3">
                <DataPoint
                  initialData={dataPoints}
                  as="h3"
                  name="events.trainings.t2_title"
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  Know Your Rights Civic Workshop
                </DataPoint>
                <DataPoint
                  initialData={dataPoints}
                  as="p"
                  name="events.trainings.t2_desc"
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  Everyone has fundamental constitutional rights under U.S. law. Learn what your
                  rights are, how to safely exercise them in public, and what to do if your rights
                  are violated.
                </DataPoint>
                <a
                  href="https://www.aclu.org/know-your-rights"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-primary-ink dark:text-primary-on-dark hover:underline inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
                >
                  <DataPoint initialData={dataPoints} as="span" name="events.trainings.t2_link">
                    ACLU Know Your Rights Guide
                  </DataPoint>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
            </div>
          </CopyRegion>
        </div>

        {/* Nonviolence Banner */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border flex items-start gap-4">
          <AlertCircle className="text-accent dark:text-accent-gold shrink-0 mt-1" size={24} />
          <div className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed">
            <DataPoint
              initialData={dataPoints}
              as="strong"
              name="events.nonviolence.title"
              className="text-foreground dark:text-white block mb-1"
            >
              Our Nonviolent Commitment:
            </DataPoint>
            <DataPoint initialData={dataPoints} as="span" name="events.nonviolence.desc">
              All Indivisible Fair Oaks-Carmichael events are strictly nonviolent. We expect all
              attendees to act lawfully and de-escalate any potential confrontation with
              counter-protesters. No weapons are permitted at any event.
            </DataPoint>
          </div>
        </div>
      </div>
    </div>
  );
}
