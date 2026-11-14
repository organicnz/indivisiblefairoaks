import { Heart, Megaphone, Music, Shield, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { CopyRegion } from '@/components/cms/CopyRegion';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { ActBlueDonationCalculator } from '@/components/ui/ActBlueDonationCalculator';
import { DataPoint } from '@/components/ui/DataPoint';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'Donate & Support',
  description:
    'Support Indivisible Fair Oaks-Carmichael via ActBlue. Every grassroots contribution powers our local organizing, choir rallies, and voter turnout campaigns.',
  path: '/donate',
});

export default async function DonatePage() {
  const dataPoints = await getDataPoints('donate');

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        icon={Heart}
        eyebrow={
          <DataPoint name="donate.hero.eyebrow" initialData={dataPoints}>
            100% Grassroots Funded
          </DataPoint>
        }
        title={
          <DataPoint
            name="donate.hero.title"
            as="h1"
            initialData={dataPoints}
            className={MASTHEAD_TITLE}
          >
            Fuel The Fair Oaks - Carmichael Resistance
          </DataPoint>
        }
        intro={
          <DataPoint
            name="donate.hero.intro"
            as="p"
            initialData={dataPoints}
            className={MASTHEAD_INTRO}
          >
            We don't take corporate PAC money. Our work is powered entirely by neighbors like you
            who pitch in to defend democracy right here in Sacramento County.
          </DataPoint>
        }
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* 10x Pro Interactive ActBlue Donation Calculator */}
        <ActBlueDonationCalculator initialData={dataPoints} />

        {/* How Your Contribution Is Put To Work */}
        <div className="space-y-6">
          <DataPoint
            name="donate.impact.headline"
            as="h2"
            initialData={dataPoints}
            className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
          >
            Where Your Donation Goes
          </DataPoint>

          <CopyRegion id="donate-impact">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 border-t border-foreground/25 pt-6">
                <div className="flex size-10 items-center justify-center border border-border bg-background text-primary-ink">
                  <Users size={20} />
                </div>
                <DataPoint
                  name="donate.impact.spaces_title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  Community Meeting Spaces
                </DataPoint>
                <DataPoint
                  name="donate.impact.spaces_desc"
                  as="p"
                  initialData={dataPoints}
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  Rent for our monthly meeting spaces (such as St. Michael's Church hall) to provide
                  safe, welcoming gathering venues for residents and guest speakers.
                </DataPoint>
              </div>

              <div className="space-y-3 border-t border-foreground/25 pt-6">
                <div className="flex size-10 items-center justify-center border border-border bg-background text-accent">
                  <Music size={20} />
                </div>
                <DataPoint
                  name="donate.impact.choir_title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  Resistance Choir Sound Gear
                </DataPoint>
                <DataPoint
                  name="donate.impact.choir_desc"
                  as="p"
                  initialData={dataPoints}
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  Battery-powered amplifiers, portable microphones, sheet music printing, and
                  acoustic gear to carry our voices across busy intersections.
                </DataPoint>
              </div>

              <div className="space-y-3 border-t border-foreground/25 pt-6">
                <div className="flex size-10 items-center justify-center border border-border bg-background text-accent">
                  <Megaphone size={20} />
                </div>
                <DataPoint
                  name="donate.impact.banners_title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  Protest Banners & Supplies
                </DataPoint>
                <DataPoint
                  name="donate.impact.banners_desc"
                  as="p"
                  initialData={dataPoints}
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  Weatherproof protest signs, high-visibility banners for street demonstrations, art
                  supplies for youth rallies, and flyers.
                </DataPoint>
              </div>

              <div className="space-y-3 border-t border-foreground/25 pt-6">
                <div className="flex size-10 items-center justify-center border border-border bg-background text-primary-ink">
                  <Shield size={20} />
                </div>
                <DataPoint
                  name="donate.impact.voter_title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  Voter Outreach & Registration
                </DataPoint>
                <DataPoint
                  name="donate.impact.voter_desc"
                  as="p"
                  initialData={dataPoints}
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  Printed guides for youth pre-registration, rights restoration flyers for formerly
                  incarcerated community members, and postcard stamps.
                </DataPoint>
              </div>
            </div>
          </CopyRegion>
        </div>

        {/* Legal Disclaimer */}
        <div className="space-y-2 border-y border-border py-6 text-xs text-muted-foreground">
          <DataPoint
            name="donate.disclaimer.title"
            as="p"
            initialData={dataPoints}
            className="font-bold text-muted-foreground dark:text-ink-on-dark"
          >
            Contribution Disclaimers:
          </DataPoint>
          <DataPoint name="donate.disclaimer.desc" as="p" initialData={dataPoints}>
            Contributions or gifts to Indivisible Fair Oaks-Carmichael via ActBlue are not
            tax-deductible as charitable contributions for federal income tax purposes. All funds
            are dedicated to grassroots organizing, rally equipment, voter turnout drives, and
            community meeting venue rentals.
          </DataPoint>
        </div>
      </div>
    </div>
  );
}
