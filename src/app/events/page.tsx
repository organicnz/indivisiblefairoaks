import { AlertCircle, Archive, ArrowUpRight, Calendar, ExternalLink, Music, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegacyDocumentArchive } from '@/components/archive/LegacyDocumentArchive';
import { CopyRegion } from '@/components/cms/CopyRegion';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';
import { InteractiveEventsCalendar } from '@/components/ui/InteractiveEventsCalendar';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints, getEvents } from '@/lib/queries/civic';
import { getLegacyDocuments } from '@/lib/queries/legacy';

export const metadata: Metadata = pageMetadata({
  title: 'Events & Actions',
  description:
    'Join our upcoming chapter meetings, singing protests with the Carmichael Resistance Choir, weekly rallies, and voter mobilization events in Sacramento County.',
  path: '/events',
});

export default async function EventsPage() {
  const [initialEventsRows, dataPoints, legacyEventDocuments] = await Promise.all([
    getEvents().catch(() => []),
    getDataPoints('events'),
    getLegacyDocuments('event'),
  ]);
  const initialEvents = initialEventsRows.length > 0 ? initialEventsRows : undefined;
  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        icon={Calendar}
        eyebrow={
          <DataPoint initialData={dataPoints} name="events.hero.eyebrow">
            Community Actions & Calendar
          </DataPoint>
        }
        title={
          <DataPoint
            initialData={dataPoints}
            name="events.hero.headline"
            as="h1"
            className={MASTHEAD_TITLE}
          >
            Upcoming Events & Mobilizations
          </DataPoint>
        }
        intro={
          <DataPoint
            initialData={dataPoints}
            name="events.hero.intro"
            as="p"
            className={MASTHEAD_INTRO}
          >
            Find out when and where our chapter is gathering. All community members committed to
            peaceful, democratic activism are warmly welcome.
          </DataPoint>
        }
      />

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-16 sm:px-6 lg:px-8">
        <section aria-labelledby="upcoming-events">
          <div className="civic-section-head">
            <div>
              <span className="civic-section-index">01 / Calendar</span>
              <h2 id="upcoming-events" className="civic-section-title">
                Upcoming events
              </h2>
            </div>
            <p className="civic-lede">
              Meetings, street actions, choir rehearsals and trainings. Filter by the kind of work
              you want to do, then RSVP with the organizer.
            </p>
          </div>
          <InteractiveEventsCalendar initialEvents={initialEvents} initialData={dataPoints} />
        </section>

        {/* Ongoing Street Corner Singing Protest Spotlight (Issue #87) */}
        <div className="flex flex-col items-start justify-between gap-6 border-y border-border bg-surface-card p-6 sm:p-8 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-card flex items-center justify-center text-accent dark:text-accent-gold shrink-0 mt-1 border border-border dark:border-white/10 shadow-xs">
              <Music size={24} />
            </div>
            <div>
              <div className="civic-stamp mb-2">
                <DataPoint initialData={dataPoints} as="span" name="events.spotlight.eyebrow">
                  Ongoing Community Action
                </DataPoint>
              </div>
              <DataPoint
                initialData={dataPoints}
                as="h2"
                name="events.spotlight.title"
                className="font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl"
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
              className="inline-flex min-h-11 w-full items-center justify-center border border-foreground/30 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink sm:w-auto"
            >
              <DataPoint initialData={dataPoints} as="span" name="events.spotlight.btn_songbook">
                Explore Songbook
              </DataPoint>
            </Link>
            <a
              href="https://www.mobilize.us/indivisible/event/1011420/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center border border-primary bg-primary px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark sm:w-auto"
            >
              <DataPoint initialData={dataPoints} as="span" name="events.spotlight.btn_protest">
                Join Next Protest
              </DataPoint>
            </a>
          </div>
        </div>

        {/* Trainings & Campaign Initiatives — copy region */}
        <div className="space-y-6 pt-6 border-t border-border dark:border-white/10">
          <h2 className="flex items-center gap-2 font-display text-3xl font-semibold tracking-[-0.03em]">
            <Users className="text-primary-ink dark:text-primary-on-dark-muted" />
            <DataPoint initialData={dataPoints} as="span" name="events.trainings.title">
              Trainings &amp; Action Labs
            </DataPoint>
          </h2>

          <CopyRegion id="events-trainings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 border-t border-foreground/25 pt-6">
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

              <div className="space-y-3 border-t border-foreground/25 pt-6">
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

        {/* Past events and legacy materials */}
        <div className="flex flex-col items-start justify-between gap-5 border-y border-border bg-surface-card p-6 sm:p-8 md:flex-row md:items-center">
          <div>
            <div className="civic-stamp">
              <Archive size={12} />
              Past events
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em]">
              Looking for an event that has already happened?
            </h2>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
              Flyers, event pages, and the complete public record from the chapter’s earlier Google
              Sites are preserved in the archive.
            </p>
          </div>
          <Link
            href="/archive"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
          >
            Browse the archive
            <ArrowUpRight size={14} />
          </Link>
        </div>

        {legacyEventDocuments.length > 0 ? (
          <div className="pt-2 border-t border-border">
            <LegacyDocumentArchive
              documents={legacyEventDocuments}
              title="Event flyers & documents"
              description="Event material preserved from the old site. Files cleared for republication are hosted here; other items point to their original source."
              limit={6}
            />
          </div>
        ) : null}

        {/* Nonviolence Banner */}
        <div className="flex items-start gap-4 border-y border-border bg-surface-card p-6">
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
