'use client';

import { Check, CreditCard, ExternalLink, Heart, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';

interface ImpactTier {
  amount: number;
  label: string;
  badge: string;
  impactTitle: string;
  impactDescription: string;
  tangibleMetrics: string[];
}

const TIERS: Record<number, ImpactTier> = {
  10: {
    amount: 10,
    label: '$10',
    badge: 'Grassroots Supporter',
    impactTitle: 'Postcards & Voter Outreach',
    impactDescription:
      'Funds 20 pre-addressed voter turnout postcards and postage to neighbors in key Sacramento County districts.',
    tangibleMetrics: ['20 Voter Postcards', '10 Action Handouts', '1 Rally Songsheet'],
  },
  25: {
    amount: 25,
    label: '$25',
    badge: 'Community Builder',
    impactTitle: 'Rally Supplies & Choir Music',
    impactDescription:
      'Covers printed songbooks, lyric binders, and markers for street corner singing demonstrations with the Resistance Choir.',
    tangibleMetrics: ['50 Postage Stamps', '15 Choir Songbooks', 'Demonstration Posterboard'],
  },
  50: {
    amount: 50,
    label: '$50',
    badge: 'Action Sustainer',
    impactTitle: 'Hall Rental & Hybrid Tech',
    impactDescription:
      'Supports meeting hall rental at St. Michael’s and digital Zoom streaming equipment so homebound neighbors can participate.',
    tangibleMetrics: [
      '1 Monthly Gathering Hall',
      'Zoom Pro Hybrid Broadcast',
      'Meeting Name Badges',
    ],
  },
  100: {
    amount: 100,
    label: '$100',
    badge: 'Democracy Champion',
    impactTitle: 'Sound Gear & Rallies',
    impactDescription:
      'Funds portable PA sound amplification, replacement rechargeable batteries, and high-visibility highway overpass banners.',
    tangibleMetrics: ['Portable PA System Gear', 'High-Vis Highway Banners', 'Deep Canvass Kits'],
  },
  250: {
    amount: 250,
    label: '$250',
    badge: 'Mobilization Anchor',
    impactTitle: 'District Outreach Blitz',
    impactDescription:
      'Sponsors an entire weekend of voter contact, canvass training packets, and local community activist workshops.',
    tangibleMetrics: [
      '500 Canvass Doorhangers',
      'Full Training Workshop',
      'Community Pantry Delivery',
    ],
  },
};

export function ActBlueDonationCalculator() {
  const { dataPoints } = useDataPoints('donate');
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [isMonthly, setIsMonthly] = useState<boolean>(false);
  const [customAmount, setCustomAmount] = useState<string>('');

  const currentAmount = customAmount ? Math.max(5, Number(customAmount) || 5) : selectedAmount;

  // Derive closest impact tier or construct dynamic
  const getImpact = () => {
    const rawTier =
      TIERS[currentAmount] ||
      (currentAmount < 25
        ? TIERS[10]
        : currentAmount < 50
          ? TIERS[25]
          : currentAmount < 100
            ? TIERS[50]
            : currentAmount < 250
              ? TIERS[100]
              : TIERS[250]);

    const amt = rawTier.amount;
    const badge = dataPoints[`donate.calc.tier.${amt}.badge`] || rawTier.badge;
    const impactTitle = dataPoints[`donate.calc.tier.${amt}.title`] || rawTier.impactTitle;
    const impactDescription =
      dataPoints[`donate.calc.tier.${amt}.desc`] || rawTier.impactDescription;
    let tangibleMetrics = rawTier.tangibleMetrics;
    const metricsJson = dataPoints[`donate.calc.tier.${amt}.metrics`];
    if (metricsJson) {
      try {
        tangibleMetrics = JSON.parse(metricsJson);
      } catch {
        // Fall back to raw tier metrics
      }
    }
    return { ...rawTier, badge, impactTitle, impactDescription, tangibleMetrics };
  };

  const impact = getImpact();

  const getActBlueUrl = () => {
    const base = 'https://secure.actblue.com/donate/indivisiblefoc1432155925';
    const params = new URLSearchParams();
    params.set('amount', currentAmount.toString());
    if (isMonthly) {
      params.set('recurring', '1');
    }
    return `${base}?${params.toString()}`;
  };

  return (
    <div className="rounded-3xl bg-surface-card border border-border dark:bg-secondary dark:border-accent-gold/30 p-6 sm:p-8 md:p-10 shadow-card dark:shadow-2xl backdrop-blur-xl space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-border dark:border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-accent-gold/20 dark:text-accent-gold text-xs font-bold uppercase tracking-wider mb-2">
            <Heart
              size={14}
              className="fill-accent-gold text-amber-600 dark:fill-amber-300 dark:text-accent-gold"
            />
            <DataPoint as="span" name="donate.calc.eyebrow" initialData={dataPoints}>
              Interactive Grassroots Calculator
            </DataPoint>
          </div>
          <DataPoint
            as="h2"
            name="donate.calc.title"
            initialData={dataPoints}
            className="text-2xl sm:text-3xl font-black text-foreground dark:text-white"
          >
            Choose Your Contribution
          </DataPoint>
          <DataPoint
            as="p"
            name="donate.calc.subhead"
            initialData={dataPoints}
            className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark mt-1"
          >
            See the concrete civic impact of your grassroots investment before you give.
          </DataPoint>
        </div>

        {/* Recurring / One-time Frequency Toggle */}
        <div className="flex items-center p-1 bg-surface-muted rounded-2xl border border-border dark:bg-secondary dark:border-white/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setIsMonthly(false)}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
              !isMonthly
                ? 'bg-accent-gold text-slate-950 font-bold shadow-md'
                : 'text-muted-foreground hover:text-foreground dark:text-ink-muted-on-dark dark:hover:text-white'
            }`}
          >
            <DataPoint as="span" name="donate.calc.frequency.one_time" initialData={dataPoints}>
              One-Time
            </DataPoint>
          </button>
          <button
            type="button"
            onClick={() => setIsMonthly(true)}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              isMonthly
                ? 'bg-accent-gold text-slate-950 font-bold shadow-md'
                : 'text-muted-foreground hover:text-foreground dark:text-ink-muted-on-dark dark:hover:text-white'
            }`}
          >
            <Sparkles size={13} />
            <DataPoint as="span" name="donate.calc.frequency.monthly" initialData={dataPoints}>
              Monthly Sustainer
            </DataPoint>
          </button>
        </div>
      </div>

      <fieldset>
        <legend className="sr-only">Choose a donation amount</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[10, 25, 50, 100, 250].map((amt) => {
            const isSelected = !customAmount && selectedAmount === amt;
            return (
              <button
                key={amt}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedAmount(amt);
                  setCustomAmount('');
                }}
                className={`min-h-11 p-4 rounded-2xl border text-center transition-colors duration-300 ease-out relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-secondary ${
                  isSelected
                    ? 'bg-accent-gold/10 border-accent-gold shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                    : 'bg-surface-muted border-border hover:border-primary/40 dark:bg-secondary/60 dark:border-white/10 dark:hover:border-slate-700'
                }`}
              >
                <span
                  className={`text-2xl sm:text-3xl font-black block transition-colors ${
                    isSelected ? 'text-accent-gold' : 'text-foreground dark:text-white'
                  }`}
                >
                  ${amt}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground dark:text-ink-muted-on-dark mt-1 block">
                  {isMonthly ? (
                    <DataPoint as="span" name="donate.calc.per_month" initialData={dataPoints}>
                      Per Month
                    </DataPoint>
                  ) : (
                    <DataPoint
                      as="span"
                      name="donate.calc.one_time_suffix"
                      initialData={dataPoints}
                    >
                      One-Time
                    </DataPoint>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Custom Amount Input */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-2xl bg-surface-muted border border-border">
        <label
          htmlFor="custom-amount"
          className="text-xs font-mono text-foreground dark:text-ink-on-dark whitespace-nowrap"
        >
          <DataPoint as="span" name="donate.calc.custom_amount_label" initialData={dataPoints}>
            Or Enter Custom Amount:
          </DataPoint>
        </label>
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark font-bold">
            $
          </span>
          <input
            id="custom-amount"
            type="number"
            min={5}
            step={1}
            placeholder={dataPoints['donate.calc.custom_amount_placeholder'] || 'e.g. 75'}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-surface-card border border-border text-foreground placeholder:text-muted-foreground dark:bg-secondary dark:border-slate-700 dark:text-white dark:placeholder-slate-500 text-sm font-bold focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>
      </div>

      {/* Dynamic Impact Display Box */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 border border-border dark:from-blue-950/50 dark:via-slate-900 dark:to-indigo-950/50 dark:border-primary-bright/30 p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-primary-ink dark:text-accent-gold uppercase tracking-wide">
            <Sparkles size={14} />
            <DataPoint as="span" name="donate.calc.impact_badge" initialData={dataPoints}>
              Grassroots Impact Breakdown
            </DataPoint>
          </div>
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary-ink dark:bg-primary-bright/20 dark:text-primary-on-dark text-xs font-semibold">
            {impact.badge}
          </span>
        </div>

        <div>
          <h3 className="text-xl sm:text-2xl font-black text-foreground dark:text-white mb-2">
            Your ${currentAmount} {isMonthly ? '/ month' : ''} enables: {impact.impactTitle}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed">
            {impact.impactDescription}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {impact.tangibleMetrics.map((metric) => (
            <div
              key={metric}
              className="p-3 rounded-xl bg-surface-card border border-border text-foreground dark:bg-secondary dark:border-white/10 dark:text-slate-200 text-xs font-medium flex items-center gap-2"
            >
              <Check size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span>{metric}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Final ActBlue CTA Button */}
      <div className="space-y-4 pt-2">
        <a
          href={getActBlueUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-accent-gold hover:to-amber-300 text-slate-950 font-black text-base uppercase tracking-wider shadow-xl hover:shadow-amber-500/25 transition-all flex items-center justify-center gap-3 group hover:scale-[1.01]"
        >
          <CreditCard size={20} className="group-hover:rotate-6 transition-transform" />
          <span className="flex items-center gap-1.5">
            <DataPoint as="span" name="donate.calc.give_btn_prefix" initialData={dataPoints}>
              Give
            </DataPoint>{' '}
            <span>${currentAmount}</span>{' '}
            {isMonthly ? (
              <DataPoint as="span" name="donate.calc.give_btn_monthly" initialData={dataPoints}>
                Monthly
              </DataPoint>
            ) : (
              <DataPoint as="span" name="donate.calc.give_btn_now" initialData={dataPoints}>
                Now
              </DataPoint>
            )}{' '}
            <DataPoint as="span" name="donate.calc.give_btn_suffix" initialData={dataPoints}>
              via ActBlue
            </DataPoint>
          </span>
          <ExternalLink size={18} />
        </a>

        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted-foreground dark:text-ink-muted-on-dark text-center">
          <span className="flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-500 dark:text-emerald-400" />
            <DataPoint as="span" name="donate.calc.security.encrypted" initialData={dataPoints}>
              Encrypted 256-bit Secure ActBlue Processing
            </DataPoint>
          </span>
          <span>•</span>
          <DataPoint as="span" name="donate.calc.security.no_pac" initialData={dataPoints}>
            No Corporate PAC Money Accepted
          </DataPoint>
          <span>•</span>
          <DataPoint as="span" name="donate.calc.security.volunteer" initialData={dataPoints}>
            All Grassroots Volunteer Managed
          </DataPoint>
        </div>
      </div>
    </div>
  );
}
