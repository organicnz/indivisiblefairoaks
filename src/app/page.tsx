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
import { CopyRegion } from '@/components/cms/CopyRegion';
import { HeroPhotoFrame } from '@/components/home/HeroPhotoFrame';
import { HomeGalleryPreview } from '@/components/home/HomeGalleryPreview';
import { ChoirAudioPlayer } from '@/components/ui/ChoirAudioPlayer';
import type { TickerItem } from '@/components/ui/CivicActionTicker';
import { CivicActionTicker } from '@/components/ui/CivicActionTicker';
import { DataPoint } from '@/components/ui/DataPoint';
import { VgpuCivicAtmosphere } from '@/components/ui/VgpuCivicAtmosphere';
import { gatheringCard, selectMeetingEvent } from '@/lib/civic-events';
import { getDataPoints, getEvents, getGalleryPhotos } from '@/lib/queries/civic';
import { getStorageUrl } from '@/lib/supabase';
import type { GalleryPhotoView } from '@/types/gallery';

// NOTE: `page.tsx` and the root `layout.tsx` are the *same* App Router segment,
// and Next does not apply a segment's own `title.template` to that segment. The
// homepage therefore supplies an absolute title rather than a bare one.
export const metadata: Metadata = pageMetadata({
  title: 'Indivisible Fair Oaks-Carmichael | Grassroots Democracy in Action',
  description:
    'Join Indivisible Fair Oaks-Carmichael. We are a local grassroots chapter committed to resisting authoritarianism, defending democracy, and organizing our community.',
  path: '/',
});

