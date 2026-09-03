import type { Metadata } from 'next';
import {
  ExternalLink,
  Heart,
  Megaphone,
  Music,
  Shield,
  Users,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Donate & Support | Indivisible Fair Oaks-Carmichael',
  description:
    'Support Indivisible Fair Oaks-Carmichael via ActBlue. Every grassroots contribution powers our local organizing, choir rallies, and voter turnout campaigns.',
};

const AMOUNTS = [10, 25, 50, 100, 250];

export default function DonatePage() {
  const baseActBlueUrl = 'https://secure.actblue.com/donate/indivisiblefoc1432155925';

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
            We don&apos;t take corporate PAC money. Our work is powered entirely by neighbors like you who pitch in to defend democracy right here in Sacramento County.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Donation Portal Box */}
        <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-tr from-slate-900 via-blue-950/40 to-slate-900 border border-amber-500/30 shadow-2xl space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Choose an Amount to Contribute
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Secure payments processed through ActBlue.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {AMOUNTS.map((amt) => (
              <a
                key={amt}
                href={`${baseActBlueUrl}?amount=${amt}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-4 px-3 rounded-2xl bg-slate-900 border border-slate-700 hover:border-amber-400 hover:bg-slate-800 transition-all text-center group"
              >
                <span className="block text-2xl font-black text-white group-hover:text-amber-400 transition-colors">
                  ${amt}
                </span>
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mt-1">
                  One-Time
                </span>
              </a>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <a
              href={baseActBlueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2"
            >
              <Heart size={18} className="fill-slate-950" />
              <span>Donate Custom Amount on ActBlue</span>
              <ExternalLink size={16} />
            </a>
          </div>
        </div>

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
                Rent for our monthly meeting spaces (such as St. Michael&apos;s Church hall) to provide safe, welcoming gathering venues for residents and guest speakers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Music size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Resistance Choir Sound Gear</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Battery-powered amplifiers, portable microphones, sheet music printing, and acoustic gear to carry our voices across busy intersections.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center">
                <Megaphone size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Protest Banners & Supplies</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Weatherproof protest signs, high-visibility banners for street demonstrations, art supplies for youth rallies, and flyers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Shield size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Voter Outreach & Registration</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Printed guides for youth pre-registration, rights restoration flyers for formerly incarcerated community members, and postcard stamps.
              </p>
            </div>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-850 text-xs text-slate-400 space-y-2">
          <p className="font-bold text-slate-300">Contribution Disclaimers:</p>
          <p>
            Contributions or gifts to Indivisible Fair Oaks-Carmichael are not deductible as charitable contributions for federal income tax purposes. All donations are processed securely by ActBlue in accordance with FEC and California political contribution regulations.
          </p>
        </div>
      </div>
    </div>
  );
}
