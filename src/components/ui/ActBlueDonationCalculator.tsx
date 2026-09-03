'use client';

import { Check, CreditCard, ExternalLink, Heart, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';

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
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [isMonthly, setIsMonthly] = useState<boolean>(false);
  const [customAmount, setCustomAmount] = useState<string>('');

  const currentAmount = customAmount ? Math.max(5, Number(customAmount) || 5) : selectedAmount;

  // Derive closest impact tier or construct dynamic
  const getImpact = () => {
    if (TIERS[currentAmount]) return TIERS[currentAmount];
    if (currentAmount < 25) return TIERS[10];
    if (currentAmount < 50) return TIERS[25];
    if (currentAmount < 100) return TIERS[50];
    if (currentAmount < 250) return TIERS[100];
    return TIERS[250];
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
    <div className="rounded-3xl bg-slate-900/90 border border-amber-500/30 p-6 sm:p-8 md:p-10 shadow-2xl backdrop-blur-xl space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Heart size={14} className="fill-amber-300 text-amber-300" />
            <span>Interactive Grassroots Calculator</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">Choose Your Contribution</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            See the concrete civic impact of your grassroots investment before you give.
          </p>
        </div>

        {/* Recurring / One-time Frequency Toggle */}
        <div className="flex items-center p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setIsMonthly(false)}
            className={`px-4 py-2 rounded-xl transition-all ${
              !isMonthly
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            One-Time
          </button>
          <button
            type="button"
            onClick={() => setIsMonthly(true)}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              isMonthly
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles size={13} />
            <span>Monthly Sustainer</span>
          </button>
        </div>
      </div>

      {/* Amount Preset Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[10, 25, 50, 100, 250].map((amt) => {
          const isSelected = !customAmount && selectedAmount === amt;
          return (
            <button
              key={amt}
              type="button"
              onClick={() => {
                setSelectedAmount(amt);
                setCustomAmount('');
              }}
              className={`p-4 rounded-2xl border text-center transition-all relative ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span
                className={`text-2xl sm:text-3xl font-black block transition-colors ${
                  isSelected ? 'text-amber-400' : 'text-white'
                }`}
              >
                ${amt}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mt-1 block">
                {isMonthly ? 'Per Month' : 'One-Time'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom Amount Input */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
        <label
          htmlFor="custom-amount"
          className="text-xs font-mono text-slate-300 whitespace-nowrap"
        >
          Or Enter Custom Amount:
        </label>
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
            $
          </span>
          <input
            id="custom-amount"
            type="number"
            min={5}
            step={1}
            placeholder="e.g. 75"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm font-bold focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>
      </div>

      {/* Dynamic Impact Display Box */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-950/50 via-slate-900 to-indigo-950/50 border border-blue-500/30 p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-400 uppercase tracking-wide">
            <Sparkles size={14} />
            <span>Grassroots Impact Breakdown</span>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold">
            {impact.badge}
          </span>
        </div>

        <div>
          <h3 className="text-xl sm:text-2xl font-black text-white mb-2">
            Your ${currentAmount} {isMonthly ? '/ month' : ''} enables: {impact.impactTitle}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {impact.impactDescription}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {impact.tangibleMetrics.map((metric) => (
            <div
              key={metric}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-medium text-slate-200 flex items-center gap-2"
            >
              <Check size={14} className="text-emerald-400 shrink-0" />
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
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-base uppercase tracking-wider shadow-xl hover:shadow-amber-500/25 transition-all flex items-center justify-center gap-3 group hover:scale-[1.01]"
        >
          <CreditCard size={20} className="group-hover:rotate-6 transition-transform" />
          <span>
            Give ${currentAmount} {isMonthly ? 'Monthly' : 'Now'} via ActBlue
          </span>
          <ExternalLink size={18} />
        </a>

        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400 text-center">
          <span className="flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Encrypted 256-bit Secure ActBlue Processing</span>
          </span>
          <span>•</span>
          <span>No Corporate PAC Money Accepted</span>
          <span>•</span>
          <span>All Grassroots Volunteer Managed</span>
        </div>
      </div>
    </div>
  );
}
