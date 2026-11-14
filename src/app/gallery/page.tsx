'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Search,
  Share2,
  Video,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';
import { FALLBACK_GALLERY_PHOTOS } from '@/config/gallery-fallback';
import { GalleryImage } from '@/components/gallery/GalleryImage';
import { LiteYouTube } from '@/components/ui/LiteYouTube';
import { useDataPoints } from '@/hooks/useDataPoints';
import { type GalleryPhoto, getGalleryPhotos } from '@/lib/queries/content-client';

export default function GalleryPage() {
  const { dataPoints } = useDataPoints('gallery');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // The checked-in archive renders immediately. A real database response
  // replaces it; an empty or unreachable response does not blank the page.
  const [dbPhotos, setDbPhotos] = useState<GalleryPhoto[]>(FALLBACK_GALLERY_PHOTOS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadGallery() {
      try {
        // One resolved request through the API mapper. The previous duplicate
        // raw fetch made an empty archive cost two failing round trips.
        const photos = await getGalleryPhotos();
        if (!cancelled && photos.length > 0) setDbPhotos(photos);
      } catch {
        // Keep the checked-in archive visible rather than turning a network
        // problem into a blank public page.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadGallery();
    return () => {
      cancelled = true;
    };
  }, []);

  const allPhotos = dbPhotos;

  const categories = useMemo(() => {
    const categoriesSet = new Set<string>(['All']);
    for (const photo of allPhotos) {
      categoriesSet.add(photo.category);
    }
    return Array.from(categoriesSet);
  }, [allPhotos]);

  // Filter and search
  const filteredPhotos = useMemo(() => {
    return allPhotos.filter((photo) => {
      const matchesCategory = selectedCategory === 'All' || photo.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        photo.caption.toLowerCase().includes(q) ||
        photo.location.toLowerCase().includes(q) ||
        Boolean(photo.signQuote?.toLowerCase().includes(q)) ||
        photo.category.toLowerCase().includes(q) ||
        photo.photographer.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchQuery, allPhotos]);

  const selectedPhoto = allPhotos.find((p) => p.id === selectedPhotoId) ?? null;
  const currentIndex = selectedPhoto
    ? filteredPhotos.findIndex((p) => p.id === selectedPhoto.id)
    : -1;

  const handleNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < filteredPhotos.length - 1) {
      setSelectedPhotoId(filteredPhotos[currentIndex + 1].id);
    } else if (filteredPhotos.length > 0) {
      setSelectedPhotoId(filteredPhotos[0].id);
    }
  }, [currentIndex, filteredPhotos]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedPhotoId(filteredPhotos[currentIndex - 1].id);
    } else if (filteredPhotos.length > 0) {
      setSelectedPhotoId(filteredPhotos[filteredPhotos.length - 1].id);
    }
  }, [currentIndex, filteredPhotos]);

  // Arrow-key paging. Escape is Radix Dialog's job — handling it here as well
  // meant two listeners racing to close the same surface.
  useEffect(() => {
    if (!selectedPhotoId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoId, handleNext, handlePrev]);

  // The clipboard confirmation timer used to be a bare setTimeout with no
  // cleanup, so closing the lightbox inside those two seconds set state on an
  // unmounted component.
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href).catch(() => {
      // Clipboard access can be denied; failing silently would look like the
      // button does nothing.
      setCopiedLink(false);
    });
    setCopiedLink(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedLink(false), 3000);
  };

  const mastheadPhoto = dbPhotos[0];

  return (
    <div className="civic-page min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        icon={Camera}
        visual={
          mastheadPhoto ? (
            <figure className="relative w-52 xl:w-60">
              <div
                aria-hidden="true"
                className="absolute -left-3 -top-3 h-full w-full border border-accent/70"
              />
              <div className="relative aspect-[4/5] overflow-hidden border border-foreground/25 bg-surface-muted">
                <GalleryImage
                  src={mastheadPhoto.url}
                  alt={mastheadPhoto.caption}
                  sizes="(min-width: 1280px) 240px, 208px"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-secondary/90 via-secondary/45 to-transparent p-3 pt-10">
                  <figcaption className="text-[9px] font-bold uppercase tracking-[0.14em] text-white">
                    {mastheadPhoto.category} / Archive
                  </figcaption>
                </div>
              </div>
            </figure>
          ) : undefined
        }
        eyebrow={
          <DataPoint initialData={dataPoints} name="gallery.hero.eyebrow">
            Photojournalism In Action • Moments of Peaceful Resistance
          </DataPoint>
        }
        title={
          <DataPoint
            initialData={dataPoints}
            name="gallery.hero.headline"
            as="h1"
            className={MASTHEAD_TITLE}
          >
            Democracy In Full View
          </DataPoint>
        }
        intro={
          <DataPoint
            initialData={dataPoints}
            name="gallery.hero.intro"
            as="p"
            className={MASTHEAD_INTRO}
          >
            Snapshots of our neighbors gathering, singing, holding signs, and speaking truth to
            power across Sacramento County. Curated from our legacy site archives, Sacramento No
            Kings mobilizations, NorCal Resist community defense, Carmichael Resistance Choir, and
            witty grassroots cardboard art. Strictly 100% grassroots — zero politicians, zero
            corporate branding.
          </DataPoint>
        }
      />

      <section className="border-b border-border bg-surface-muted/60">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-y border-foreground/15 py-4">
            <p className="font-display text-2xl font-semibold text-foreground">
              {allPhotos.length} photograph{allPhotos.length === 1 ? '' : 's'}{' '}
              <span className="font-sans text-xs font-medium tracking-normal text-muted-foreground">
                across {categories.length - 1} collection{categories.length - 1 === 1 ? '' : 's'}
              </span>
            </p>
            <p className="civic-meta text-muted-foreground">
              <span className="text-accent">100% grassroots</span>
              <span aria-hidden="true" className="px-1.5">
                /
              </span>{' '}
              0 politicians
            </p>
          </div>

          {/* Real-time Search & Filter Controls */}
          <div className="mt-6 w-full max-w-2xl space-y-4">
            <div className="relative">
              <Search
                size={18}
                aria-hidden="true"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                aria-label="Search gallery"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by quote, slogan, location (e.g. 'IKEA', 'Tower Bridge', 'Brake Light')..."
                className="w-full rounded-sm border border-border bg-surface-card py-3 pl-12 pr-10 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div
              role="group"
              aria-label="Filter photographs by collection"
              className="flex flex-wrap items-center justify-start gap-2"
            >
              <Filter
                size={15}
                className="mr-1 hidden text-muted-foreground sm:inline-block"
              />
              {categories.map((category) => {
                const count =
                  category === 'All'
                    ? allPhotos.length
                    : allPhotos.filter((p) => p.category === category).length;
                const isSelected = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedCategory(category)}
                    className={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm px-3.5 text-xs font-semibold transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-sm ${
                      isSelected
                        ? 'bg-primary text-white'
                        : 'border border-border bg-surface-card/90 text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                    }`}
                  >
                    <span>{category}</span>
                    <span
                      className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${
                        isSelected
                          ? 'bg-primary-dark text-white'
                          : 'bg-surface-muted text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Filtering and searching produced a silently-changing grid. */}
      <p role="status" aria-live="polite" className="sr-only">
        {isLoading
          ? 'Loading gallery'
          : `${filteredPhotos.length} photo${filteredPhotos.length === 1 ? '' : 's'} shown`}
      </p>

      {/* Gallery Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12" aria-busy={isLoading}>
        {filteredPhotos.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <p className="text-muted-foreground text-base">
              {allPhotos.length === 0
                ? 'The photo archive is being prepared. Check back soon.'
                : 'No photos match your current search or category filter.'}
            </p>
            {allPhotos.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                }}
                className="min-h-11 rounded-sm bg-primary px-5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-dark"
              >
                Reset Filters
              </button>
            ) : (
              <a
                href="mailto:contact@indivisiblefairoaks.org?subject=Community%20Photo%20Submission"
                className="inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-dark"
              >
                Submit a Photo
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPhotos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                data-gallery-photo={photo.id}
                onClick={() => setSelectedPhotoId(photo.id)}
                className="group relative h-88 cursor-pointer overflow-hidden border border-border bg-surface-card text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <GalleryImage
                  src={photo.url}
                  alt={photo.caption}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-700 brightness-95 group-hover:brightness-100"
                />

                {/* Gradient Scrim */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-secondary via-secondary/45 to-transparent opacity-90 transition-opacity group-hover:opacity-80" />

                {/* Top Tag & Witty Sign Badge */}
                <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5 max-w-[85%]">
                  <span className="border border-white/20 bg-secondary/85 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent-gold backdrop-blur-md">
                    {photo.category}
                  </span>
                  {photo.signQuote && (
                    <span className="max-w-full truncate bg-accent-gold px-2.5 py-0.5 text-[11px] font-bold text-ink-strong">
                      “{photo.signQuote}”
                    </span>
                  )}
                </div>

                {/* Bottom Caption */}
                <div className="absolute bottom-0 inset-x-0 p-5 z-10 space-y-1.5">
                  {/* A photo card is a button, whose content model is phrasing
                      content; a heading inside it was invalid HTML. The
                      catalogue heading is the section h2 outside the grid. */}
                  <span className="line-clamp-2 block font-display text-xl font-semibold leading-snug text-white transition-colors group-hover:text-accent-gold">
                    {photo.caption}
                  </span>
                  <div className="flex items-center justify-between text-xs text-ink-muted-on-dark">
                    <span className="flex max-w-[70%] items-center gap-1 truncate">
                      <MapPin size={12} className="shrink-0 text-accent-gold" aria-hidden="true" />
                      <span className="truncate">{photo.location}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px]">
                      {photo.date}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Featured Video Archive: No Kings 3 (Issue #88) */}
        <div className="relative mt-16 overflow-hidden border-y border-border bg-surface-card p-6 sm:p-8 md:p-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8 border-b border-border dark:border-white/10 pb-6">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-sm border border-accent-gold/40 bg-accent-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink-strong dark:text-accent-gold-on-dark">
                <Video size={14} />
                <DataPoint initialData={dataPoints} as="span" name="gallery.video.badge_top">
                  Featured Video Archive
                </DataPoint>
              </div>
              <DataPoint
                initialData={dataPoints}
                as="h2"
                name="gallery.video.title"
                className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
              >
                No Kings in America: The Movement in Motion
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                as="p"
                name="gallery.video.desc"
                className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm dark:text-ink-on-dark"
              >
                Watch official grassroots mobilization footage and documentary highlights from our
                Sacramento County actions defending constitutional democracy.
              </DataPoint>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <DataPoint
                initialData={dataPoints}
                as="span"
                name="gallery.video.platform_tag"
                className="rounded-sm border border-border bg-surface-muted px-3 py-1.5 font-mono text-xs text-muted-foreground"
              >
                Archived from Original Platform
              </DataPoint>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <LiteYouTube
                videoId="aO2BEp8PCcY"
                title="No Kings 3 Grassroots Mobilization Video"
                poster="/images/gallery/sacramento-capitol-no-kings.jpg"
                className="border border-border"
              />
            </div>
            <div className="lg:col-span-5 space-y-4">
              <DataPoint
                initialData={dataPoints}
                as="div"
                name="gallery.video.coalition_badge"
                className="inline-block rounded-sm border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary-ink dark:border-primary-on-dark-muted/30 dark:bg-primary-bright/20 dark:text-primary-on-dark"
              >
                Indivisible National &amp; Local Coalition
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                as="h3"
                name="gallery.video.subheading"
                className="text-xl font-bold text-foreground dark:text-white"
              >
                No Kings 3 Nationwide Action
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                as="p"
                name="gallery.video.action_desc"
                className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed"
              >
                Highlights from the nationwide peaceful rallies rejecting authoritarian impunity and
                defending the rule of law. From Sacramento to communities across the country,
                thousands gathered with signs, chants, and peaceful resolve.
              </DataPoint>
              <div className="pt-2 flex flex-wrap gap-3">
                <Link
                  href="/events"
                  className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-dark"
                >
                  <DataPoint initialData={dataPoints} as="span" name="gallery.video.btn_rallies">
                    Upcoming Rallies
                  </DataPoint>
                </Link>
                <Link
                  href="/choir"
                  className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-5 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary-ink"
                >
                  <DataPoint initialData={dataPoints} as="span" name="gallery.video.btn_choir">
                    Choir Anthems
                  </DataPoint>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Photo CTA */}
        <div className="mx-auto mt-16 max-w-3xl space-y-4 border-y border-border bg-surface-card p-8 text-center sm:p-10">
          <DataPoint
            initialData={dataPoints}
            as="h2"
            name="gallery.cta.title"
            className="font-display text-3xl font-semibold tracking-[-0.03em]"
          >
            Have Sacramento Resistance Pics, Unity Shots, or Funny Signs?
          </DataPoint>
          <DataPoint
            initialData={dataPoints}
            as="p"
            name="gallery.cta.desc"
            className="text-sm text-muted-foreground dark:text-ink-on-dark max-w-xl mx-auto leading-relaxed"
          >
            Did you snap a brilliant, witty cardboard sign, an uplifting choir moment, or neighbors
            standing in solidarity? Strictly grassroots (zero politicians, zero corporate imagery) —
            send your photos to our media circle to be included!
          </DataPoint>
          <div className="pt-2">
            <a
              href="mailto:contact@indivisiblefairoaks.org?subject=Community%20Photo%20Submission"
              className="inline-flex min-h-11 items-center border border-primary bg-primary px-8 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
            >
              <DataPoint initialData={dataPoints} as="span" name="gallery.cta.button">
                Submit Grassroots Photos
              </DataPoint>
            </a>
          </div>
        </div>
      </div>

      {/*
        The lightbox was a `role="dialog" aria-modal="true"` div with no focus
        trap, no initial focus move, no focus restoration, no scroll lock, and no
        `inert` on the ~200-photo grid behind it. The `onKeyDown` handler on the
        outer div was dead code — a div without tabindex never receives key
        events. Radix Dialog supplies the whole set.

        Note the grid thumbnails are no longer `priority`: preloading a modal
        image steals LCP budget from the page the visitor actually landed on.
      */}
      <Dialog.Root
        open={Boolean(selectedPhoto)}
        onOpenChange={(open) => !open && setSelectedPhotoId(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
          {/* The null check is the type guard: `open` alone does not narrow. */}
          {selectedPhoto && (
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-6 md:p-10 focus:outline-none"
            >
              <Dialog.Title className="sr-only">Photo viewer</Dialog.Title>

              <Dialog.Close className="absolute top-6 right-6 z-50 inline-flex size-11 items-center justify-center rounded-sm border border-white/20 bg-secondary/80 text-ink-on-dark transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold">
                <X size={20} aria-hidden="true" />
                <span className="sr-only">Close image viewer</span>
              </Dialog.Close>

              <button
                type="button"
                onClick={() => handlePrev()}
                className="absolute left-4 z-50 inline-flex size-11 items-center justify-center rounded-sm border border-white/20 bg-secondary/80 text-ink-on-dark transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold sm:left-6"
              >
                <ChevronLeft size={24} aria-hidden="true" />
                <span className="sr-only">Previous image</span>
              </button>

              <button
                type="button"
                onClick={() => handleNext()}
                className="absolute right-4 z-50 inline-flex size-11 items-center justify-center rounded-sm border border-white/20 bg-secondary/80 text-ink-on-dark transition-colors duration-300 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold sm:right-6"
              >
                <ChevronRight size={24} aria-hidden="true" />
                <span className="sr-only">Next image</span>
              </button>

              <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden border border-white/10 bg-secondary shadow-float">
                {/* Image Container */}
                <div className="relative w-full h-[55vh] sm:h-[65vh] bg-black">
                  <GalleryImage
                    src={selectedPhoto.url}
                    alt={selectedPhoto.caption}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1024px"
                    className="object-contain"
                  />
                </div>

                {/* Modal Info Bar */}
                <div className="p-6 bg-secondary border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-sm border border-primary-on-dark-muted/40 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-primary-on-dark-muted">
                        {selectedPhoto.category}
                      </span>
                      <span className="text-xs text-ink-muted-on-dark font-mono">
                        {selectedPhoto.date}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">
                      {selectedPhoto.caption}
                    </h2>
                    {selectedPhoto.signQuote && (
                      <div className="my-1 inline-block bg-accent-gold px-3 py-1 text-xs font-bold tracking-tight text-ink-strong">
                        Featured Sign: “{selectedPhoto.signQuote}”
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-ink-muted-on-dark pt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-accent-gold" />
                        <span>{selectedPhoto.location}</span>
                      </span>
                      <span>•</span>
                      <span>Photo: {selectedPhoto.photographer}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleShare}
                      className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm border border-white/20 bg-white/5 px-4 text-xs font-semibold text-ink-on-dark transition-colors hover:bg-white/10"
                    >
                      <Share2 size={14} />
                      <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
                    </button>
                    <Link
                      href="/events"
                      className="inline-flex min-h-11 items-center rounded-sm bg-primary px-4 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-dark"
                    >
                      Attend Next Action
                    </Link>
                  </div>
                </div>
              </div>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
