import {
  ArrowUpRight,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Music,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegacyDocumentArchive } from '@/components/archive/LegacyDocumentArchive';
import { CopyRegion } from '@/components/cms/CopyRegion';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { ChoirSongbookExplorer } from '@/components/ui/ChoirSongbookExplorer';
import { DataPoint } from '@/components/ui/DataPoint';
import { LiteYouTube } from '@/components/ui/LiteYouTube';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';
import { getLegacyDocuments } from '@/lib/queries/legacy';

export const metadata: Metadata = pageMetadata({
  title: 'Carmichael Resistance Choir',
  description:
    'Sing with the Carmichael Resistance Choir! Music sustains our democracy movement. Rehearsals every other Wednesday evening. All voices welcome, no audition required.',
  path: '/choir',
});

export default async function ChoirPage() {
  const [dataPoints, legacyDocuments] = await Promise.all([
    getDataPoints('choir'),
    getLegacyDocuments('choir'),
  ]);

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        icon={Music}
        eyebrow={
          <DataPoint name="choir.hero.eyebrow" initialData={dataPoints}>
            Harmonizing For Justice
          </DataPoint>
        }
        title={
          <DataPoint
            name="choir.hero.title"
            as="h1"
            initialData={dataPoints}
            className={MASTHEAD_TITLE}
          >
            The Carmichael Resistance Choir
          </DataPoint>
        }
        intro={
          <p className={`${MASTHEAD_INTRO} italic`}>
            &ldquo;
            <DataPoint name="choir.hero.quote" initialData={dataPoints}>
              Every good protest movement needs music. Music lifts us up, keeps us motivated, and
              sustains us through the long haul.
            </DataPoint>
            &rdquo;
          </p>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* About the Choir */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <DataPoint
              name="choir.about.title"
              as="h2"
              initialData={dataPoints}
              className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl"
            >
              Lifting Our Voices in Solidarity
            </DataPoint>
            <div className="text-muted-foreground dark:text-ink-on-dark space-y-4 text-sm sm:text-base leading-relaxed">
              <DataPoint name="choir.about.p1" as="p" initialData={dataPoints}>
                The Carmichael Resistance Choir brings people together through the power of
                collective song. Rooted in the rich tradition of American civil rights, labor, and
                anti-war movements, our choir provides a joyful, defiant, and creative outlet for
                community resistance.
              </DataPoint>
              <DataPoint name="choir.about.p2" as="p" initialData={dataPoints}>
                We perform at rallies, street corner singing protests (such as the intersection of
                Fair Oaks Blvd & Manzanita Ave), marches, and community meetings throughout the
                greater Sacramento region.
              </DataPoint>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-start gap-3 border-t border-foreground/25 pt-4">
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-primary-ink"
                  size={18}
                />
                <div>
                  <DataPoint
                    name="choir.about.no_audition_title"
                    as="span"
                    initialData={dataPoints}
                    className="font-bold text-foreground dark:text-white text-sm block"
                  >
                    No Auditions
                  </DataPoint>
                  <DataPoint
                    name="choir.about.no_audition_desc"
                    as="span"
                    initialData={dataPoints}
                    className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
                  >
                    All skill levels and vocal ranges welcome.
                  </DataPoint>
                </div>
              </div>
              <div className="flex items-start gap-3 border-t border-foreground/25 pt-4">
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-primary-ink"
                  size={18}
                />
                <div>
                  <DataPoint
                    name="choir.about.free_title"
                    as="span"
                    initialData={dataPoints}
                    className="font-bold text-foreground dark:text-white text-sm block"
                  >
                    100% Free
                  </DataPoint>
                  <DataPoint
                    name="choir.about.free_desc"
                    as="span"
                    initialData={dataPoints}
                    className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
                  >
                    No membership dues or fees ever required.
                  </DataPoint>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="space-y-6 border-y border-border bg-surface-card p-6">
              <div className="flex items-center gap-3">
                <Calendar className="text-accent dark:text-accent-gold" size={24} />
                <DataPoint
                  name="choir.schedule.headline"
                  as="h3"
                  initialData={dataPoints}
                  className="text-xl font-bold text-foreground dark:text-white"
                >
                  Rehearsal Schedule & Guidelines
                </DataPoint>
              </div>

              <div className="space-y-4 text-sm text-muted-foreground dark:text-ink-on-dark">
                <CopyRegion id="choir-schedule">
                  <div className="flex items-start gap-3">
                    <Clock
                      className="text-primary-ink dark:text-primary-on-dark-muted shrink-0 mt-0.5"
                      size={18}
                    />
                    <div>
                      <DataPoint
                        name="choir.schedule.time"
                        as="strong"
                        initialData={dataPoints}
                        className="text-foreground dark:text-white block"
                      >
                        Every Other Wednesday
                      </DataPoint>
                      <DataPoint
                        name="choir.schedule.time_sub"
                        as="span"
                        initialData={dataPoints}
                        className="text-xs text-muted-foreground dark:text-ink-muted-on-dark block"
                      >
                        6:30 PM – 8:00 PM
                      </DataPoint>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin
                      className="text-primary-ink dark:text-primary-on-dark-muted shrink-0 mt-0.5"
                      size={18}
                    />
                    <div>
                      <DataPoint
                        name="choir.schedule.location"
                        as="strong"
                        initialData={dataPoints}
                        className="text-foreground dark:text-white block"
                      >
                        St. Michael's Episcopal Church
                      </DataPoint>
                      <DataPoint
                        name="choir.schedule.location_sub"
                        as="span"
                        initialData={dataPoints}
                        className="text-xs text-muted-foreground dark:text-ink-muted-on-dark block"
                      >
                        Exact address and parking instructions provided upon registration.
                      </DataPoint>
                    </div>
                  </div>
                </CopyRegion>
              </div>

              <div className="pt-2">
                <a
                  href="https://www.mobilize.us/indivisible/event/1072857/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 w-full items-center justify-center gap-2 border border-accent-gold bg-accent-gold py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-strong transition-colors hover:brightness-95"
                >
                  <span>Register for Next Rehearsal</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Video Demonstrations */}
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto">
            <DataPoint
              name="choir.videos.eyebrow"
              as="span"
              initialData={dataPoints}
              className="civic-kicker mb-2"
            >
              Watch Us In Action
            </DataPoint>
            <DataPoint
              name="choir.videos.title"
              as="h2"
              initialData={dataPoints}
              className="font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-5xl"
            >
              Singing Out On The Streets
            </DataPoint>
            <DataPoint
              name="choir.videos.desc"
              as="p"
              initialData={dataPoints}
              className="text-xs sm:text-sm text-muted-foreground dark:text-ink-muted-on-dark mt-2"
            >
              Demonstrations at Fair Oaks Blvd & Manzanita Ave in Carmichael, CA.
            </DataPoint>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3 border-y border-border bg-surface-card p-4">
              <LiteYouTube
                videoId="BhdjDlRUMUw"
                title="Carmichael Resistance Choir Singing Demonstration 1"
                poster="/images/gallery/carmichael-resistance-choir.jpg"
              />
              <DataPoint
                name="choir.videos.v1_title"
                as="h3"
                initialData={dataPoints}
                className="font-bold text-foreground dark:text-white text-sm"
              >
                Rush Hour Singing Demonstration
              </DataPoint>
              <DataPoint
                name="choir.videos.v1_desc"
                as="p"
                initialData={dataPoints}
                className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
              >
                Carrying songs of peace, civil rights, and democratic defense to community drivers.
              </DataPoint>
            </div>

            <div className="space-y-3 border-y border-border bg-surface-card p-4">
              <div className="aspect-video overflow-hidden bg-surface-deep">
                {/* The original video (M631H68kLCE) was removed from YouTube. */}
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <Music size={28} className="text-accent-gold" aria-hidden="true" />
                  <p className="text-sm font-bold text-foreground dark:text-white">
                    Video no longer available
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-ink-on-dark">
                    The original recording was removed from YouTube. Watch the choir’s latest
                    performances on Instagram.
                  </p>
                  <a
                    href="https://instagram.com/CarmichaelResistanceChoir"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:border-primary/40 hover:text-primary-ink dark:border-white/15 dark:bg-white/5 dark:text-ink-on-dark dark:hover:text-accent-gold"
                  >
                    Watch on Instagram
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>
              </div>
              <DataPoint
                name="choir.videos.v2_title"
                as="h3"
                initialData={dataPoints}
                className="font-bold text-foreground dark:text-white text-sm"
              >
                Community Voices in Harmony
              </DataPoint>
              <DataPoint
                name="choir.videos.v2_desc"
                as="p"
                initialData={dataPoints}
                className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
              >
                Rehearsing chants and classic civil rights hymns for upcoming demonstrations.
              </DataPoint>
            </div>
          </div>
        </div>

        {/* Historical choir material from the old Google Sites. */}
        <div className="space-y-5 border-y border-border bg-surface-card p-6 sm:p-8">
          <div>
            <div className="civic-stamp">
              <Music size={12} />
              From the Choir Archive
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em]">
              The story, the film, and where we sing next
            </h2>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
              The old chapter site introduced the choir through a feature article, a short film, and
              the Instagram and Mobilize.us links we still use. Those records are preserved here.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a
              href="https://impact.scholasticahq.com/article/166557-breathing-together-on-joining-a-resistance-choir"
              target="_blank"
              rel="noopener noreferrer"
              className="group border-t border-foreground/25 pt-4 transition-colors hover:border-primary/60"
            >
              <span className="civic-meta">
                Feature article
              </span>
              <span className="mt-2 block text-sm font-bold leading-snug text-foreground dark:text-white group-hover:text-primary-ink dark:group-hover:text-accent-gold">
                “Breathing Together: On Joining a Resistance Choir”
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-primary-ink dark:text-primary-on-dark">
                Read the story <ArrowUpRight size={12} />
              </span>
            </a>
            <a
              href="https://instagram.com/CarmichaelResistanceChoir"
              target="_blank"
              rel="noopener noreferrer"
              className="group border-t border-foreground/25 pt-4 transition-colors hover:border-primary/60"
            >
              <span className="civic-meta">
                Instagram
              </span>
              <span className="mt-2 flex items-center gap-2 text-sm font-bold leading-snug text-foreground dark:text-white group-hover:text-primary-ink dark:group-hover:text-accent-gold">
                <Camera size={16} className="text-accent-gold" />
                @CarmichaelResistanceChoir
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-primary-ink dark:text-primary-on-dark">
                Visit the choir <ExternalLink size={12} />
              </span>
            </a>
            <a
              href="https://www.mobilize.us/indivisible/event/1072857/"
              target="_blank"
              rel="noopener noreferrer"
              className="group border-t border-foreground/25 pt-4 transition-colors hover:border-primary/60"
            >
              <span className="civic-meta">
                Next rehearsal
              </span>
              <span className="mt-2 block text-sm font-bold leading-snug text-foreground dark:text-white group-hover:text-primary-ink dark:group-hover:text-accent-gold">
                Register through Mobilize.us
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-primary-ink dark:text-primary-on-dark">
                Sign up <ExternalLink size={12} />
              </span>
            </a>
          </div>
          {legacyDocuments.length > 0 ? (
            <div className="border-t border-border pt-5">
              <LegacyDocumentArchive
                documents={legacyDocuments}
                title="Choir film & documents"
                description="The original choir film and related files. Restricted or third-party media remains at its source; cleared files are hosted here."
                limit={4}
              />
            </div>
          ) : null}
        </div>

        {/* Issue #148: the Resistance Radio box (ChoirAudioPlayer) was removed
            at the chapter's request — the anthem it opened on was the complaint.
            The component is still in `components/ui/` if the radio returns. */}

        {/* 10x Pro Interactive Songbook Explorer */}
        <ChoirSongbookExplorer initialData={dataPoints} />

        {/* Join CTA */}
        <div className="space-y-4 border-y border-border bg-surface-card p-8 text-center">
          <DataPoint
            name="choir.join.title"
            as="h3"
            initialData={dataPoints}
            className="font-display text-3xl font-semibold tracking-[-0.03em]"
          >
            Ready to Sing With Us?
          </DataPoint>
          <DataPoint
            name="choir.join.desc"
            as="p"
            initialData={dataPoints}
            className="text-muted-foreground dark:text-ink-on-dark text-sm max-w-lg mx-auto"
          >
            You don&apos;t need to be a trained musician. If you have a heart for justice and a
            voice to lend, you belong in our choir.
          </DataPoint>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <a
              href="mailto:contact@indivisiblefairoaks.org?subject=Joining%20the%20Resistance%20Choir"
              className="inline-flex min-h-11 items-center gap-2 border border-accent-gold bg-accent-gold px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-strong transition-colors hover:brightness-95"
            >
              <Mail size={16} />
              <span>Email Choir Director</span>
            </a>
            <Link
              href="/events"
              className="inline-flex min-h-11 items-center gap-2 border border-foreground/30 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink"
            >
              View Calendar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