export default async function HomePage() {
  // Server-side fetches cached via cacheTag and cacheLife('hours') in queries/civic.ts
  const [galleryRows, events, dataPoints] = await Promise.all([
    getGalleryPhotos(),
    getEvents(),
    getDataPoints('home'),
  ]);
  const galleryPhotos: GalleryPhotoView[] = galleryRows.map((row) => ({
    id: String(row.id),
    dbId: row.id,
    slug: row.slug,
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

  // Map upcoming events → ticker items. Show all events (date filtering is done
  // in the query; no runtime Date needed, keeping this page statically prerenderable).
  // Cap at 5 so the ticker doesn't overflow on small screens.
  const tickerItems: TickerItem[] = events.slice(0, 5).map((e) => ({
    label: e.title,
    detail: `${e.dateLabel} • ${e.timeLabel}`,
    href: '/events',
    badge: e.category,
  }));

  // Dynamic gathering card (issue #37): the meeting row drives the alert card,
  // so the events table — not JSX — is where the next meeting gets updated.
  const card = gatheringCard(selectMeetingEvent(events));

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section with VGPU Dynamic Civic Atmosphere */}
      <section className="relative overflow-hidden bg-secondary text-white w-full min-h-screen pt-28 pb-20 md:pt-36 md:pb-28">
        {/* VGPU WebGPU Background Atmosphere */}
        <VgpuCivicAtmosphere intensity={1.0} />

        <div className="px-4 sm:px-6 lg:px-8 lg:max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16 items-center">
            {/* Left — copy & CTAs. Wrapped in a copy region so the chapter can
                rewrite the headline, the mission paragraph and the metrics from
                the visual editor; the JSX below is the fallback until they do. */}
            <CopyRegion id="home-hero">
              <div className="max-w-full md:max-w-2xl lg:max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-bright/15 border border-primary-on-dark-muted/30 text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-md">
                  <Sparkles size={14} className="text-accent-gold" />
                  <DataPoint name="home.hero.eyebrow" initialData={dataPoints}>
                    Sacramento County Grassroots Action
                  </DataPoint>
                </div>

                <DataPoint
                  name="home.hero.headline"
                  as="h1"
                  initialData={dataPoints}
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] mb-6 drop-shadow-sm"
                >
                  Democracy is not a spectator sport.
                </DataPoint>

                <DataPoint
                  name="home.hero.mission"
                  as="p"
                  initialData={dataPoints}
                  className="text-lg sm:text-xl text-ink-on-dark leading-relaxed mb-8 drop-shadow-sm"
                >
                  The mission of the Fair Oaks-Carmichael chapter of Indivisible is to cultivate a
                  non-violent grassroots movement to stop the rise of authoritarianism, to support
                  and defend democratic norms, elect bold leaders, and secure progressive policies.
                </DataPoint>

                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    href="/events"
                    className="px-6 py-3.5 rounded-xl bg-primary-bright hover:bg-primary-light text-white font-bold text-sm uppercase tracking-wider shadow-lg hover:shadow-blue-500/30 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <DataPoint as="span" name="home.hero.btn_actions" initialData={dataPoints}>
                      Upcoming Actions
                    </DataPoint>
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/donate"
                    className="px-6 py-3.5 rounded-xl bg-accent-gold hover:brightness-105 text-secondary font-bold text-sm uppercase tracking-wider shadow-lg hover:shadow-amber-500/30 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Heart size={16} className="fill-secondary" />
                    <DataPoint as="span" name="home.hero.btn_support" initialData={dataPoints}>
                      Support Our Chapter
                    </DataPoint>
                  </Link>
                  <Link
                    href="/choir"
                    className="px-6 py-3.5 rounded-xl bg-secondary/80 hover:bg-white/10 text-ink-on-dark border border-white/15 backdrop-blur-md font-semibold text-sm transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Music size={16} className="text-primary-on-dark-muted" />
                    <DataPoint as="span" name="home.hero.btn_choir" initialData={dataPoints}>
                      Resistance Choir
                    </DataPoint>
                  </Link>
                </div>

                {/* 10x Pro Chapter Impact Metrics */}
                <div className="mt-14 pt-8 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-6 backdrop-blur-sm">
                  <div className="p-3 rounded-xl bg-secondary/40 border border-white/5">
                    <DataPoint
                      name="home.impact.neighbors"
                      as="div"
                      initialData={dataPoints}
                      className="text-2xl sm:text-3xl font-black text-white tracking-tight"
                    >
                      500+
                    </DataPoint>
                    <DataPoint
                      name="home.impact.neighbors_label"
                      as="div"
                      initialData={dataPoints}
                      className="text-xs text-ink-muted-on-dark font-medium mt-0.5"
                    >
                      Active Neighbors
                    </DataPoint>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/40 border border-white/5">
                    <DataPoint
                      name="home.impact.postcards"
                      as="div"
                      initialData={dataPoints}
                      className="text-2xl sm:text-3xl font-black text-primary-on-dark-muted tracking-tight"
                    >
                      4,200+
                    </DataPoint>
                    <DataPoint
                      name="home.impact.postcards_label"
                      as="div"
                      initialData={dataPoints}
                      className="text-xs text-ink-muted-on-dark font-medium mt-0.5"
                    >
                      Postcards Written
                    </DataPoint>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/40 border border-white/5">
                    <DataPoint
                      name="home.impact.funding"
                      as="div"
                      initialData={dataPoints}
                      className="text-2xl sm:text-3xl font-black text-accent-gold tracking-tight"
                    >
                      100%
                    </DataPoint>
                    <DataPoint
                      name="home.impact.funding_label"
                      as="div"
                      initialData={dataPoints}
                      className="text-xs text-ink-muted-on-dark font-medium mt-0.5"
                    >
                      Grassroots Funded
                    </DataPoint>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/40 border border-white/5">
                    <DataPoint
                      name="home.impact.districts"
                      as="div"
                      initialData={dataPoints}
                      className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight"
                    >
                      CA-03 / 06
                    </DataPoint>
                    <DataPoint
                      name="home.impact.districts_label"
                      as="div"
                      initialData={dataPoints}
                      className="text-xs text-ink-muted-on-dark font-medium mt-0.5"
                    >
                      Sacramento Region
                    </DataPoint>
                  </div>
                </div>
              </div>
            </CopyRegion>

            {/* Right — community photo frame */}
            <HeroPhotoFrame photos={galleryPhotos} />
          </div>
        </div>
      </section>

      {/* Live Civic Action Ticker */}
      <CivicActionTicker items={tickerItems} />

      {/* Urgent Community Gathering Alert Card */}
      {/* Light section: breaks the dark hero run so the page alternates instead
          of stacking navy bands. Icon tile stays dark navy with a bright icon —
          the house rule for light sections, so contrast needs no re-measuring.
          Content is dynamic (issue #37): title, date, location and links come
          from the `events` table via `gatheringCard`, so updating the row moves
          this card with no deploy. The food-drive note stays static — it is
          meeting policy, not event data. */}
      <section className="bg-background border-b border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-surface-muted border border-border p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-card">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-accent-gold shrink-0 mt-1">
                <Calendar size={26} />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-accent-gold/15 border border-accent-gold/40 text-secondary dark:text-accent-gold text-[11px] font-bold uppercase tracking-wide mb-1">
                  <DataPoint as="span" name="home.gathering.badge" initialData={dataPoints}>
                    Next Community Gathering
                  </DataPoint>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-foreground">{card.title}</h2>
                <p className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-y-1 gap-x-4">
                  <span className="font-semibold text-foreground">{card.dateLine}</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={14} className="text-accent" />
                    {card.locationLine}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  🥫 <strong className="text-foreground">Food Bank Drive:</strong>{' '}
                  <DataPoint name="home.gathering.food_bank" initialData={dataPoints}>
                    Please bring a can or box of non-perishable food to support our local community
                    food pantry.
                  </DataPoint>
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
              <a
                href={card.calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto text-center px-4 py-3 rounded-xl border-2 border-secondary text-foreground hover:bg-secondary hover:text-white dark:border-border font-semibold text-xs uppercase tracking-wider transition-all"
              >
                <DataPoint as="span" name="home.gathering.btn_cal" initialData={dataPoints}>
                  + Add to Calendar
                </DataPoint>
              </a>
              <a
                href={card.rsvpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto text-center px-6 py-3 rounded-xl bg-accent-gold hover:bg-accent-gold text-secondary font-bold text-xs uppercase tracking-wider transition-all shadow-md hover:scale-105"
              >
                <DataPoint as="span" name="home.gathering.btn_rsvp" initialData={dataPoints}>
                  RSVP via Mobilize
                </DataPoint>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Four Pillars / Mission Section */}
      {/* Light section: white cards on surface-muted keep the page alternating.
          Eyebrows use primary-ink (accent-gold is 2.15:1 on white — surface only).
          Copy region: the heading, intro and four cards are CMS-editable. */}
      <section className="py-16 md:py-24 bg-surface-muted text-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <CopyRegion id="home-pillars">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <DataPoint
                name="home.pillars.eyebrow"
                as="span"
                initialData={dataPoints}
                className="text-primary-ink dark:text-accent-gold text-xs font-black uppercase tracking-widest block mb-2"
              >
                Our Core Principles
              </DataPoint>
              <DataPoint
                name="home.pillars.headline"
                as="h2"
                initialData={dataPoints}
                className="text-3xl sm:text-4xl font-black tracking-tight mb-4"
              >
                What We Stand For & How We Win
              </DataPoint>
              <DataPoint
                name="home.pillars.intro"
                as="p"
                initialData={dataPoints}
                className="text-muted-foreground text-base leading-relaxed"
              >
                Rooted in the national Indivisible Guide, our local chapter works tirelessly across
                the Sacramento region to defend our constitutional democracy through grassroots
                mobilization.
              </DataPoint>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 shadow-card hover:border-primary/40 dark:hover:border-primary-bright/50 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-secondary dark:bg-slate-800 text-primary-on-dark-muted flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Shield size={24} />
                </div>
                <DataPoint
                  name="home.pillars.p1_title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-bold text-foreground mb-2"
                >
                  Stop Authoritarianism
                </DataPoint>
                <DataPoint
                  name="home.pillars.p1_desc"
                  as="p"
                  initialData={dataPoints}
                  className="text-sm text-muted-foreground leading-relaxed"
                >
                  Countering anti-democratic overreach, defending executive accountability, and
                  raising public alarm through visible resistance.
                </DataPoint>
              </div>

              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 shadow-card hover:border-primary/40 dark:hover:border-primary-bright/50 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-secondary dark:bg-slate-800 text-accent-gold flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Vote size={24} />
                </div>
                <DataPoint
                  name="home.pillars.p2_title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-bold text-foreground mb-2"
                >
                  Defend Democratic Norms
                </DataPoint>
                <DataPoint
                  name="home.pillars.p2_desc"
                  as="p"
                  initialData={dataPoints}
                  className="text-sm text-muted-foreground leading-relaxed"
                >
                  Safeguarding free and fair elections, expanding voting access, educating youth
                  voters, and standing up for civil liberties.
                </DataPoint>
              </div>

              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 shadow-card hover:border-primary/40 dark:hover:border-primary-bright/50 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-secondary dark:bg-slate-800 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Megaphone size={24} />
                </div>
                <DataPoint
                  name="home.pillars.p3_title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-bold text-foreground mb-2"
                >
                  Elect Bold Leaders
                </DataPoint>
                <DataPoint
                  name="home.pillars.p3_desc"
                  as="p"
                  initialData={dataPoints}
                  className="text-sm text-muted-foreground leading-relaxed"
                >
                  Direct voter canvassing, phone banks, candidate accountability, and mobilizing
                  high-turnout civic engagement in every cycle.
                </DataPoint>
              </div>

              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 shadow-card hover:border-primary/40 dark:hover:border-primary-bright/50 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-secondary dark:bg-slate-800 text-primary-on-dark flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users size={24} />
                </div>
                <DataPoint
                  name="home.pillars.p4_title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-bold text-foreground mb-2"
                >
                  Secure Progressive Policy
                </DataPoint>
                <DataPoint
                  name="home.pillars.p4_desc"
                  as="p"
                  initialData={dataPoints}
                  className="text-sm text-muted-foreground leading-relaxed"
                >
                  Advocating for justice, reproductive autonomy, climate resilience, and economic
                  equity through community solidarity.
                </DataPoint>
              </div>
            </div>
          </CopyRegion>
        </div>
      </section>

      {/* Carmichael Resistance Choir Spotlight */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-bright/20 text-primary-on-dark text-xs font-bold uppercase tracking-wide">
                <Music size={14} className="text-accent-gold" />
                <DataPoint name="home.choir.eyebrow" initialData={dataPoints}>
                  Carmichael Resistance Choir
                </DataPoint>
              </div>
              <DataPoint
                name="home.choir.headline"
                as="h2"
                initialData={dataPoints}
                className="text-3xl sm:text-4xl font-black tracking-tight"
              >
                Every good protest movement needs music.
              </DataPoint>
              <DataPoint
                name="home.choir.intro"
                as="p"
                initialData={dataPoints}
                className="text-base sm:text-lg text-ink-on-dark leading-relaxed"
              >
                Music lifts us up and has sustained justice movements throughout history. We gather
                to weave our voices together in chants and songs of resistance, building vibrant
                community while marching forward.
              </DataPoint>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <DataPoint
                      name="home.choir.all_voices"
                      as="span"
                      initialData={dataPoints}
                      className="font-bold text-white text-sm block"
                    >
                      All Voices Welcome
                    </DataPoint>
                    <DataPoint
                      name="home.choir.all_voices_sub"
                      as="span"
                      initialData={dataPoints}
                      className="text-xs text-ink-muted-on-dark"
                    >
                      No auditions, no fees. Everyone can sing.
                    </DataPoint>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <DataPoint
                      name="home.choir.rehearsal"
                      as="span"
                      initialData={dataPoints}
                      className="font-bold text-white text-sm block"
                    >
                      Rehearsal Schedule
                    </DataPoint>
                    <DataPoint
                      name="home.choir.rehearsal_sub"
                      as="span"
                      initialData={dataPoints}
                      className="text-xs text-ink-muted-on-dark"
                    >
                      Every other Wednesday, 6:30 – 8:00 PM.
                    </DataPoint>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <Link
                  href="/choir"
                  className="px-6 py-3 rounded-xl bg-primary-bright hover:bg-primary-light text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg"
                >
                  <span>Choir Details & Video</span>
                  <ArrowRight size={14} />
                </Link>
                <a
                  href="https://www.mobilize.us/indivisible/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-ink-on-dark border border-white/15 font-bold text-xs uppercase tracking-wider transition-all"
                >
                  Register via Mobilize
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl overflow-hidden border border-white/10 bg-secondary shadow-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black uppercase tracking-wider text-accent-gold">
                    Protest In Song
                  </span>
                  <span className="text-[11px] text-ink-muted-on-dark">
                    Fair Oaks Blvd & Manzanita Ave
                  </span>
                </div>
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-secondary mb-4 relative">
                  <iframe
                    className="w-full h-full"
                    src="https://www.youtube.com/embed/BhdjDlRUMUw"
                    title="Carmichael Resistance Choir singing demonstration"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <p className="text-xs text-ink-muted-on-dark italic mb-6">
                  &ldquo;
                  <DataPoint name="home.choir.quote" initialData={dataPoints}>
                    We will sing our protest to the afternoon rush hour and community businesses.
                    Bring your signs, chairs, and voices!
                  </DataPoint>
                  &rdquo;
                </p>

                {/* Interactive Soundboard */}
                <ChoirAudioPlayer />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Voter Resources Spotlight */}
      {/* Light section: white cards on white need a visible border — border-border
          plus shadow-card carries the separation instead of a tinted surface. */}
      <section className="py-16 md:py-24 bg-background text-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <DataPoint
                name="home.voter.eyebrow"
                as="span"
                initialData={dataPoints}
                className="text-primary-ink dark:text-accent-gold text-xs font-black uppercase tracking-widest block mb-2"
              >
                Empowering Every Voter
              </DataPoint>
              <DataPoint
                name="home.voter.headline"
                as="h2"
                initialData={dataPoints}
                className="text-3xl sm:text-4xl font-black tracking-tight"
              >
                Voter Education & Rights Hub
              </DataPoint>
            </div>
            <Link
              href="/voter-info"
              className="inline-flex items-center gap-2 text-sm font-bold text-primary-ink dark:text-primary-on-dark hover:text-primary-dark dark:hover:text-primary-on-dark-muted transition-colors uppercase tracking-wider"
            >
              <DataPoint as="span" name="home.voter.view_all" initialData={dataPoints}>
                View All 7 Voter Guides
              </DataPoint>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <CopyRegion id="home-voter-hub">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 shadow-card hover:border-primary/40 dark:hover:border-primary-bright/50 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-secondary dark:bg-slate-800 text-primary-on-dark-muted flex items-center justify-center mb-4">
                    <FileText size={20} />
                  </div>
                  <DataPoint
                    name="home.voter.card1_title"
                    as="h3"
                    initialData={dataPoints}
                    className="text-lg font-bold text-foreground mb-2"
                  >
                    Sacramento County Elected Officials
                  </DataPoint>
                  <DataPoint
                    name="home.voter.card1_desc"
                    as="p"
                    initialData={dataPoints}
                    className="text-xs text-muted-foreground leading-relaxed mb-4"
                  >
                    Direct contact information, phone numbers, and offices for local, state, and
                    federal representatives serving our district.
                  </DataPoint>
                </div>
                <Link
                  href="/voter-info"
                  className="text-xs font-bold text-primary-ink dark:text-primary-on-dark hover:text-primary-dark dark:hover:text-primary-on-dark-muted flex items-center gap-1.5"
                >
                  <DataPoint as="span" name="home.voter.card1_btn" initialData={dataPoints}>
                    Access Guide &amp; Directory
                  </DataPoint>
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 shadow-card hover:border-primary/40 dark:hover:border-primary-bright/50 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-secondary dark:bg-slate-800 text-accent-gold flex items-center justify-center mb-4">
                    <Vote size={20} />
                  </div>
                  <DataPoint
                    name="home.voter.card2_title"
                    as="h3"
                    initialData={dataPoints}
                    className="text-lg font-bold text-foreground mb-2"
                  >
                    Pre-Registration at 16
                  </DataPoint>
                  <DataPoint
                    name="home.voter.card2_desc"
                    as="p"
                    initialData={dataPoints}
                    className="text-xs text-muted-foreground leading-relaxed mb-4"
                  >
                    California youth age 16 and 17 can pre-register now so they are automatically
                    registered to cast their ballot the day they turn 18.
                  </DataPoint>
                </div>
                <Link
                  href="/voter-info"
                  className="text-xs font-bold text-primary-ink dark:text-primary-on-dark hover:text-primary-dark dark:hover:text-primary-on-dark-muted flex items-center gap-1.5"
                >
                  <DataPoint as="span" name="home.voter.card2_btn" initialData={dataPoints}>
                    Youth Voting Guide
                  </DataPoint>
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 shadow-card hover:border-primary/40 dark:hover:border-primary-bright/50 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-secondary dark:bg-slate-800 text-emerald-400 flex items-center justify-center mb-4">
                    <Shield size={20} />
                  </div>
                  <DataPoint
                    name="home.voter.card3_title"
                    as="h3"
                    initialData={dataPoints}
                    className="text-lg font-bold text-foreground mb-2"
                  >
                    Rights Restoration &amp; Unhoused Voting
                  </DataPoint>
                  <DataPoint
                    name="home.voter.card3_desc"
                    as="p"
                    initialData={dataPoints}
                    className="text-xs text-muted-foreground leading-relaxed mb-4"
                  >
                    Homeless is not voteless. Learn about voting rights restoration for formerly
                    incarcerated Californians and unhoused residents.
                  </DataPoint>
                </div>
                <Link
                  href="/voter-info"
                  className="text-xs font-bold text-primary-ink dark:text-primary-on-dark hover:text-primary-dark dark:hover:text-primary-on-dark-muted flex items-center gap-1.5"
                >
                  <DataPoint as="span" name="home.voter.card3_btn" initialData={dataPoints}>
                    Read Rights Overview
                  </DataPoint>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </CopyRegion>
        </div>
      </section>

      {/* Community Photojournalism / Moments of Resistance Preview */}
      <HomeGalleryPreview photos={galleryPhotos} dataPoints={dataPoints} />

      {/* Non-violent Action Commitment Banner */}
      {/* Light section: the dark tile keeps the emerald icon at full contrast. */}
      <section className="bg-surface-muted py-12 border-t border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary text-emerald-400 mb-1">
            <Shield size={24} />
          </div>
          <DataPoint
            name="home.nonviolence.headline"
            as="h2"
            initialData={dataPoints}
            className="text-2xl font-black text-foreground tracking-tight"
          >
            Our Core Commitment: Disciplined Non-Violent Action
          </DataPoint>
          <DataPoint
            name="home.nonviolence.desc"
            as="p"
            initialData={dataPoints}
            className="text-sm text-muted-foreground leading-relaxed"
          >
            A core principle behind all Indivisible events is an unwavering commitment to nonviolent
            action. We expect all participants to act lawfully, avoid civil disobedience unless
            specifically planned and coordinated, de-escalate any potential confrontation with those
            who disagree with our values, and maintain peaceful solidarity.
          </DataPoint>
        </div>
      </section>

      {/* Support & Donation CTA */}
      <section className="py-16 md:py-20 bg-gradient-to-tr from-blue-900 via-slate-900 to-indigo-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <DataPoint
            name="home.cta.eyebrow"
            as="span"
            initialData={dataPoints}
            className="text-accent-gold text-xs font-black uppercase tracking-widest block"
          >
            Grassroots Power Runs On Grassroots Support
          </DataPoint>
          <DataPoint
            name="home.cta.headline"
            as="h2"
            initialData={dataPoints}
            className="text-3xl sm:text-4xl font-black tracking-tight"
          >
            Fuel Our Local Organizing
          </DataPoint>
          <DataPoint
            name="home.cta.desc"
            as="p"
            initialData={dataPoints}
            className="text-ink-on-dark text-base max-w-2xl mx-auto leading-relaxed"
          >
            Every dollar contributed to our chapter directly supports community meeting spaces,
            protest banners, sound equipment for the Resistance Choir, voter registration printing,
            and neighborhood outreach.
          </DataPoint>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link
              href="/donate"
              className="px-8 py-4 rounded-xl bg-accent-gold hover:brightness-105 text-secondary font-black text-sm uppercase tracking-wider shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Heart size={18} className="fill-secondary" />
              <DataPoint as="span" name="home.cta.btn_donate" initialData={dataPoints}>
                Donate via ActBlue
              </DataPoint>
            </Link>
            <a
              href="mailto:subscribe@indivisiblefairoaks.org"
              className="px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/15 font-bold text-sm uppercase tracking-wider transition-all flex items-center gap-2"
            >
              <Mail size={18} className="text-primary-on-dark-muted" />
              <DataPoint as="span" name="home.cta.btn_subscribe" initialData={dataPoints}>
                Join Mailing List
              </DataPoint>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

import { pageMetadata } from '@/lib/metadata';
