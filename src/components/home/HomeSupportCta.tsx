import { Heart, Mail } from 'lucide-react';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';

export function HomeSupportCta({ dataPoints }: { dataPoints: Record<string, string> }) {
  return (
    <section className="relative overflow-hidden border-y border-primary-dark bg-primary py-16 text-white md:py-20">
      <div
        aria-hidden="true"
        className="paper-grid pointer-events-none absolute inset-0 opacity-10"
      />
      <Heart
        aria-hidden="true"
        strokeWidth={0.45}
        className="pointer-events-none absolute -bottom-20 -right-12 hidden size-80 text-white/[0.06] md:block print:hidden"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="lg:col-span-8">
            <DataPoint
              name="home.cta.eyebrow"
              as="span"
              initialData={dataPoints}
              className="civic-kicker text-white before:bg-accent-gold"
            >
              Grassroots Power Runs On Grassroots Support
            </DataPoint>
            <DataPoint
              name="home.cta.headline"
              as="h2"
              initialData={dataPoints}
              className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[0.94] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl"
            >
              Fuel Our Local Organizing
            </DataPoint>
            <DataPoint
              name="home.cta.desc"
              as="p"
              initialData={dataPoints}
              className="mt-6 max-w-2xl text-base leading-relaxed text-white"
            >
              Every dollar contributed to our chapter directly supports community meeting spaces,
              protest banners, sound equipment for the Resistance Choir, voter registration printing,
              and neighborhood outreach.
            </DataPoint>
          </div>
          <div className="flex flex-col gap-3 border-t border-white/20 pt-6 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <Link
              href="/donate"
              className="inline-flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-sm border border-accent-gold bg-accent-gold px-6 py-3 text-center text-xs font-bold uppercase tracking-[0.14em] text-ink-strong transition-all duration-300 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              <Heart size={16} className="fill-current" aria-hidden="true" />
              <DataPoint as="span" name="home.cta.btn_donate" initialData={dataPoints}>
                Donate via ActBlue
              </DataPoint>
            </Link>
            <a
              href="mailto:subscribe@indivisiblefairoaks.org"
              className="inline-flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-sm border border-white/40 px-6 py-3 text-center text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors duration-300 hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              <Mail size={16} aria-hidden="true" />
              <DataPoint as="span" name="home.cta.btn_subscribe" initialData={dataPoints}>
                Join Mailing List
              </DataPoint>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
