import { ArrowRight, Heart, Music, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { HeroPhotoFrame } from '@/components/home/HeroPhotoFrame';
import { DataPoint } from '@/components/ui/DataPoint';
import type { GalleryPhotoView } from '@/types/gallery';

export function HomeHero({
  photos,
  dataPoints,
}: {
  photos: GalleryPhotoView[];
  dataPoints: Record<string, string>;
}) {
  return (
    <section className="relative w-full overflow-hidden bg-background pt-(--header-clearance) text-foreground">
      <div
        aria-hidden="true"
        className="paper-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent_92%)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 md:pb-20 md:pt-14 lg:px-8">
        <div className="grid grid-cols-1 items-end gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left — copy & CTAs. Wrapped in a copy region so the chapter can
              rewrite the headline, mission paragraph and metrics from the visual
              editor; the JSX below is the fallback until they do. */}
          <div className="min-w-0 lg:col-span-7">
            <div>
              <div className="flex items-center justify-between gap-4 border-b border-foreground/20 pb-4">
                <div className="civic-kicker">
                  <Sparkles size={13} aria-hidden="true" />
                  <DataPoint name="home.hero.eyebrow" initialData={dataPoints}>
                    Sacramento County Grassroots Action
                  </DataPoint>
                </div>
                <DataPoint
                  as="span"
                  name="home.hero.location_stamp"
                  initialData={dataPoints}
                  className="civic-stamp hidden sm:inline-flex"
                >
                  Fair Oaks · Carmichael, CA
                </DataPoint>
              </div>

              <CopyRegion id="home-hero">
                <div>
                  <DataPoint
                    name="home.hero.headline"
                    as="h1"
                    initialData={dataPoints}
                    className="mt-7 max-w-[13ch] font-display text-[clamp(3.2rem,7vw,6.4rem)] font-semibold leading-[0.9] tracking-[-0.055em] text-foreground"
                  >
                    Democracy is not a spectator sport.
                  </DataPoint>

                  <div className="mt-8 max-w-xl border-l-2 border-accent pl-4 sm:pl-5">
                    <DataPoint
                      name="home.hero.mission"
                      as="p"
                      initialData={dataPoints}
                      className="civic-hero-lede"
                    >
                      The mission of the Fair Oaks-Carmichael chapter of Indivisible is to
                      cultivate a non-violent grassroots movement to stop the rise of
                      authoritarianism, to support and defend democratic norms, elect bold leaders,
                      and secure progressive policies.
                    </DataPoint>
                  </div>
                </div>
              </CopyRegion>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  href="/events"
                  className="inline-flex h-12 items-center gap-2 rounded-sm border border-primary bg-primary px-5 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors duration-300 hover:border-primary-dark hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <DataPoint as="span" name="home.hero.btn_actions" initialData={dataPoints}>
                    Upcoming Actions
                  </DataPoint>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <Link
                  href="/donate"
                  className="inline-flex h-12 items-center gap-2 rounded-sm border border-accent-gold bg-accent-gold px-5 text-xs font-bold uppercase tracking-[0.14em] text-ink-strong transition-all duration-300 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Heart size={15} className="fill-current" aria-hidden="true" />
                  <DataPoint as="span" name="home.hero.btn_support" initialData={dataPoints}>
                    Support Our Chapter
                  </DataPoint>
                </Link>
                <Link
                  href="/choir"
                  className="inline-flex h-12 items-center gap-2 border-b border-foreground/30 text-xs font-bold uppercase tracking-[0.14em] text-foreground transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Music size={15} aria-hidden="true" />
                  <DataPoint as="span" name="home.hero.btn_choir" initialData={dataPoints}>
                    Resistance Choir
                  </DataPoint>
                </Link>
              </div>

              {/* Impact figures as a printed rule band, not four floating cards. */}
              <div className="mt-12 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
                <div className="min-w-0 bg-background p-3 sm:p-4">
                  <DataPoint
                    name="home.impact.neighbors"
                    as="div"
                    initialData={dataPoints}
                    className="font-display text-3xl font-semibold leading-none tracking-[-0.03em] text-foreground"
                  >
                    500+
                  </DataPoint>
                  <DataPoint
                    name="home.impact.neighbors_label"
                    as="div"
                    initialData={dataPoints}
                    className="mt-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Active Neighbors
                  </DataPoint>
                </div>
                <div className="min-w-0 bg-background p-3 sm:p-4">
                  <DataPoint
                    name="home.impact.postcards"
                    as="div"
                    initialData={dataPoints}
                    className="font-display text-3xl font-semibold leading-none tracking-[-0.03em] text-foreground"
                  >
                    4,200+
                  </DataPoint>
                  <DataPoint
                    name="home.impact.postcards_label"
                    as="div"
                    initialData={dataPoints}
                    className="mt-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Postcards Written
                  </DataPoint>
                </div>
                <div className="min-w-0 bg-background p-3 sm:p-4">
                  <DataPoint
                    name="home.impact.funding"
                    as="div"
                    initialData={dataPoints}
                    className="font-display text-3xl font-semibold leading-none tracking-[-0.03em] text-foreground"
                  >
                    100%
                  </DataPoint>
                  <DataPoint
                    name="home.impact.funding_label"
                    as="div"
                    initialData={dataPoints}
                    className="mt-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Grassroots Funded
                  </DataPoint>
                </div>
                <div className="min-w-0 bg-background p-3 sm:p-4">
                  <DataPoint
                    name="home.impact.districts"
                    as="div"
                    initialData={dataPoints}
                    className="whitespace-nowrap font-display text-[clamp(1.1rem,1.9vw,1.55rem)] font-semibold leading-none tracking-[-0.03em] text-foreground"
                  >
                    CA-03 / 06
                  </DataPoint>
                  <DataPoint
                    name="home.impact.districts_label"
                    as="div"
                    initialData={dataPoints}
                    className="mt-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Sacramento Region
                  </DataPoint>
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-5">
            <HeroPhotoFrame photos={photos} initialData={dataPoints} />
          </div>
        </div>
      </div>
    </section>
  );
}
