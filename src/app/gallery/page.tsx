'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Camera, ChevronLeft, ChevronRight, Filter, MapPin, Search, Share2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { type GalleryPhoto, getGalleryPhotos } from '@/lib/queries/content-client';

export default function GalleryPage() {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch gallery photos from Supabase on mount
  const [dbPhotos, setDbPhotos] = useState<GalleryPhoto[]>([]);

  useEffect(() => {
    getGalleryPhotos().then((photos) => {
      setDbPhotos(photos);
    });
  }, []);

  // Use dynamic photos if available, otherwise fall back to static gallery
  const allPhotos = dbPhotos.length > 0 ? dbPhotos : [];

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

  return (
    <div className="bg-background text-foreground dark:bg-secondary dark:text-white min-h-screen pt-(--header-clearance) pb-20">
      {/* Hero Header with VGPU Constellation Network */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border-b border-white/10 py-16 px-4 sm:px-6 lg:px-8">
        <VgpuCivicConstellation />
        <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center text-center space-y-4 pointer-events-auto">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-bright/15 border border-primary-on-dark-muted/30 text-primary-on-dark text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            <Camera size={14} className="text-accent-gold" />
            <span>Photojournalism In Action • Moments of Peaceful Resistance</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase text-white tracking-tighter leading-[1.08]">
            Democracy In Full View
          </h1>

          <div className="h-1.5 w-24 bg-accent-gold rounded-full" />

          <p className="text-base sm:text-lg text-ink-on-dark leading-relaxed max-w-3xl">
            Snapshots of our neighbors gathering, singing, holding signs, and speaking truth to
            power across Sacramento County. Curated from our legacy site archives, Sacramento No
            Kings mobilizations, NorCal Resist community defense, Carmichael Resistance Choir, and
            witty grassroots cardboard art. Strictly 100% grassroots — zero politicians, zero
            corporate branding.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-4xl pt-4">
            <div className="p-4 rounded-2xl bg-secondary/80 border border-white/10 text-center">
              <span className="text-2xl font-black text-accent-gold block font-mono">No Kings</span>
              <span className="text-[11px] text-ink-muted-on-dark uppercase tracking-wider font-semibold">
                Sacramento Actions
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-secondary/80 border border-white/10 text-center">
              <span className="text-2xl font-black text-emerald-400 block font-mono">
                NorCal Resist
              </span>
              <span className="text-[11px] text-ink-muted-on-dark uppercase tracking-wider font-semibold">
                Direct Solidarity
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-secondary/80 border border-white/10 text-center">
              <span className="text-2xl font-black text-primary-on-dark-muted block font-mono">
                Witty Signs
              </span>
              <span className="text-[11px] text-ink-muted-on-dark uppercase tracking-wider font-semibold">
                Grassroots Humor
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-secondary/80 border border-white/10 text-center">
              <span className="text-2xl font-black text-purple-400 block font-mono">
                0 Politicians
              </span>
              <span className="text-[11px] text-ink-muted-on-dark uppercase tracking-wider font-semibold">
                100% People Power
              </span>
            </div>
          </div>

          {/* Real-time Search & Filter Controls */}
          <div className="w-full max-w-2xl pt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                aria-hidden="true"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark"
              />
              <input
                type="text"
                aria-label="Search gallery"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by quote, slogan, location (e.g. 'IKEA', 'Tower Bridge', 'Brake Light')..."
                className="w-full pl-12 pr-10 py-3 rounded-2xl bg-surface-card dark:bg-secondary border border-border dark:border-slate-700 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-md shadow-lg"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark hover:text-foreground dark:text-white"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Filter
                size={15}
                className="text-muted-foreground dark:text-ink-muted-on-dark mr-1 hidden sm:inline-block"
              />
              {categories.map((category) => {
                const count = allPhotos.filter((p) => p.category === category).length;
                const isSelected = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3.5 min-h-11 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-300 ease-out cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold ${
                      isSelected
                        ? 'bg-primary text-white shadow-raised'
                        : 'bg-surface-card dark:bg-secondary/90 text-muted-foreground dark:text-ink-on-dark hover:text-foreground dark:text-white hover:bg-surface-muted dark:hover:bg-white/5 border border-border dark:border-white/10'
                    }`}
                  >
                    <span>{category}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-blue-800 text-white'
                          : 'bg-surface-muted dark:bg-white/5 text-muted-foreground dark:text-ink-muted-on-dark'
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
      </div>

      {/* Filtering and searching produced a silently-changing grid. */}
      <p role="status" aria-live="polite" className="sr-only">
        {filteredPhotos.length} photo{filteredPhotos.length === 1 ? '' : 's'} shown
      </p>

      {/* Gallery Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {filteredPhotos.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <p className="text-muted-foreground dark:text-ink-muted-on-dark text-base">
              No photos match your current search or category filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="px-5 py-2 rounded-xl bg-primary-bright text-white text-xs font-bold uppercase tracking-wider"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPhotos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                data-gallery-photo={photo.id}
                onClick={() => setSelectedPhotoId(photo.id)}
                className="group relative h-88 rounded-3xl overflow-hidden border border-border dark:border-white/10/80 bg-surface-card dark:bg-secondary cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-primary dark:hover:border-slate-700 transition-all shadow-xl"
              >
                <Image
                  src={photo.url}
                  alt={photo.caption}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-700 brightness-95 group-hover:brightness-100"
                />

                {/* Gradient Scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />

                {/* Top Tag & Witty Sign Badge */}
                <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5 max-w-[85%]">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-secondary/85 backdrop-blur-md border border-slate-700 text-accent-gold">
                    {photo.category}
                  </span>
                  {photo.signQuote && (
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-accent-gold text-slate-950 shadow-md truncate max-w-full">
                      “{photo.signQuote}”
                    </span>
                  )}
                </div>

                {/* Bottom Caption */}
                <div className="absolute bottom-0 inset-x-0 p-5 z-10 space-y-1.5">
                  <h2 className="font-bold text-foreground dark:text-white text-base sm:text-lg leading-snug group-hover:text-primary-dark dark:group-hover:text-primary-light transition-colors duration-300 ease-out line-clamp-2">
                    {photo.caption}
                  </h2>
                  <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-ink-muted-on-dark">
                    <span className="flex items-center gap-1 truncate max-w-[70%]">
                      <MapPin size={12} className="text-accent dark:text-accent-gold shrink-0" />
                      <span className="truncate">{photo.location}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">
                      {photo.date}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Submit Photo CTA */}
        <div className="mt-16 p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-white/10 text-center space-y-4 max-w-3xl mx-auto">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
            Have Sacramento Resistance Pics, Unity Shots, or Funny Signs?
          </h2>
          <p className="text-sm text-ink-on-dark max-w-xl mx-auto leading-relaxed">
            Did you snap a brilliant, witty cardboard sign, an uplifting choir moment, or neighbors
            standing in solidarity? Strictly grassroots (zero politicians, zero corporate imagery) —
            send your photos to our media circle to be included!
          </p>
          <div className="pt-2">
            <a
              href="mailto:contact@indivisiblefairoaks.org?subject=Community%20Photo%20Submission"
              className="inline-block px-8 py-3.5 rounded-2xl bg-primary hover:bg-primary-dark dark:bg-primary-bright dark:hover:bg-primary-light text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/25"
            >
              Submit Grassroots Photos
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

              <Dialog.Close className="absolute top-6 right-6 z-50 inline-flex size-11 items-center justify-center rounded-full bg-secondary/80 border border-slate-700 text-ink-on-dark hover:text-white hover:bg-white/5 transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold">
                <X size={20} aria-hidden="true" />
                <span className="sr-only">Close image viewer</span>
              </Dialog.Close>

              <button
                type="button"
                onClick={() => handlePrev()}
                className="absolute left-4 sm:left-6 z-50 inline-flex size-11 items-center justify-center rounded-full bg-secondary/80 border border-slate-700 text-ink-on-dark hover:text-white hover:bg-white/5 transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
              >
                <ChevronLeft size={24} aria-hidden="true" />
                <span className="sr-only">Previous image</span>
              </button>

              <button
                type="button"
                onClick={() => handleNext()}
                className="absolute right-4 sm:right-6 z-50 inline-flex size-11 items-center justify-center rounded-full bg-secondary/80 border border-slate-700 text-ink-on-dark hover:text-white hover:bg-white/5 transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
              >
                <ChevronRight size={24} aria-hidden="true" />
                <span className="sr-only">Next image</span>
              </button>

              <div className="relative max-w-5xl w-full max-h-[90vh] bg-secondary border border-white/10 rounded-3xl overflow-hidden shadow-float flex flex-col">
                {/* Image Container */}
                <div className="relative w-full h-[55vh] sm:h-[65vh] bg-black">
                  <Image
                    src={selectedPhoto.url}
                    alt={selectedPhoto.caption}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1024px"
                    className="object-contain"
                  />
                </div>

                {/* Modal Info Bar */}
                <div className="p-6 bg-secondary border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-primary-light/40 text-[10px] font-mono uppercase font-bold">
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
                      <div className="inline-block my-1 px-3 py-1 rounded-lg bg-accent-gold text-slate-950 text-xs font-black tracking-tight">
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
                      className="px-4 py-2 rounded-xl bg-secondary hover:bg-white/5 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Share2 size={14} />
                      <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
                    </button>
                    <Link
                      href="/events"
                      className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark dark:bg-primary-bright dark:hover:bg-primary-light text-white text-xs font-bold uppercase tracking-wider transition-all"
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
