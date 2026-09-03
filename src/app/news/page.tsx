import { ArrowRight, BookOpen, Mail, Megaphone, Newspaper, Send } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Newsletters & Bulletins | Indivisible Fair Oaks-Carmichael',
  description:
    'Read past chapter newsletters, stay informed about Sacramento County grassroots organizing, and subscribe to receive action alerts directly in your inbox.',
};

const NEWSLETTERS = [
  {
    title: 'Indivisible Fair Oaks-Carmichael Summer Action Bulletin',
    date: 'July 2026',
    description:
      'Summer organizing priorities: preparing for upcoming elections, choir street demonstrations at Fair Oaks & Manzanita, local food bank drives, and phone-banking schedules.',
    topics: ['Election Defense', 'Choir Actions', 'Food Drive', 'Mobilize Events'],
  },
  {
    title: 'Mid-Year Grassroots Review & Legislative Round-up',
    date: 'June 2026',
    description:
      'Review of California state legislative priorities, local city council actions, deep canvass voter persuasion results, and upcoming coalition rallies in Citrus Heights.',
    topics: ['California Bills', 'Deep Canvass', 'Sunrise Solidarity', 'Voter Outreach'],
  },
  {
    title: 'Spring Mobilization & Resistance Choir Launch',
    date: 'May 2026',
    description:
      'Announcing the official schedule for the Carmichael Resistance Choir, spring town hall debriefs, and youth voter pre-registration drives across Sacramento County.',
    topics: ['Resistance Choir', 'Youth Pre-Registration', 'Town Halls'],
  },
  {
    title: 'Defending Democratic Norms: Spring Chapter Newsletter',
    date: 'April 2026',
    description:
      'National Indivisible strategy updates, local community resistance workshops, and mutual aid efforts for Fair Oaks and Carmichael neighborhood families.',
    topics: ['National Strategy', 'Mutual Aid', 'Community Care'],
  },
];

export default function NewsPage() {
  return (
    <div className="w-full bg-slate-950 text-white min-h-screen pt-24 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Newspaper size={14} className="text-amber-400" />
            <span>Chapter Bulletins & Insights</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Newsletters & Chapter Updates
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Stay up to date with our grassroots organizing, local legislative actions, and community
            resistance across Fair Oaks, Carmichael, and Sacramento County.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Newsletter Subscription Card */}
        <div className="p-8 rounded-2xl bg-gradient-to-tr from-blue-900/60 via-slate-900 to-indigo-950/60 border border-blue-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
              <Mail size={12} />
              <span>Direct To Your Inbox</span>
            </div>
            <h2 className="text-2xl font-black text-white">Subscribe to Action Alerts</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Receive notifications for upcoming meetings, emergency rapid response rallies, choir
              rehearsal locations, and legislative call-to-action alerts.
            </p>
          </div>
          <div className="shrink-0 w-full md:w-auto">
            <a
              href="mailto:subscribe@indivisiblefairoaks.org?subject=Subscribe%20to%20Indivisible%20Fair%20Oaks%20Newsletter"
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
            >
              <Send size={16} />
              <span>Email to Subscribe</span>
            </a>
          </div>
        </div>

        {/* Bulletins Archive */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <BookOpen className="text-blue-400" />
            <span>Past Bulletins & Archives</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {NEWSLETTERS.map((newsletter) => (
              <div
                key={newsletter.title}
                className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      {newsletter.date}
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold uppercase">
                      Chapter Bulletin
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white leading-snug">{newsletter.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{newsletter.description}</p>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {newsletter.topics.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-semibold text-slate-400"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-800/80 mt-6 flex items-center justify-between">
                  <a
                    href="mailto:contact@indivisiblefairoaks.org?subject=Archive%20Request%20-%20Bulletin"
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <span>Request Full Issue</span>
                    <ArrowRight size={14} />
                  </a>
                  <span className="text-[11px] text-slate-500">PDF & Email Archive</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* National Indivisible Wire */}
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <Megaphone className="text-amber-400" size={22} />
            <h2 className="text-xl font-bold text-white">National Indivisible Resources</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Indivisible Fair Oaks-Carmichael is one of thousands of grassroots groups nationwide
            following the proven guide created by former congressional staffers. For nationwide
            campaigns, toolkits, and legislative tracking, visit the national network at{' '}
            <a
              href="https://indivisible.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline font-semibold"
            >
              indivisible.org
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
