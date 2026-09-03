import { AlertCircle, Calendar, ExternalLink, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { InteractiveEventsCalendar } from '@/components/ui/InteractiveEventsCalendar';

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
            Find out when and where our chapter is gathering. All community members committed to
            peaceful, democratic activism are warmly welcome.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <InteractiveEventsCalendar />

        {/* Trainings & Campaign Initiatives */}
        <div className="space-y-6 pt-6 border-t border-slate-800">
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
                Learn the proven art of deep canvassing: connecting with conflicted voters through
                empathetic listening and shared values to build durable election support.
              </p>
              <span className="inline-block text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                We The Fighters / Organizing to Fight Oligarchy
              </span>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
              <h3 className="text-lg font-bold text-white">Know Your Rights Civic Workshop</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Everyone has fundamental constitutional rights under U.S. law. Learn what your
                rights are, how to safely exercise them in public, and what to do if your rights are
                violated.
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
            All Indivisible Fair Oaks-Carmichael events are strictly nonviolent. We expect all
            attendees to act lawfully and de-escalate any potential confrontation with
            counter-protesters. No weapons are permitted at any event.
          </div>
        </div>
      </div>
    </div>
  );
}
