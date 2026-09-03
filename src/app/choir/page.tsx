import type { Metadata } from 'next';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Mail,
  MapPin,
  Music,
} from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Carmichael Resistance Choir | Indivisible Fair Oaks-Carmichael',
  description:
    'Sing with the Carmichael Resistance Choir! Music sustains our democracy movement. Rehearsals every other Wednesday evening. All voices welcome, no audition required.',
};

export default function ChoirPage() {
  return (
    <div className="w-full bg-slate-950 text-white min-h-screen pt-24 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Music size={14} className="text-amber-400" />
            <span>Harmonizing For Justice</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            The Carmichael Resistance Choir
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed italic">
            &ldquo;Every good protest movement needs music. Music lifts us up, keeps us motivated, and sustains us through the long haul.&rdquo;
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* About the Choir */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Lifting Our Voices in Solidarity
            </h2>
            <div className="text-slate-300 space-y-4 text-sm sm:text-base leading-relaxed">
              <p>
                The <strong>Carmichael Resistance Choir</strong> brings people together through the power of collective song. Rooted in the rich tradition of American civil rights, labor, and anti-war movements, our choir provides a joyful, defiant, and creative outlet for community resistance.
              </p>
              <p>
                We perform at rallies, street corner singing protests (such as the intersection of Fair Oaks Blvd & Manzanita Ave), marches, and community meetings throughout the greater Sacramento region.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <span className="font-bold text-white text-sm block">No Auditions</span>
                  <span className="text-xs text-slate-400">All skill levels and vocal ranges welcome.</span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <span className="font-bold text-white text-sm block">100% Free</span>
                  <span className="text-xs text-slate-400">No membership dues or fees ever required.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="p-6 rounded-2xl bg-gradient-to-tr from-blue-950/60 to-slate-900 border border-blue-500/30 shadow-xl space-y-6">
              <div className="flex items-center gap-3">
                <Calendar className="text-amber-400" size={24} />
                <h3 className="text-xl font-bold text-white">Rehearsal Schedule</h3>
              </div>

              <div className="space-y-4 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <Clock className="text-blue-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <strong className="text-white block">Every Other Wednesday</strong>
                    <span className="text-xs text-slate-400">6:30 PM – 8:00 PM</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="text-blue-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <strong className="text-white block">Carmichael Rehearsal Space</strong>
                    <span className="text-xs text-slate-400">
                      Exact address and parking instructions provided upon registration.
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href="https://www.mobilize.us/indivisible/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <span>Register for Next Rehearsal</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Video Demonstrations */}
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-amber-400 text-xs font-black uppercase tracking-widest block mb-2">
              Watch Us In Action
            </span>
            <h2 className="text-3xl font-black text-white tracking-tight">
              Singing Out On The Streets
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Demonstrations at Fair Oaks Blvd & Manzanita Ave in Carmichael, CA.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 p-4 shadow-xl space-y-3">
              <div className="aspect-video rounded-xl overflow-hidden bg-slate-950">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/BhdjDlRUMUw"
                  title="Carmichael Resistance Choir Singing Demonstration 1"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <h3 className="font-bold text-white text-sm">Rush Hour Singing Demonstration</h3>
              <p className="text-xs text-slate-400">
                Carrying songs of peace, civil rights, and democratic defense to community drivers.
              </p>
            </div>

            <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 p-4 shadow-xl space-y-3">
              <div className="aspect-video rounded-xl overflow-hidden bg-slate-950">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/M631H68kLCE"
                  title="Carmichael Resistance Choir Singing Demonstration 2"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <h3 className="font-bold text-white text-sm">Community Voices in Harmony</h3>
              <p className="text-xs text-slate-400">
                Singing protest anthems together to foster camaraderie and courage.
              </p>
            </div>
          </div>
        </div>

        {/* Songbook & Repertoire Section */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Music className="text-amber-400" size={20} />
              <span>Choir Songbook & Sheet Lyrics</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              We provide printed and digital copies of all our protest songs, rounds, and chants so newcomers can sing along right from day one.
            </p>
          </div>
          <a
            href="mailto:contact@indivisiblefairoaks.org?subject=Choir%20Songbook%20Request"
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 shadow-md"
          >
            <Download size={16} />
            <span>Request Digital Songbook</span>
          </a>
        </div>

        {/* Join CTA */}
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <h3 className="text-2xl font-black text-white">Ready to Sing With Us?</h3>
          <p className="text-slate-300 text-sm max-w-lg mx-auto">
            You don&apos;t need to be a trained musician. If you have a heart for justice and a voice to lend, you belong in our choir.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <a
              href="mailto:contact@indivisiblefairoaks.org?subject=Joining%20the%20Resistance%20Choir"
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
            >
              <Mail size={16} />
              <span>Email Choir Director</span>
            </a>
            <Link
              href="/events"
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-all"
            >
              View Calendar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
