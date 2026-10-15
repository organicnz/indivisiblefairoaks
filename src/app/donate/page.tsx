import { Heart, Megaphone, Music, Shield, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { ActBlueDonationCalculator } from '@/components/ui/ActBlueDonationCalculator';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
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
    <div className="w-full bg-background text-foreground dark:bg-secondary dark:text-white min-h-screen pt-(--header-clearance) pb-20">
      {/* Header Banner with VGPU Constellation Network */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border-b border-white/10 py-16">
        <VgpuCivicConstellation />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pointer-events-auto">
          <div
            data-data-point="donate.hero.eyebrow"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-gold/10 border border-accent-gold/30 text-accent-gold text-xs font-bold uppercase tracking-wider mb-4"
          >
            <Heart size={14} className="fill-accent-gold text-accent-gold" />
            <span>{dataPoints['donate.hero.eyebrow'] || '100% Grassroots Funded'}</span>
          </div>
          <h1
            data-data-point="donate.hero.title"
            className="text-4xl sm:text-5xl font-black tracking-tight mb-4 text-white"
          >
            {dataPoints['donate.hero.title'] || 'Fuel The Fair Oaks - Carmichael Resistance'}
          </h1>
          <p
            data-data-point="donate.hero.intro"
            className="text-lg text-ink-on-dark max-w-2xl mx-auto leading-relaxed"
          >
            {dataPoints['donate.hero.intro'] ||
              "We don't take corporate PAC money. Our work is powered entirely by neighbors like you who pitch in to defend democracy right here in Sacramento County."}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* 10x Pro Interactive ActBlue Donation Calculator */}
        <ActBlueDonationCalculator />

        {/* How Your Contribution Is Put To Work */}
        <div className="space-y-6">
          <h2
            data-data-point="donate.impact.headline"
            className="text-2xl font-black text-foreground dark:text-white tracking-tight"
          >
            {dataPoints['donate.impact.headline'] || 'Where Your Donation Goes'}
          </h2>

          <CopyRegion id="donate-impact">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary-ink dark:bg-primary-bright/20 dark:text-primary-on-dark-muted flex items-center justify-center">
                  <Users size={20} />
                </div>
                <h3
                  data-data-point="donate.impact.spaces_title"
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  {dataPoints['donate.impact.spaces_title'] || 'Community Meeting Spaces'}
                </h3>
                <p
                  data-data-point="donate.impact.spaces_desc"
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  {dataPoints['donate.impact.spaces_desc'] ||
                    "Rent for our monthly meeting spaces (such as St. Michael's Church hall) to provide safe, welcoming gathering venues for residents and guest speakers."}
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent dark:bg-accent-gold/20 dark:text-accent-gold flex items-center justify-center">
                  <Music size={20} />
                </div>
                <h3
                  data-data-point="donate.impact.choir_title"
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  {dataPoints['donate.impact.choir_title'] || 'Resistance Choir Sound Gear'}
                </h3>
                <p
                  data-data-point="donate.impact.choir_desc"
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  {dataPoints['donate.impact.choir_desc'] ||
                    'Battery-powered amplifiers, portable microphones, sheet music printing, and acoustic gear to carry our voices across busy intersections.'}
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center">
                  <Megaphone size={20} />
                </div>
                <h3
                  data-data-point="donate.impact.banners_title"
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  {dataPoints['donate.impact.banners_title'] || 'Protest Banners & Supplies'}
                </h3>
                <p
                  data-data-point="donate.impact.banners_desc"
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  {dataPoints['donate.impact.banners_desc'] ||
                    'Weatherproof protest signs, high-visibility banners for street demonstrations, art supplies for youth rallies, and flyers.'}
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <h3
                  data-data-point="donate.impact.voter_title"
                  className="text-lg font-bold text-foreground dark:text-white"
                >
                  {dataPoints['donate.impact.voter_title'] || 'Voter Outreach & Registration'}
                </h3>
                <p
                  data-data-point="donate.impact.voter_desc"
                  className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                >
                  {dataPoints['donate.impact.voter_desc'] ||
                    'Printed guides for youth pre-registration, rights restoration flyers for formerly incarcerated community members, and postcard stamps.'}
                </p>
              </div>
            </div>
          </CopyRegion>
        </div>

        {/* Legal Disclaimer */}
        <div className="p-6 rounded-2xl bg-surface-muted border border-border dark:bg-secondary/50 dark:border-white/10 text-xs text-muted-foreground dark:text-ink-muted-on-dark space-y-2">
          <p className="font-bold text-muted-foreground dark:text-ink-on-dark">
            Contribution Disclaimers:
          </p>
          <p>
            Contributions or gifts to Indivisible Fair Oaks-Carmichael via ActBlue are not
            tax-deductible as charitable contributions for federal income tax purposes. All funds
            are dedicated to grassroots organizing, rally equipment, voter turnout drives, and
            community meeting venue rentals.
          </p>
        </div>
      </div>
    </div>
  );
}
