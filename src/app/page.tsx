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
import { LiteYouTube } from '@/components/ui/LiteYouTube';
import type { TickerItem } from '@/components/ui/CivicActionTicker';
import { CivicActionTicker } from '@/components/ui/CivicActionTicker';
import { DataPoint } from '@/components/ui/DataPoint';
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
    <div className="civic-page flex w-full flex-col">
      {/* Hero. Editorial broadsheet rather than a gradient landing page: rule,
          serif display, one clear action hierarchy, and a photographed chapter. */}
      <section className="relative w-full overflow-hidden bg-background pt-(--header-clearance) text-foreground">
        <div
          aria-hidden="true"
          className="paper-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent_92%)]"
        />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 md:pb-20 md:pt-14 lg:px-8">
          <div className="grid grid-cols-1 items-end gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left — copy & CTAs. Wrapped in a copy region so the chapter can
                rewrite the headline, mission paragraph and metrics from the visual
                editor; the JSX below is the fallback until they do. */}
            <div className="lg:col-span-7">
              <div>
                <div className="flex items-center justify-between gap-4 border-b border-foreground/20 pb-4">
                  <div className="civic-kicker">
                    <Sparkles size={13} aria-hidden="true" />
                    <DataPoint name="home.hero.eyebrow" initialData={dataPoints}>
                      Sacramento County Grassroots Action
                    </DataPoint>
                  </div>
                  <span className="civic-stamp hidden sm:inline-flex">Fair Oaks · Carmichael, CA</span>
                </div>

                <DataPoint
                  name="home.hero.headline"
                  as="h1"
                  initialData={dataPoints}
                  className="mt-7 max-w-[13ch] font-display text-[clamp(3.2rem,7vw,6.4rem)] font-semibold leading-[0.9] tracking-[-0.055em] text-foreground"
                >
                  Democracy is not a spectator sport.
                </DataPoint>

                <div className="mt-8 max-w-xl border-l-2 border-accent pl-4 sm:pl-5">
                  <DataPoint
                    name="home.hero.mission"
                    as="p"
                    initialData={dataPoints}
                    className="text-base leading-relaxed text-muted-foreground sm:text-lg"
                  >
                    The mission of the Fair Oaks-Carmichael chapter of Indivisible is to cultivate a
                    non-violent grassroots movement to stop the rise of authoritarianism, to support
                    and defend democratic norms, elect bold leaders, and secure progressive policies.
                  </DataPoint>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <Link
                    href="/events"
                    className="inline-flex h-12 items-center gap-2 rounded-sm border border-primary bg-primary px-5 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors duration-300 hover:border-primary-dark hover:bg-primary-dark"
                  >
                    <DataPoint as="span" name="home.hero.btn_actions" initialData={dataPoints}>
                      Upcoming Actions
                    </DataPoint>
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                  <Link
                    href="/donate"
                    className="inline-flex h-12 items-center gap-2 rounded-sm border border-accent-gold bg-accent-gold px-5 text-xs font-bold uppercase tracking-[0.14em] text-ink-strong transition-all duration-300 hover:brightness-95"
                  >
                    <Heart size={15} className="fill-current" aria-hidden="true" />
                    <DataPoint as="span" name="home.hero.btn_support" initialData={dataPoints}>
                      Support Our Chapter
                    </DataPoint>
                  </Link>
                  <Link
                    href="/choir"
                    className="inline-flex h-12 items-center gap-2 border-b border-foreground/30 text-xs font-bold uppercase tracking-[0.14em] text-foreground transition-colors duration-300 hover:border-accent hover:text-accent"
                  >
                    <Music size={15} aria-hidden="true" />
                    <DataPoint as="span" name="home.hero.btn_choir" initialData={dataPoints}>
                      Resistance Choir
                    </DataPoint>
                  </Link>
                </div>

                {/* Impact figures as a printed rule band, not four floating cards. */}
                <div className="mt-12 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
                  <div className="min-w-0 bg-background p-3 sm:p-4">
                    <DataPoint
                      name="home.impact.neighbors"
                      as="div"
                      initialData={dataPoints}
                      className="font-display text-3xl font-semibold leading-none tracking-[-0.03em] text-foreground"
                    >
                      500+
                    </DataPoint>
                    <DataPoint
                      name="home.impact.neighbors_label"
                      as="div"
                      initialData={dataPoints}
                      className="mt-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      Active Neighbors
                    </DataPoint>
                  </div>
                  <div className="min-w-0 bg-background p-3 sm:p-4">
                    <DataPoint
                      name="home.impact.postcards"
                      as="div"
                      initialData={dataPoints}
                      className="font-display text-3xl font-semibold leading-none tracking-[-0.03em] text-primary-ink"
                    >
                      4,200+
                    </DataPoint>
                    <DataPoint
                      name="home.impact.postcards_label"
                      as="div"
                      initialData={dataPoints}
                      className="mt-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      Postcards Written
                    </DataPoint>
                  </div>
                  <div className="min-w-0 bg-background p-3 sm:p-4">
                    <DataPoint
                      name="home.impact.funding"
                      as="div"
                      initialData={dataPoints}
                      className="font-display text-3xl font-semibold leading-none tracking-[-0.03em] text-accent"
                    >
                      100%
                    </DataPoint>
                    <DataPoint
                      name="home.impact.funding_label"
                      as="div"
                      initialData={dataPoints}
                      className="mt-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      Grassroots Funded
                    </DataPoint>
                  </div>
                  <div className="min-w-0 bg-background p-3 sm:p-4">
                    <DataPoint
                      name="home.impact.districts"
                      as="div"
                      initialData={dataPoints}
                      className="font-display text-3xl font-semibold leading-none tracking-[-0.03em] text-foreground"
                    >
                      CA-03 / 06
                    </DataPoint>
                    <DataPoint
                      name="home.impact.districts_label"
                      as="div"
                      initialData={dataPoints}
                      className="mt-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      Sacramento Region
                    </DataPoint>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <HeroPhotoFrame photos={galleryPhotos} initialData={dataPoints} />
            </div>
          </div>
        </div>
      </section>

      {/* Live Civic Action Ticker */}
      <CivicActionTicker items={tickerItems} initialData={dataPoints} />

      {/* Urgent Community Gathering Alert Card */}
      {/* Light section: breaks the dark hero run so the page alternates instead
          of stacking navy bands. Icon tile stays dark navy with a bright icon —
          the house rule for light sections, so contrast needs no re-measuring.
          Content is dynamic (issue #37): title, date, location and links come
          from the `events` table via `gatheringCard`, so updating the row moves
          this card with no deploy. The food-drive note stays static — it is
          meeting policy, not event data. */}
      <section className="border-b border-border bg-background py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 border-l-4 border-accent bg-surface-card px-5 py-6 shadow-card md:flex-row md:items-center md:px-8">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex size-11 shrink-0 items-center justify-center border border-border bg-background text-accent">
                <Calendar size={22} strokeWidth={1.5} />
              </div>
              <div>
                <div className="mb-1 inline-flex items-center gap-2 border-b border-accent pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                  <DataPoint as="span" name="home.gathering.badge" initialData={dataPoints}>
                    Next Community Gathering
                  </DataPoint>
                </div>
                <h2 className="font-display text-2xl font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-3xl">
                  {card.title}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{card.dateLine}</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={14} className="text-accent" />
                    {card.locationLine}
                  </span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  🥫 <strong className="text-foreground">Food Bank Drive:</strong>{' '}
                  <DataPoint name="home.gathering.food_bank" initialData={dataPoints}>
                    Please bring a can or box of non-perishable food to support our local community
                    food pantry.
                  </DataPoint>
                </p>
              </div>
            </div>

            <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:flex-row md:w-auto">
              <a
                href={card.calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full border border-foreground/30 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors duration-300 hover:border-primary hover:text-primary sm:w-auto"
              >
                <DataPoint as="span" name="home.gathering.btn_cal" initialData={dataPoints}>
                  + Add to Calendar
                </DataPoint>
              </a>
              <a
                href={card.rsvpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-accent-gold px-5 py-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-ink-strong transition-all duration-300 hover:brightness-95 sm:w-auto"
              >
                <DataPoint as="span" name="home.gathering.btn_rsvp" initialData={dataPoints}>
                  RSVP via Mobilize
                </DataPoint>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Four Pillars / Mission Section.
          The old version was four identical rounded cards under a centred heading.
          This is a two-column editorial spread: argument on the left, four numbered
          commitments separated by rules on the right. Copy region preserved. */}
      <section className="border-t border-border bg-surface-muted py-16 text-foreground md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div>
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
              <div className="self-start lg:sticky lg:top-28 lg:col-span-4">
                <DataPoint
                  name="home.pillars.eyebrow"
                  as="span"
                  initialData={dataPoints}
                  className="civic-kicker"
                >
                  Our Core Principles
                </DataPoint>
                <DataPoint
                  name="home.pillars.headline"
                  as="h2"
                  initialData={dataPoints}
                  className="mt-5 max-w-md font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-foreground sm:text-5xl"
                >
                  What We Stand For & How We Win
                </DataPoint>
                <DataPoint
                  name="home.pillars.intro"
                  as="p"
                  initialData={dataPoints}
                  className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground"
                >
                  Rooted in the national Indivisible Guide, our local chapter works tirelessly across
                  the Sacramento region to defend our constitutional democracy through grassroots
                  mobilization.
                </DataPoint>
              </div>

              <div className="grid gap-x-10 sm:grid-cols-2 lg:col-span-8">
                <article className="group border-t border-foreground/25 py-7">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
                      01
                    </span>
                    <Shield
                      size={22}
                      strokeWidth={1.4}
                      className="text-primary transition-colors duration-300 group-hover:text-accent"
                      aria-hidden="true"
                    />
                  </div>
                  <DataPoint
                    name="home.pillars.p1_title"
                    as="h3"
                    initialData={dataPoints}
                    className="mt-8 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground"
                  >
                    Stop Authoritarianism
                  </DataPoint>
                  <DataPoint
                    name="home.pillars.p1_desc"
                    as="p"
                    initialData={dataPoints}
                    className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground"
                  >
                    Countering anti-democratic overreach, defending executive accountability, and
                    raising public alarm through visible resistance.
                  </DataPoint>
                </article>

                <article className="group border-t border-foreground/25 py-7">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
                      02
                    </span>
                    <Vote
                      size={22}
                      strokeWidth={1.4}
                      className="text-primary transition-colors duration-300 group-hover:text-accent"
                      aria-hidden="true"
                    />
                  </div>
                  <DataPoint
                    name="home.pillars.p2_title"
                    as="h3"
                    initialData={dataPoints}
                    className="mt-8 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground"
                  >
                    Defend Democratic Norms
                  </DataPoint>
                  <DataPoint
                    name="home.pillars.p2_desc"
                    as="p"
                    initialData={dataPoints}
                    className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground"
                  >
                    Safeguarding free and fair elections, expanding voting access, educating youth
                    voters, and standing up for civil liberties.
                  </DataPoint>
                </article>

                <article className="group border-t border-foreground/25 py-7">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
                      03
                    </span>
                    <Megaphone
                      size={22}
                      strokeWidth={1.4}
                      className="text-primary transition-colors duration-300 group-hover:text-accent"
                      aria-hidden="true"
                    />
                  </div>
                  <DataPoint
                    name="home.pillars.p3_title"
                    as="h3"
                    initialData={dataPoints}
                    className="mt-8 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground"
                  >
                    Elect Bold Leaders
                  </DataPoint>
                  <DataPoint
                    name="home.pillars.p3_desc"
                    as="p"
                    initialData={dataPoints}
                    className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground"
                  >
                    Direct voter canvassing, phone banks, candidate accountability, and mobilizing
                    high-turnout civic engagement in every cycle.
                  </DataPoint>
                </article>

                <article className="group border-t border-foreground/25 py-7">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
                      04
                    </span>
                    <Users
                      size={22}
                      strokeWidth={1.4}
                      className="text-primary transition-colors duration-300 group-hover:text-accent"
                      aria-hidden="true"
                    />
                  </div>
                  <DataPoint
                    name="home.pillars.p4_title"
                    as="h3"
                    initialData={dataPoints}
                    className="mt-8 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground"
                  >
                    Secure Progressive Policy
                  </DataPoint>
                  <DataPoint
                    name="home.pillars.p4_desc"
                    as="p"
                    initialData={dataPoints}
                    className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground"
                  >
                    Advocating for justice, reproductive autonomy, climate resilience, and economic
                    equity through community solidarity.
                  </DataPoint>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Carmichael Resistance Choir Spotlight */}
      <section className="civic-section bg-surface-muted text-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="civic-kicker">
                <Music size={13} aria-hidden="true" />
                <DataPoint name="home.choir.eyebrow" initialData={dataPoints}>
                  Carmichael Resistance Choir
                </DataPoint>
              </div>
              <DataPoint
                name="home.choir.headline"
                as="h2"
                initialData={dataPoints}
                className="font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-foreground sm:text-5xl"
              >
                Every good protest movement needs music.
              </DataPoint>
              <DataPoint
                name="home.choir.intro"
                as="p"
                initialData={dataPoints}
                className="text-base sm:text-lg text-muted-foreground dark:text-ink-on-dark leading-relaxed"
              >
                Music lifts us up and has sustained justice movements throughout history. We gather
                to weave our voices together in chants and songs of resistance, building vibrant
                community while marching forward.
              </DataPoint>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                <div className="flex items-start gap-3 border-t border-foreground/25 pt-4">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-primary-ink" size={18} />
                  <div>
                    <DataPoint
                      name="home.choir.all_voices"
                      as="span"
                      initialData={dataPoints}
                      className="font-bold text-foreground dark:text-white text-sm block"
                    >
                      All Voices Welcome
                    </DataPoint>
                    <DataPoint
                      name="home.choir.all_voices_sub"
                      as="span"
                      initialData={dataPoints}
                      className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
                    >
                      No auditions, no fees. Everyone can sing.
                    </DataPoint>
                  </div>
                </div>
                <div className="flex items-start gap-3 border-t border-foreground/25 pt-4">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-primary-ink" size={18} />
                  <div>
                    <DataPoint
                      name="home.choir.rehearsal"
                      as="span"
                      initialData={dataPoints}
                      className="font-bold text-foreground dark:text-white text-sm block"
                    >
                      Rehearsal Schedule
                    </DataPoint>
                    <DataPoint
                      name="home.choir.rehearsal_sub"
                      as="span"
                      initialData={dataPoints}
                      className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
                    >
                      Every other Wednesday, 6:30 – 8:00 PM.
                    </DataPoint>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <Link
                  href="/choir"
                  className="inline-flex min-h-11 items-center gap-2 border border-primary bg-primary px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:border-primary-dark hover:bg-primary-dark"
                >
                  <span>Choir Details & Video</span>
                  <ArrowRight size={14} />
                </Link>
                <a
                  href="https://www.mobilize.us/indivisible/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 border border-foreground/30 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink"
                >
                  Register via Mobilize
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="border border-foreground/25 bg-surface-card p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="civic-meta text-primary-ink">
                    Protest In Song
                  </span>
                  <span className="text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
                    Fair Oaks Blvd & Manzanita Ave
                  </span>
                </div>
                <LiteYouTube
                  videoId="BhdjDlRUMUw"
                  title="Carmichael Resistance Choir singing demonstration"
                  poster="/images/gallery/carmichael-resistance-choir.jpg"
                  className="mb-4"
                />
                <p className="text-xs text-muted-foreground dark:text-ink-muted-on-dark italic mb-6">
                  &ldquo;
                  <DataPoint name="home.choir.quote" initialData={dataPoints}>
                    We will sing our protest to the afternoon rush hour and community businesses.
                    Bring your signs, chairs, and voices!
                  </DataPoint>
                  &rdquo;
                </p>

                {/* Issue #148: the Resistance Radio box (ChoirAudioPlayer) was
                    removed with the choir page's instance — same component, same
                    complaint. One line restores it if the chapter wants it here. */}
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
                className="civic-kicker"
              >
                Empowering Every Voter
              </DataPoint>
              <DataPoint
                name="home.voter.headline"
                as="h2"
                initialData={dataPoints}
                className="mt-4 font-display text-4xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-5xl"
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
              <div className="flex flex-col justify-between border-t border-foreground/25 pt-6 transition-colors hover:border-primary/60">
                <div>
                  <div className="mb-4 flex size-10 items-center justify-center border border-border bg-background text-primary-ink">
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

              <div className="flex flex-col justify-between border-t border-foreground/25 pt-6 transition-colors hover:border-primary/60">
                <div>
                  <div className="mb-4 flex size-10 items-center justify-center border border-border bg-background text-accent">
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

              <div className="flex flex-col justify-between border-t border-foreground/25 pt-6 transition-colors hover:border-primary/60">
                <div>
                  <div className="mb-4 flex size-10 items-center justify-center border border-border bg-background text-primary-ink">
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
      <section className="civic-section border-y border-border bg-secondary text-ink-on-dark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="mb-1 inline-flex size-12 items-center justify-center border border-white/25 text-accent-gold-on-dark">
            <Shield size={24} />
          </div>
          <DataPoint
            name="home.nonviolence.headline"
            as="h2"
            initialData={dataPoints}
            className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-4xl"
          >
            Our Core Commitment: Disciplined Non-Violent Action
          </DataPoint>
          <DataPoint
            name="home.nonviolence.desc"
            as="p"
            initialData={dataPoints}
            className="mx-auto max-w-2xl text-sm leading-relaxed text-ink-on-dark/80"
          >
            A core principle behind all Indivisible events is an unwavering commitment to nonviolent
            action. We expect all participants to act lawfully, avoid civil disobedience unless
            specifically planned and coordinated, de-escalate any potential confrontation with those
            who disagree with our values, and maintain peaceful solidarity.
          </DataPoint>
        </div>
      </section>

      {/* Support & Donation CTA. A solid civic-blue field closes the page; the
          previous pastel gradient was the most generic surface on the site. */}
      <section className="border-y border-primary-dark bg-primary py-16 text-white md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-12">
            <div className="lg:col-span-8">
              <DataPoint
                name="home.cta.eyebrow"
                as="span"
                initialData={dataPoints}
                className="civic-kicker text-white before:bg-accent-gold"
              >
                Grassroots Power Runs On Grassroots Support
              </DataPoint>
              <DataPoint
                name="home.cta.headline"
                as="h2"
                initialData={dataPoints}
                className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[0.94] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl"
              >
                Fuel Our Local Organizing
              </DataPoint>
              <DataPoint
                name="home.cta.desc"
                as="p"
                initialData={dataPoints}
                className="mt-6 max-w-2xl text-base leading-relaxed text-white"
              >
                Every dollar contributed to our chapter directly supports community meeting spaces,
                protest banners, sound equipment for the Resistance Choir, voter registration printing,
                and neighborhood outreach.
              </DataPoint>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-4">
              <Link
                href="/donate"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-accent-gold bg-accent-gold px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-ink-strong transition-all duration-300 hover:brightness-95"
              >
                <Heart size={16} className="fill-current" aria-hidden="true" />
                <DataPoint as="span" name="home.cta.btn_donate" initialData={dataPoints}>
                  Donate via ActBlue
                </DataPoint>
              </Link>
              <a
                href="mailto:subscribe@indivisiblefairoaks.org"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-white/40 px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors duration-300 hover:border-white hover:bg-white/10"
              >
                <Mail size={16} aria-hidden="true" />
                <DataPoint as="span" name="home.cta.btn_subscribe" initialData={dataPoints}>
                  Join Mailing List
                </DataPoint>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { pageMetadata } from '@/lib/metadata';
