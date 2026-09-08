import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  FileText,
  Heart,
  Mail,
  MapPin,
  Megaphone,
  Music,
  Shield,
  Sparkles,
  Users,
  Vote,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { GalleryClientPhoto } from '@/app/gallery/GalleryClient';
import { HeroPhotoFrame } from '@/components/home/HeroPhotoFrame';
import { HomeGalleryPreview } from '@/components/home/HomeGalleryPreview';
import { ChoirAudioPlayer } from '@/components/ui/ChoirAudioPlayer';
import type { TickerItem } from '@/components/ui/CivicActionTicker';
import { CivicActionTicker } from '@/components/ui/CivicActionTicker';
import { VgpuCivicAtmosphere } from '@/components/ui/VgpuCivicAtmosphere';
import { getEvents, getGalleryPhotos } from '@/lib/queries/civic';
import { getStorageUrl } from '@/lib/supabase';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  title: 'Indivisible Fair Oaks-Carmichael | Defending Democracy Together',
  description:
    'Join Indivisible Fair Oaks-Carmichael. We are a local grassroots chapter committed to resisting authoritarianism, defending democracy, and organizing our community.',
  openGraph: {
    title: 'Indivisible Fair Oaks-Carmichael | Defending Democracy Together',
    description:
      'Cultivating a non-violent grassroots movement in Fair Oaks and Carmichael to stop authoritarianism and protect democratic norms.',
    url: 'https://indivisiblefairoaks.org',
    siteName: 'Indivisible Fair Oaks-Carmichael',
    locale: 'en_US',
    type: 'website',
  },
};

