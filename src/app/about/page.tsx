import type { Metadata } from 'next';
import { CheckCircle2, Heart, Shield, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Us | Indivisible Fair Oaks-Carmichael',
  description:
    'Learn about Indivisible Fair Oaks-Carmichael, our mission, values, and grassroots organizing across Fair Oaks, Carmichael, and Sacramento County.',
};

export default function AboutPage() {
  return (
    <div className="w-full bg-slate-950 text-white min-h-screen pt-24 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Users size={14} className="text-amber-400" />
            <span>Grassroots Democracy In Action</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            About Indivisible Fair Oaks-Carmichael
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            We are a local grassroots chapter representing residents in and near Fair Oaks and Carmichael, California, dedicated to protecting our democracy through peaceful civic power.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Our Mission */}
        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Shield className="text-amber-400" />
            <span>Our Mission Statement</span>
          </h2>
          <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 text-slate-300 leading-relaxed text-base">
            <p className="font-semibold text-white text-lg">
              The mission of the Fair Oaks - Carmichael Indivisible Chapter is to cultivate a disciplined, non-violent grassroots movement that:
            </p>
            <ul className="space-y-3 pt-2">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-400 shrink-0 mt-1" size={18} />
                <span>
                  <strong className="text-white">Stops the rise of authoritarianism:</strong> Holding officials accountable and sounding the alarm against anti-democratic power grabs.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-400 shrink-0 mt-1" size={18} />
                <span>
                  <strong className="text-white">Supports and defends democratic norms:</strong> Protecting voting rights, equal representation, free press, and constitutional governance.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-400 shrink-0 mt-1" size={18} />
                <span>
                  <strong className="text-white">Elects bold leaders:</strong> Mobilizing voters to elect public servants who champion democratic integrity and progressive values.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-400 shrink-0 mt-1" size={18} />
                <span>
                  <strong className="text-white">Secures progressive policies:</strong> Championing economic justice, environmental stewardship, and civil rights for all people.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Who We Are & Where We Organize */}
        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Users className="text-blue-400" />
            <span>Who We Are</span>
          </h2>
          <div className="text-slate-300 space-y-4 leading-relaxed">
            <p>
              We are neighbors, retirees, workers, students, educators, and community members in Sacramento County who believe that true democracy requires active, ongoing participation. As an affiliated chapter of the national <strong>Indivisible</strong> network, we apply national organizing strategies locally where our voices have the greatest impact.
            </p>
            <p>
              Our monthly gatherings provide a welcoming space for dialogue, education, and coordinated action. Whether writing postcards, attending town halls, rallying on street corners, or lifting our voices in song, we turn concern into constructive, democratic action.
            </p>
          </div>
        </section>

        {/* Commitment to Nonviolent Action */}
        <section className="p-8 rounded-2xl bg-gradient-to-r from-blue-950/40 to-slate-900 border border-blue-500/30 space-y-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="text-amber-400" size={20} />
            Commitment to Non-Violent Action & De-escalation
          </h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            A foundational pillar behind all Indivisible Fair Oaks-Carmichael events is a strict commitment to nonviolence. We expect all attendees to act lawfully, treat fellow citizens with dignity, and actively seek to de-escalate potential conflict with counter-protesters. Weapons of any kind are strictly prohibited at our gatherings.
          </p>
        </section>

        {/* Community Food Bank Drives */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <Heart className="text-rose-400" />
            <span>Community Care & Food Drives</span>
          </h2>
          <p className="text-slate-300 leading-relaxed">
            We believe that civic justice begins with community care. At every in-person monthly gathering, our members bring non-perishable canned goods and staple foods to donate to local Carmichael and Fair Oaks food pantries.
          </p>
        </section>

        {/* Contact & Join */}
        <section className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-6">
          <h3 className="text-2xl font-black text-white">Join Our Next Gathering</h3>
          <p className="text-slate-300 text-sm max-w-xl mx-auto">
            Ready to get involved? Join our mailing list, attend our next monthly meeting, or sing with the Carmichael Resistance Choir.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/events"
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all"
            >
              See Upcoming Events
            </Link>
            <Link
              href="/contact"
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-all"
            >
              Contact Us
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
