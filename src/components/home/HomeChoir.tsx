import { ArrowRight, CheckCircle2, Music } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { LiteYouTube } from '@/components/ui/LiteYouTube';

export function HomeChoir({ dataPoints }: { dataPoints: Record<string, string> }) {
  return (
    <section className="civic-section bg-surface-muted text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
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
              className="font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-foreground sm:text-5xl"
            >
              Every good protest movement needs music.
            </DataPoint>
            <DataPoint
              name="home.choir.intro"
              as="p"
              initialData={dataPoints}
              className="text-base sm:text-lg text-muted-foreground dark:text-ink-on-dark leading-relaxed"
            >
              Music lifts us up and has sustained justice movements throughout history. We gather
              to weave our voices together in chants and songs of resistance, building vibrant
              community while marching forward.
            </DataPoint>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="flex items-start gap-3 border-t border-foreground/25 pt-4">
                <CheckCircle2 className="mt-0.5 shrink-0 text-primary-ink" size={18} />
                <div>
                  <DataPoint
                    name="home.choir.all_voices"
                    as="span"
                    initialData={dataPoints}
                    className="font-bold text-foreground dark:text-white text-sm block"
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
                <CheckCircle2 className="mt-0.5 shrink-0 text-primary-ink" size={18} />
                <div>
                  <DataPoint
                    name="home.choir.rehearsal"
                    as="span"
                    initialData={dataPoints}
                    className="font-bold text-foreground dark:text-white text-sm block"
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
            <div className="flex items-center gap-4 pt-2">
              <Link
                href="/choir"
                className="inline-flex min-h-11 items-center gap-2 border border-primary bg-primary px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:border-primary-dark hover:bg-primary-dark"
              >
                <span>Choir Details & Video</span>
                <ArrowRight size={14} />
              </Link>
              <a
                href="https://www.mobilize.us/indivisible/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 border border-foreground/30 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink"
              >
                Register via Mobilize
              </a>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="border border-foreground/25 bg-surface-card p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="civic-meta text-primary-ink">
                  Protest In Song
                </span>
                <span className="text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
                  Fair Oaks Blvd & Manzanita Ave
                </span>
              </div>
              <LiteYouTube
                videoId="BhdjDlRUMUw"
                title="Carmichael Resistance Choir singing demonstration"
                poster="/images/gallery/carmichael-resistance-choir.jpg"
                className="mb-4"
              />
              <p className="text-xs text-muted-foreground dark:text-ink-muted-on-dark italic mb-6">
                &ldquo;
                <DataPoint name="home.choir.quote" initialData={dataPoints}>
                  We will sing our protest to the afternoon rush hour and community businesses.
                  Bring your signs, chairs, and voices!
                </DataPoint>
                &rdquo;
              </p>

              {/* Issue #148: the Resistance Radio box (ChoirAudioPlayer) was
                  removed with the choir page's instance — same component, same
                  complaint. One line restores it if the chapter wants it here. */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
