import type { Metadata } from 'next';
import {
  AlertCircle,
  Calendar,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  Megaphone,
  Music,
  Shield,
  Users,
} from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Events & Actions | Indivisible Fair Oaks-Carmichael',
  description:
    'Join our upcoming chapter meetings, singing protests with the Carmichael Resistance Choir, weekly rallies, and voter mobilization events in Sacramento County.',
};

export default function EventsPage() {
  return (
    <div className="w-full bg-slate-950 text-white min-h-screen pt-24 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Calendar size={14} className="text-amber-400" />
            <span>Community Actions & Calendar</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Upcoming Events & Mobilizations
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Find out when and where our chapter is gathering. All community members committed to peaceful, democratic activism are warmly welcome.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        {/* Core Chapter Meeting Feature */}
        <div className="rounded-2xl bg-gradient-to-tr from-blue-900/60 via-slate-900 to-slate-900 border border-blue-500/40 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
                Monthly Chapter Meeting
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Indivisible Fair Oaks-Carmichael Community Gathering
              </h2>
            </div>
            <a
              href="https://www.mobilize.us/indivisible/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg transition-all shrink-0 flex items-center gap-2"
            >
              <span>RSVP on Mobilize</span>
              <ExternalLink size={14} />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-slate-200">
                <Clock className="text-blue-400 shrink-0" size={18} />
                <span className="font-semibold text-sm sm:text-base">
                  First Tuesday of the Month • 6:30 PM – 8:00 PM
                </span>
              </div>
              <div className="flex items-start gap-3 text-slate-200">
                <MapPin className="text-blue-400 shrink-0 mt-1" size={18} />
                <div>
                  <span className="font-semibold text-sm sm:text-base block">
                    St. Michael&#39;s Episcopal Church
                  </span>
                  <span className="text-xs text-slate-400 block">
                    2140 Mission Avenue, Carmichael, CA 95608
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p className="font-bold text-amber-300 flex items-center gap-1.5">
                <Heart size={14} className="fill-amber-300 text-amber-300" />
                Local Food Bank Drive
              </p>
              <p>
                Please bring a can or box of non-perishable food to help keep our local food pantries stocked for community families in need.
              </p>
            </div>
          </div>
        </div>

        {/* Regular Action Events Grid */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Megaphone className="text-amber-400" />
            <span>Regular Rallies & Singing Demonstrations</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Singing Protest */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Music size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Singing Protest with Carmichael Resistance Choir
                  </h3>
                  <p className="text-xs text-blue-300 font-semibold mb-3">
                    Fair Oaks Blvd & Manzanita Ave (&ldquo;T&rdquo; Intersection)
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Join us in singing our protest to rush-hour commuters and area businesses! Led by the Carmichael Resistance Choir. BRING YOUR SIGNS, CHAIRS, AND VOICES!
                  </p>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p><strong>Time:</strong> 5:00 PM – 6:15 PM</p>
                  <p><strong>Values:</strong> Strictly non-violent, peaceful de-escalation.</p>
                </div>
              </div>
              <div className="pt-6">
                <Link
                  href="/choir"
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
                >
                  <span>Choir Info & Rehearsals</span>
                  <ExternalLink size={12} />
                </Link>
              </div>
            </div>

            {/* Sunrise Solidarity Citrus Heights */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Sunrise Solidarity Citrus Heights Rally
                  </h3>
                  <p className="text-xs text-rose-300 font-semibold mb-3">
                    Corner of Sunrise Blvd & Greenback Lane, Citrus Heights
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    A peaceful, non-violent, family-friendly rally in solidarity with immigrants, democracy, and community rights. Snacks, cold drinks, and signs provided!
                  </p>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p><strong>Schedule:</strong> Every Saturday from 10:00 AM – 12:00 Noon</p>
                  <p><strong>Bring:</strong> Comfortable shoes, water, and sunscreen.</p>
                </div>
              </div>
              <div className="pt-6">
                <a
                  href="https://www.mobilize.us/indivisible/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
                >
                  <span>Sign Up via Mobilize</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Trainings & Campaign Initiatives */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="text-blue-400" />
            <span>Trainings & Action Labs</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
              <h3 className="text-lg font-bold text-white">
                Deep Canvass Political Persuasion Training
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Learn the proven art of deep canvassing: connecting with conflicted voters through empathetic listening and shared values to build durable election support.
              </p>
              <span className="inline-block text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                We The Fighters / Organizing to Fight Oligarchy
              </span>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
              <h3 className="text-lg font-bold text-white">
                Know Your Rights Civic Workshop
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Everyone has fundamental constitutional rights under U.S. law. Learn what your rights are, how to safely exercise them in public, and what to do if your rights are violated.
              </p>
              <a
                href="https://www.aclu.org/know-your-rights"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
              >
                <span>ACLU Know Your Rights Guide</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>

        {/* Nonviolence Banner */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-4">
          <AlertCircle className="text-amber-400 shrink-0 mt-1" size={24} />
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            <strong className="text-white block mb-1">Our Nonviolent Commitment:</strong>
            All Indivisible Fair Oaks-Carmichael events are strictly nonviolent. We expect all attendees to act lawfully and de-escalate any potential confrontation with counter-protesters. No weapons are permitted at any event.
          </div>
        </div>
      </div>
    </div>
  );
}
