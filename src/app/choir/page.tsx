import { Calendar, CheckCircle2, Clock, ExternalLink, Mail, MapPin, Music } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { ChoirSongbookExplorer } from '@/components/ui/ChoirSongbookExplorer';
import { DataPoint } from '@/components/ui/DataPoint';
import { VgpuChoirHarmonics } from '@/components/ui/VgpuChoirHarmonics';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'Carmichael Resistance Choir',
  description:
    'Sing with the Carmichael Resistance Choir! Music sustains our democracy movement. Rehearsals every other Wednesday evening. All voices welcome, no audition required.',
  path: '/choir',
});

export default async function ChoirPage() {
  const dataPoints = await getDataPoints('choir');

  return (
    <div className="w-full bg-background text-foreground min-h-screen pt-(--header-clearance) pb-20">
      {/* Header Banner with VGPU Harmonic Soundwave Atmosphere */}
      <div className="relative overflow-hidden bg-surface-muted border-b border-border dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 dark:border-white/10 py-20">
        <VgpuChoirHarmonics />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pointer-events-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary dark:bg-primary-bright/10 dark:border-primary-on-dark-muted/30 dark:text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4">
            <Music size={14} className="text-accent-gold" />
            <DataPoint name="choir.hero.eyebrow" initialData={dataPoints}>
              Harmonizing For Justice
            </DataPoint>
          </div>
          <DataPoint
            name="choir.hero.title"
            as="h1"
            initialData={dataPoints}
            className="text-4xl sm:text-5xl font-black tracking-tight mb-4 text-foreground dark:text-white"
          >
            The Carmichael Resistance Choir
          </DataPoint>
          <p className="text-lg text-muted-foreground dark:text-ink-on-dark max-w-2xl mx-auto leading-relaxed italic">
            &ldquo;
            <DataPoint name="choir.hero.quote" initialData={dataPoints}>
              Every good protest movement needs music. Music lifts us up, keeps us motivated, and
              sustains us through the long haul.
            </DataPoint>
            &rdquo;
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* About the Choir */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <DataPoint
              name="choir.about.title"
              as="h2"
              initialData={dataPoints}
              className="text-2xl sm:text-3xl font-black text-foreground dark:text-white tracking-tight"
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
              <div className="p-4 rounded-xl bg-surface-card border border-border flex items-start gap-3">
                <CheckCircle2
                  className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
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
              <div className="p-4 rounded-xl bg-surface-card border border-border flex items-start gap-3">
                <CheckCircle2
                  className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
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
            <div className="p-6 rounded-2xl bg-surface-muted border border-border dark:bg-gradient-to-tr dark:from-blue-950/60 dark:to-slate-900 dark:border-primary-bright/30 shadow-xl space-y-6">
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
                  className="w-full py-3 rounded-xl bg-accent-gold hover:brightness-105 text-ink-strong font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all"
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
              className="text-primary-ink dark:text-accent-gold text-xs font-black uppercase tracking-widest block mb-2"
            >
              Watch Us In Action
            </DataPoint>
            <DataPoint
              name="choir.videos.title"
              as="h2"
              initialData={dataPoints}
              className="text-3xl font-black text-foreground dark:text-white tracking-tight"
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
            <div className="rounded-2xl overflow-hidden bg-surface-card border border-border p-4 shadow-xl space-y-3">
              <div className="aspect-video rounded-xl overflow-hidden bg-surface-deep dark:bg-secondary">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/BhdjDlRUMUw"
                  title="Carmichael Resistance Choir Singing Demonstration 1"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
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

            <div className="rounded-2xl overflow-hidden bg-surface-card border border-border p-4 shadow-xl space-y-3">
              <div className="aspect-video rounded-xl overflow-hidden bg-surface-deep dark:bg-secondary">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/M631H68kLCE"
                  title="Carmichael Resistance Choir Singing Demonstration 2"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
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

        {/* Issue #148: the Resistance Radio box (ChoirAudioPlayer) was removed
            at the chapter's request — the anthem it opened on was the complaint.
            The component is still in `components/ui/` if the radio returns. */}

        {/* 10x Pro Interactive Songbook Explorer */}
        <ChoirSongbookExplorer />

        {/* Join CTA */}
        <div className="p-8 rounded-2xl bg-surface-card border border-border text-center space-y-4">
          <DataPoint
            name="choir.join.title"
            as="h3"
            initialData={dataPoints}
            className="text-2xl font-black text-foreground dark:text-white"
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
              className="px-6 py-3 rounded-xl bg-accent-gold hover:brightness-105 text-ink-strong font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
            >
              <Mail size={16} />
              <span>Email Choir Director</span>
            </a>
            <Link
              href="/events"
              className="px-6 py-3 rounded-xl bg-surface-muted hover:bg-primary/10 hover:text-primary dark:bg-white/5 dark:hover:bg-white/10 text-foreground dark:text-ink-on-dark border border-border dark:border-white/10 font-bold text-xs uppercase tracking-wider transition-all"
            >
              View Calendar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
