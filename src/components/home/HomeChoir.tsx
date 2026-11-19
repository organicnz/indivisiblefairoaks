import { ArrowRight, CheckCircle2, MapPin, Music } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { LiteYouTube } from '@/components/ui/LiteYouTube';

const WAVEFORM = [4, 8, 5, 11, 6, 9, 3];

export function HomeChoir({ dataPoints }: { dataPoints: Record<string, string> }) {
  return (
    <section className="civic-section relative overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="paper-grid pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-40 [mask-image:linear-gradient(to_left,black,transparent)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-7">
            <div className="civic-kicker">
              <Music size={13} aria-hidden="true" />
              <DataPoint name="home.choir.eyebrow" initialData={dataPoints}>
                Carmichael Resistance Choir
              </DataPoint>
            </div>
            <DataPoint
              name="home.choir.headline"
              as="h2"
              initialData={dataPoints}
              className="max-w-[15ch] font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-foreground sm:text-5xl"
            >
              Every good protest movement needs music.
            </DataPoint>
            <DataPoint
              name="home.choir.intro"
              as="p"
              initialData={dataPoints}
              className="text-pretty text-base leading-relaxed text-muted-foreground dark:text-ink-on-dark sm:text-lg"
            >
              Music lifts us up and has sustained justice movements throughout history. We gather
              to weave our voices together in chants and songs of resistance, building vibrant
              community while marching forward.
            </DataPoint>
            <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
              <div className="flex items-start gap-3 border-t border-foreground/25 pt-4">
                <CheckCircle2 className="mt-0.5 shrink-0 text-primary-ink" size={18} aria-hidden="true" />
                <div>
                  <DataPoint
                    name="home.choir.all_voices"
                    as="span"
                    initialData={dataPoints}
                    className="block text-sm font-bold text-foreground dark:text-white"
                  >
                    All Voices Welcome
                  </DataPoint>
                  <DataPoint
                    name="home.choir.all_voices_sub"
                    as="span"
                    initialData={dataPoints}
                    className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
                  >
                    No auditions, no fees. Everyone can sing.
                  </DataPoint>
                </div>
              </div>
              <div className="flex items-start gap-3 border-t border-foreground/25 pt-4">
                <CheckCircle2 className="mt-0.5 shrink-0 text-primary-ink" size={18} aria-hidden="true" />
                <div>
                  <DataPoint
                    name="home.choir.rehearsal"
                    as="span"
                    initialData={dataPoints}
                    className="block text-sm font-bold text-foreground dark:text-white"
                  >
                    Rehearsal Schedule
                  </DataPoint>
                  <DataPoint
                    name="home.choir.rehearsal_sub"
                    as="span"
                    initialData={dataPoints}
                    className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
                  >
                    Every other Wednesday, 6:30 – 8:00 PM.
                  </DataPoint>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/choir"
                className="inline-flex min-h-11 max-w-full items-center gap-2 border border-primary bg-primary px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:border-primary-dark hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span>Choir Details &amp; Video</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <a
                href="https://www.mobilize.us/indivisible/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 max-w-full items-center gap-2 border border-foreground/30 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Register via Mobilize
              </a>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-5">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute inset-0 translate-x-2.5 translate-y-2.5 border border-foreground/20 bg-surface-muted"
              />
              <div className="relative overflow-hidden border border-foreground/30 bg-secondary text-ink-on-dark">
                <div className="flex items-center justify-between gap-4 border-b border-white/15 px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="flex h-3 shrink-0 items-end gap-[2px] text-accent-gold-on-dark"
                    >
                      {WAVEFORM.map((height, index) => (
                        <span
                          key={index}
                          className="w-[2px] bg-current"
                          style={{ height: `${height}px` }}
                        />
                      ))}
                    </span>
                    <span className="truncate font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-accent-gold-on-dark">
                      Protest in Song
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted-on-dark">
                    On location
                  </span>
                </div>

                <div className="p-4 sm:p-5">
                  <LiteYouTube
                    videoId="BhdjDlRUMUw"
                    title="Carmichael Resistance Choir singing demonstration"
                    poster="/images/gallery/carmichael-resistance-choir.jpg"
                  />

                  <div className="mt-4 flex items-start gap-2 text-[11px] leading-snug text-ink-muted-on-dark">
                    <MapPin
                      size={12}
                      className="mt-0.5 shrink-0 text-accent-gold-on-dark"
                      aria-hidden="true"
                    />
                    <span>Fair Oaks Blvd &amp; Manzanita Ave</span>
                  </div>

                  <blockquote className="relative mt-5 border-t border-white/15 pt-6">
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-3 font-display text-5xl leading-none text-accent-gold-on-dark/35"
                    >
                      &ldquo;
                    </span>
                    <p className="pl-8 text-pretty font-display text-lg italic leading-relaxed text-ink-on-dark sm:text-xl">
                      <DataPoint name="home.choir.quote" initialData={dataPoints}>
                        We will sing our protest to the afternoon rush hour and community
                        businesses. Bring your signs, chairs, and voices!
                      </DataPoint>
                    </p>
                  </blockquote>
                </div>
              </div>
            </div>

            {/* Issue #148: the Resistance Radio box (ChoirAudioPlayer) was
                removed with the choir page's instance — same component, same
                complaint. One line restores it if the chapter wants it here. */}
          </div>
        </div>
      </div>
    </section>
  );
}
