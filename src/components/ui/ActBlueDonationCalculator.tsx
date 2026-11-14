'use client';

import { Check, CreditCard, ExternalLink, Heart, ShieldCheck } from 'lucide-react';
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

export function ActBlueDonationCalculator({
  initialData,
}: {
  initialData?: Record<string, string>;
} = {}) {
  const { dataPoints } = useDataPoints('donate', initialData);
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
    <div className="border-y border-foreground/20 py-8 sm:py-10">
      <div className="flex flex-col items-start justify-between gap-6 border-b border-foreground/20 pb-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            <Heart aria-hidden="true" size={13} className="fill-accent" />
            <DataPoint as="span" name="donate.calc.eyebrow" initialData={dataPoints}>
              Grassroots Calculator
            </DataPoint>
          </div>
          <DataPoint
            as="h2"
            name="donate.calc.title"
            initialData={dataPoints}
            className="mt-3 max-w-xl font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-foreground sm:text-5xl"
          >
            Choose Your Contribution
          </DataPoint>
          <DataPoint
            as="p"
            name="donate.calc.subhead"
            initialData={dataPoints}
            className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base"
          >
            See the concrete civic impact of your grassroots investment before you give.
          </DataPoint>
        </div>

        {/* Recurring / One-time Frequency Toggle */}
        <div className="shrink-0">
          <div
            role="group"
            aria-label="Contribution frequency"
            className="inline-flex border border-foreground/25"
          >
            <button
              type="button"
              aria-pressed={!isMonthly}
              onClick={() => setIsMonthly(false)}
              className={`min-h-10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                !isMonthly
                  ? 'bg-foreground text-background'
                  : 'bg-transparent text-foreground hover:bg-surface-muted'
              }`}
            >
              <DataPoint as="span" name="donate.calc.frequency.one_time" initialData={dataPoints}>
                One-Time
              </DataPoint>
            </button>
            <button
              type="button"
              aria-pressed={isMonthly}
              onClick={() => setIsMonthly(true)}
              className={`min-h-10 border-l border-foreground/25 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                isMonthly
                  ? 'bg-foreground text-background'
                  : 'bg-transparent text-foreground hover:bg-surface-muted'
              }`}
            >
              <DataPoint as="span" name="donate.calc.frequency.monthly" initialData={dataPoints}>
                Monthly Sustainer
              </DataPoint>
            </button>
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-muted-foreground md:text-right">
            Cancel or change anytime via ActBlue
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <fieldset>
            <legend className="mb-3 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Select an amount
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
                    className={`flex min-h-24 flex-col justify-between border p-3.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      amt === 250 ? 'col-span-2 sm:col-span-1' : ''
                    } ${
                      isSelected
                        ? 'border-primary bg-primary text-white'
                        : 'border-foreground/20 bg-transparent text-foreground hover:border-primary/60 hover:bg-surface-muted'
                    }`}
                  >
                    <span className="font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                      ${amt}
                    </span>
                    <span
                      className={`mt-2 text-[9px] font-bold uppercase tracking-[0.12em] ${
                        isSelected ? 'text-white' : 'text-muted-foreground'
                      }`}
                    >
                      {isMonthly ? (
                        <DataPoint
                          as="span"
                          name="donate.calc.per_month"
                          initialData={dataPoints}
                        >
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
          <div className="mt-6 border-b border-foreground/20 pb-4">
            <label
              htmlFor="custom-amount"
              className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              <DataPoint as="span" name="donate.calc.custom_amount_label" initialData={dataPoints}>
                Or Enter Custom Amount:
              </DataPoint>
            </label>
            <div className="relative mt-1">
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 -translate-y-1/2 font-display text-2xl text-muted-foreground"
              >
                $
              </span>
              <input
                id="custom-amount"
                type="number"
                min={5}
                step={1}
                inputMode="numeric"
                placeholder={dataPoints['donate.calc.custom_amount_placeholder'] || 'e.g. 75'}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full border-0 bg-transparent py-2 pl-6 pr-2 font-display text-2xl font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              />
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Minimum $5 · every dollar stays local
            </p>
          </div>

          <p className="mt-5 max-w-md text-xs leading-relaxed text-muted-foreground">
            You&rsquo;ll finish your secure contribution on ActBlue. Recurring gifts can be changed
            or canceled at any time.
          </p>
        </div>

        {/* Dynamic Impact Display Box */}
        <aside className="flex flex-col border border-foreground/25 bg-secondary p-6 text-ink-on-dark sm:p-8 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-4">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-accent-gold">
              <DataPoint as="span" name="donate.calc.impact_badge" initialData={dataPoints}>
                Grassroots Impact Breakdown
              </DataPoint>
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-muted-on-dark">
              {impact.badge}
            </span>
          </div>

          <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.16em] text-ink-muted-on-dark">
            Your ${currentAmount}
            {isMonthly ? ' / month' : ''} enables
          </p>
          <h3 className="mt-2 font-display text-3xl font-semibold leading-[1.04] tracking-[-0.03em] text-accent-gold">
            {impact.impactTitle}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-ink-on-dark/80">
            {impact.impactDescription}
          </p>

          <ul className="mt-6 divide-y divide-white/15 border-y border-white/15">
            {impact.tangibleMetrics.map((metric) => (
              <li
                key={metric}
                className="flex items-start gap-3 py-3 text-sm leading-snug text-ink-on-dark"
              >
                <Check aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-accent-gold" />
                <span>{metric}</span>
              </li>
            ))}
          </ul>

        </aside>
      </div>

      <div className="mt-8 border-t border-foreground/20 pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Your contribution
            </p>
            <p className="mt-1 font-display text-2xl font-semibold leading-none tracking-[-0.03em] text-foreground">
              ${currentAmount}
              <span className="ml-2 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {isMonthly ? 'Per Month' : 'One-Time'}
              </span>
            </p>
          </div>

          <a
            href={getActBlueUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-12 w-full items-center justify-center gap-2 bg-accent-gold px-5 py-3.5 text-center text-[10px] font-bold uppercase tracking-[0.13em] text-ink-strong transition-colors hover:brightness-95 sm:w-auto sm:min-w-[19rem]"
          >
            <CreditCard aria-hidden="true" size={16} className="shrink-0" />
            <span className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
              <DataPoint as="span" name="donate.calc.give_btn_prefix" initialData={dataPoints}>
                Give
              </DataPoint>{' '}
              <span>${currentAmount}</span>{' '}
              {isMonthly ? (
                <DataPoint
                  as="span"
                  name="donate.calc.give_btn_monthly"
                  initialData={dataPoints}
                >
                  Monthly
                </DataPoint>
              ) : (
                <DataPoint as="span" name="donate.calc.give_btn_now" initialData={dataPoints}>
                  Now
                </DataPoint>
              )}{' '}
              <DataPoint
                as="span"
                name="donate.calc.give_btn_suffix"
                initialData={dataPoints}
              >
                via ActBlue
              </DataPoint>
            </span>
            <ExternalLink
              aria-hidden="true"
              size={15}
              className="shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground sm:justify-end">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck aria-hidden="true" size={12} className="text-primary-ink" />
            <DataPoint as="span" name="donate.calc.security.encrypted" initialData={dataPoints}>
              Encrypted 256-bit Secure ActBlue Processing
            </DataPoint>
          </span>
          <span aria-hidden="true">·</span>
          <DataPoint as="span" name="donate.calc.security.no_pac" initialData={dataPoints}>
            No Corporate PAC Money Accepted
          </DataPoint>
          <span aria-hidden="true">·</span>
          <DataPoint as="span" name="donate.calc.security.volunteer" initialData={dataPoints}>
            All Grassroots Volunteer Managed
          </DataPoint>
        </div>
      </div>
    </div>
  );
}