export default async function HomePage() {
  // Single server-side fetch, shared across HeroPhotoFrame and HomeGalleryPreview.
  // Cached via cacheTag('gallery') / cacheLife('hours') in getGalleryPhotos().
  const [galleryRows, events] = await Promise.all([getGalleryPhotos(), getEvents()]);
  const galleryPhotos: GalleryClientPhoto[] = galleryRows.map((row) => ({
    id: String(row.id),
    url: getStorageUrl(row.storage_path),
    alt: row.alt || row.caption,
    caption: row.caption,
    location: row.location,
    category: row.category,
    signQuote: row.sign_quote,
    date: row.date_label,
    photographer: row.photographer,
    is_hero: row.is_hero,
    is_pair: row.is_pair,
  }));

  // Map upcoming events → ticker items. Filter to events that haven't ended yet,
  // cap at 5 so the ticker doesn't overflow on small screens.
  const now = new Date().toISOString();
  const tickerItems: TickerItem[] = events
    .filter((e) => !e.isoDateEnd || e.isoDateEnd >= now.replace(/[-:]/g, '').slice(0, 15))
    .slice(0, 5)
    .map((e) => ({
      label: e.title,
      detail: `${e.dateLabel} • ${e.timeLabel}`,
      href: '/events',
      badge: e.category,
    }));

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section with VGPU Dynamic Civic Atmosphere */}
      <section className="relative overflow-hidden bg-slate-950 text-white w-full min-h-screen pt-28 pb-20 md:pt-36 md:pb-28">
        {/* VGPU WebGPU Background Atmosphere */}
        <VgpuCivicAtmosphere intensity={1.0} />

        <div className="px-4 sm:px-6 lg:px-8 lg:max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16 items-center">
            {/* Left — copy & CTAs */}
            <div className="max-w-full md:max-w-2xl lg:max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-md">
                <Sparkles size={14} className="text-amber-400" />
                <span>Sacramento County Grassroots Action</span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] mb-6 drop-shadow-sm">
                Democracy is not a spectator sport.
              </h1>

              <p className="text-lg sm:text-xl text-slate-200 leading-relaxed mb-8 drop-shadow-sm">
                We are{' '}
                <strong className="text-white font-extrabold">
                  Indivisible Fair Oaks-Carmichael
                </strong>
                . We organize residents in and near Fair Oaks and Carmichael, California, to
                cultivate a disciplined, non-violent grassroots movement that defends democratic
                norms and builds progressive power.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/events"
                  className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm uppercase tracking-wider shadow-lg hover:shadow-blue-500/30 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Upcoming Actions</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/donate"
                  className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm uppercase tracking-wider shadow-lg hover:shadow-amber-500/30 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Heart size={16} className="fill-slate-950" />
                  <span>Support Our Chapter</span>
                </Link>
                <Link
                  href="/choir"
                  className="px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 backdrop-blur-md font-semibold text-sm transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Music size={16} className="text-blue-400" />
                  <span>Resistance Choir</span>
                </Link>
              </div>

              {/* 10x Pro Chapter Impact Metrics */}
              <div className="mt-14 pt-8 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-6 backdrop-blur-sm">
                <div className="p-3 rounded-xl bg-slate-950/40 border border-white/5">
                  <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    500+
                  </div>
                  <div className="text-xs text-slate-400 font-medium mt-0.5">Active Neighbors</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/40 border border-white/5">
                  <div className="text-2xl sm:text-3xl font-black text-blue-400 tracking-tight">
                    4,200+
                  </div>
                  <div className="text-xs text-slate-400 font-medium mt-0.5">Postcards Written</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/40 border border-white/5">
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
                    100%
                  </div>
                  <div className="text-xs text-slate-400 font-medium mt-0.5">Grassroots Funded</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/40 border border-white/5">
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                    CA-03 / 06
                  </div>
                  <div className="text-xs text-slate-400 font-medium mt-0.5">Sacramento Region</div>
                </div>
              </div>
            </div>

            {/* Right — community photo frame */}
            <HeroPhotoFrame photos={galleryPhotos} />
          </div>
        </div>
      </section>

      {/* Live Civic Action Ticker */}
      <CivicActionTicker items={tickerItems} />

      {/* Urgent Community Gathering Alert Card */}
      <section className="bg-slate-900 border-b border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-r from-blue-900/60 via-slate-800 to-indigo-950/60 border border-blue-500/30 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-amber-400 shrink-0 mt-1">
                <Calendar size={26} />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold uppercase tracking-wide mb-1">
                  Next Community Gathering
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Monthly Chapter Meeting & Food Drive
                </h2>
                <p className="text-sm text-slate-300 mt-1 flex flex-wrap items-center gap-y-1 gap-x-4">
                  <span className="font-semibold text-white">
                    Tuesday, September 1 • 6:30 PM – 8:00 PM
                  </span>
                  <span className="text-slate-400 flex items-center gap-1">
                    <MapPin size={14} className="text-amber-400" />
                    St. Michael&#39;s Episcopal Church, 2140 Mission Ave, Carmichael
                  </span>
                </p>
                <p className="text-xs text-amber-200/90 mt-2">
                  🥫 <strong>Food Bank Drive:</strong> Please bring a can or box of non-perishable
                  food to support our local community food pantry.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
              <a
                href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=Indivisible+Fair+Oaks-Carmichael+Monthly+Meeting&dates=20260901T183000/20260901T200000&details=Monthly+community+gathering+and+food+drive.+Bring+non-perishable+food+for+the+local+food+bank.&location=St.+Michael%27s+Episcopal+Church%2C+2140+Mission+Ave%2C+Carmichael%2C+CA"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto text-center px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs uppercase tracking-wider transition-all"
              >
                + Add to Calendar
              </a>
              <a
                href="https://www.mobilize.us/indivisible/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto text-center px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md hover:scale-105"
              >
                RSVP via Mobilize
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Four Pillars / Mission Section */}
      <section className="py-16 md:py-24 bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-amber-400 text-xs font-black uppercase tracking-widest block mb-2">
              Our Core Principles
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
              What We Stand For & How We Win
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              Rooted in the national Indivisible Guide, our local chapter works tirelessly across
              the Sacramento region to defend our constitutional democracy through grassroots
              mobilization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-blue-900/40 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Stop Authoritarianism</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Countering anti-democratic overreach, defending executive accountability, and
                raising public alarm through visible resistance.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-blue-900/40 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Vote size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Defend Democratic Norms</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Safeguarding free and fair elections, expanding voting access, educating youth
                voters, and standing up for civil liberties.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-blue-900/40 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Megaphone size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Elect Bold Leaders</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Direct voter canvassing, phone banks, candidate accountability, and mobilizing
                high-turnout civic engagement in every cycle.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-blue-900/40 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Secure Progressive Policy</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Advocating for justice, reproductive autonomy, climate resilience, and economic
                equity through community solidarity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Carmichael Resistance Choir Spotlight */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white border-t border-slate-850">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wide">
                <Music size={14} className="text-amber-400" />
                <span>Carmichael Resistance Choir</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                Every good protest movement needs music.
              </h2>
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
                Music lifts us up and has sustained justice movements throughout history. We gather
                to weave our voices together in chants and songs of resistance, building vibrant
                community while marching forward.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-850/70 border border-slate-700/60">
                  <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <span className="font-bold text-white text-sm block">All Voices Welcome</span>
                    <span className="text-xs text-slate-400">
                      No auditions, no fees. Everyone can sing.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-850/70 border border-slate-700/60">
                  <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <span className="font-bold text-white text-sm block">Rehearsal Schedule</span>
                    <span className="text-xs text-slate-400">
                      Every other Wednesday, 6:30 – 8:00 PM.
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <Link
                  href="/choir"
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg"
                >
                  <span>Choir Details & Video</span>
                  <ArrowRight size={14} />
                </Link>
                <a
                  href="https://www.mobilize.us/indivisible/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-all"
                >
                  Register via Mobilize
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Protest In Song
                  </span>
                  <span className="text-[11px] text-slate-400">Fair Oaks Blvd & Manzanita Ave</span>
                </div>
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 mb-4 relative">
                  <iframe
                    className="w-full h-full"
                    src="https://www.youtube.com/embed/BhdjDlRUMUw"
                    title="Carmichael Resistance Choir singing demonstration"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <p className="text-xs text-slate-400 italic mb-6">
                  &ldquo;We will sing our protest to the afternoon rush hour and community
                  businesses. Bring your signs, chairs, and voices!&rdquo;
                </p>

                {/* Interactive Soundboard */}
                <ChoirAudioPlayer />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Voter Resources Spotlight */}
      <section className="py-16 md:py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <span className="text-amber-400 text-xs font-black uppercase tracking-widest block mb-2">
                Empowering Every Voter
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                Voter Education & Rights Hub
              </h2>
            </div>
            <Link
              href="/voter-info"
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider"
            >
              <span>View All 7 Voter Guides</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center mb-4">
                  <FileText size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Sacramento County Elected Officials
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Direct contact information, phone numbers, and offices for local, state, and
                  federal representatives serving our district.
                </p>
              </div>
              <Link
                href="/voter-info"
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
              >
                <span>Access Guide & Directory</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center mb-4">
                  <Vote size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Pre-Registration at 16</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  California youth age 16 and 17 can pre-register now so they are automatically
                  registered to cast their ballot the day they turn 18.
                </p>
              </div>
              <Link
                href="/voter-info"
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
              >
                <span>Youth Voting Guide</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center mb-4">
                  <Shield size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Rights Restoration & Unhoused Voting
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Homeless is not voteless. Learn about voting rights restoration for formerly
                  incarcerated Californians and unhoused residents.
                </p>
              </div>
              <Link
                href="/voter-info"
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
              >
                <span>Read Rights Overview</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Community Photojournalism / Moments of Resistance Preview */}
      <HomeGalleryPreview photos={galleryPhotos} />

      {/* Non-violent Action Commitment Banner */}
      <section className="bg-slate-950 py-12 border-t border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mb-1">
            <Shield size={24} />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Our Core Commitment: Disciplined Non-Violent Action
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            A core principle behind all Indivisible events is an unwavering commitment to nonviolent
            action. We expect all participants to act lawfully, avoid civil disobedience unless
            specifically planned and coordinated, de-escalate any potential confrontation with those
            who disagree with our values, and maintain peaceful solidarity.
          </p>
        </div>
      </section>

      {/* Support & Donation CTA */}
      <section className="py-16 md:py-20 bg-gradient-to-tr from-blue-900 via-slate-900 to-indigo-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-amber-400 text-xs font-black uppercase tracking-widest block">
            Grassroots Power Runs On Grassroots Support
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Fuel Our Local Organizing
          </h2>
          <p className="text-slate-300 text-base max-w-2xl mx-auto leading-relaxed">
            Every dollar contributed to our chapter directly supports community meeting spaces,
            protest banners, sound equipment for the Resistance Choir, voter registration printing,
            and neighborhood outreach.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link
              href="/donate"
              className="px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Heart size={18} className="fill-slate-950" />
              <span>Donate via ActBlue</span>
            </Link>
            <a
              href="mailto:subscribe@indivisiblefairoaks.org"
              className="px-8 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-sm uppercase tracking-wider transition-all flex items-center gap-2"
            >
              <Mail size={18} className="text-blue-400" />
              <span>Join Mailing List</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
