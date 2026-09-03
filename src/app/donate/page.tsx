import { Heart, Megaphone, Music, Shield, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { ActBlueDonationCalculator } from '@/components/ui/ActBlueDonationCalculator';

export const metadata: Metadata = {
  title: 'Donate & Support | Indivisible Fair Oaks-Carmichael',
  description:
    'Support Indivisible Fair Oaks-Carmichael via ActBlue. Every grassroots contribution powers our local organizing, choir rallies, and voter turnout campaigns.',
};

export default function DonatePage() {
  return (
    <div className="w-full bg-slate-950 text-white min-h-screen pt-24 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Heart size={14} className="fill-amber-400 text-amber-400" />
            <span>100% Grassroots Funded</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Fuel The Fair Oaks - Carmichael Resistance
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            We don&apos;t take corporate PAC money. Our work is powered entirely by neighbors like
            you who pitch in to defend democracy right here in Sacramento County.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* 10x Pro Interactive ActBlue Donation Calculator */}
        <ActBlueDonationCalculator />

        {/* How Your Contribution Is Put To Work */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-white tracking-tight">
            How Your Dollars Make A Difference
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <Users size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Community Meeting Spaces</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Rent for our monthly meeting spaces (such as St. Michael&apos;s Church hall) to
                provide safe, welcoming gathering venues for residents and guest speakers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Music size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Resistance Choir Sound Gear</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Battery-powered amplifiers, portable microphones, sheet music printing, and acoustic
                gear to carry our voices across busy intersections.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center">
                <Megaphone size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Protest Banners & Supplies</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Weatherproof protest signs, high-visibility banners for street demonstrations, art
                supplies for youth rallies, and flyers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Shield size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Voter Outreach & Registration</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Printed guides for youth pre-registration, rights restoration flyers for formerly
                incarcerated community members, and postcard stamps.
              </p>
            </div>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-850 text-xs text-slate-400 space-y-2">
          <p className="font-bold text-slate-300">Contribution Disclaimers:</p>
          <p>
            Contributions or gifts to Indivisible Fair Oaks-Carmichael are not deductible as
            charitable contributions for federal income tax purposes. All donations are processed
            securely by ActBlue in accordance with FEC and California political contribution
            regulations.
          </p>
        </div>
      </div>
    </div>
  );
}
