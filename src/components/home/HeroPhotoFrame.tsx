'use client';

import { Pause, Play } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FALLBACK_GALLERY_PHOTOS } from '@/config/gallery-fallback';
import { GalleryImage } from '@/components/gallery/GalleryImage';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';

import { getGalleryPhotos } from '@/lib/queries/content-client';
import type { GalleryPhotoView } from '@/types/gallery';

interface Photo {
  id: string;
  src: string;
  alt: string;
  label: string;
  sort_order?: number;
  is_hero?: boolean;
  category?: string;
  url?: string;
}

const toFallbackPhoto = (photo: (typeof FALLBACK_GALLERY_PHOTOS)[number]): Photo => ({
  id: photo.id,
  src: photo.url,
  alt: photo.alt || photo.caption,
  label: photo.label || photo.caption,
});

// The hero is the most visible plate on the homepage. When the gallery table
// is empty or unreachable, keep the printed spread intact with the chapter's
// checked-in archive images instead of a large blank media well.
const FALLBACK_HERO_PHOTOS = FALLBACK_GALLERY_PHOTOS.filter((photo) => photo.is_hero)
  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  .slice(0, 4)
  .map(toFallbackPhoto);

const FALLBACK_PAIR_PHOTOS = FALLBACK_GALLERY_PHOTOS.filter((photo) => photo.is_pair).map(
  toFallbackPhoto
);

// Hero crossfade photos (top 4 by sort_order, is_hero=true)
const useHeroPhotos = (initialPhotos?: GalleryPhotoView[]): Photo[] => {
  const [heroPhotos, setHeroPhotos] = useState<Photo[]>(() => {
    const initialHeroes = (initialPhotos ?? [])
      .filter((p) => p.is_hero === true)
      .slice(0, 4)
      .map((p) => ({
        id: p.id,
        src: p.url,
        alt: p.alt || p.caption || '',
        label: (p as { label?: string }).label || p.caption || '',
      }));

    return initialHeroes.length > 0 ? initialHeroes : FALLBACK_HERO_PHOTOS;
  });

  useEffect(() => {
    // A supplied array is authoritative for this server-rendered surface. Only
    // a standalone mount that passed no prop needs to fetch.
    if (initialPhotos) return;
    getGalleryPhotos().then((photos) => {
      const heroes = photos
        .filter((p): p is typeof p & { is_hero: true } => p.is_hero === true)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      // An empty successful response is not a reason to erase the fallback.
      if (heroes.length === 0) return;

      setHeroPhotos(
        heroes.slice(0, 4).map((p) => ({
          id: p.id,
          src: p.url,
          alt: p.alt || p.caption || '',
          label: (p as { label?: string }).label || p.caption || '',
        }))
      );
    });
  }, [initialPhotos]);

  return heroPhotos;
};

// Pair photos (is_pair=true)
const usePairPhotos = (initialPhotos?: GalleryPhotoView[]): Photo[] => {
  const [pairPhotos, setPairPhotos] = useState<Photo[]>(() => {
    const initialPairs = (initialPhotos ?? [])
      .filter((p) => p.is_pair === true)
      .map((p) => ({
        id: p.id,
        src: p.url,
        alt: p.alt || p.caption || '',
        label: (p as { label?: string }).label || p.caption || '',
      }));

    return initialPairs.length > 0 ? initialPairs : FALLBACK_PAIR_PHOTOS;
  });

  useEffect(() => {
    if (initialPhotos) return;
    getGalleryPhotos().then((photos) => {
      const pairs = photos.filter((p) => p.is_pair === true);
      if (pairs.length === 0) return;

      setPairPhotos(
        pairs.map((p) => ({
          id: p.id,
          src: p.url,
          alt: p.alt || p.caption || '',
          label: (p as { label?: string }).label || p.caption || '',
        }))
      );
    });
  }, [initialPhotos]);

  return pairPhotos;
};

const HERO_INTERVAL = 6000; // ms between hero crossfades

const EASE_STD = [0.4, 0, 0.2, 1] as const;

export function HeroPhotoFrame({
  photos: initialPhotos,
  initialData,
}: {
  photos?: GalleryPhotoView[];
  initialData?: Record<string, string>;
} = {}) {
  const { dataPoints } = useDataPoints('home', initialData);
  const reduced = useReducedMotion();
  const heroPhotos = useHeroPhotos(initialPhotos);
  const pairPhotos = usePairPhotos(initialPhotos);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (reduced !== false || isPaused || heroPhotos.length < 2) return;
    const t = setInterval(() => setHeroIndex((p) => (p + 1) % heroPhotos.length), HERO_INTERVAL);
    return () => clearInterval(t);
  }, [heroPhotos.length, isPaused, reduced]);

  const selectHero = (index: number) => {
    setHeroIndex(index);
    // Choosing a frame should keep it on screen rather than letting the timer
    // immediately move on. The explicit pause control is still available.
    setIsPaused(true);
  };

  const dur = reduced !== false ? 0 : undefined;

  return (
    <div className="mx-auto flex w-full max-w-full select-none flex-col gap-4 md:max-w-2xl lg:max-w-3xl">
      <div className="flex flex-col gap-4">
        {/* ── Row 1: crossfading large photo ── */}
        <div
          role="group"
          aria-roledescription="carousel"
          aria-label="Community photo highlights"
          className="relative aspect-[4/3] overflow-hidden rounded-sm border border-foreground/25 bg-surface-deep shadow-[8px_8px_0_var(--surface-deep)]"
        >
          {heroPhotos.length > 0 && (
            <AnimatePresence mode="sync" initial={false}>
              <motion.div
                key={heroPhotos[heroIndex]?.id}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur ?? 1.1, ease: EASE_STD }}
              >
                <GalleryImage
                  src={heroPhotos[heroIndex]?.src ?? ''}
                  alt={heroPhotos[heroIndex]?.alt ?? ''}
                  className="object-cover"
                  sizes="(min-width: 1024px) 44vw, 100vw"
                  priority
                />
              </motion.div>
            </AnimatePresence>
          )}
          {heroPhotos.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-muted px-6 text-center">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground dark:text-ink-muted-on-dark">
                <DataPoint as="span" name="home.hero.community_moments" initialData={dataPoints}>
                  Community moments
                </DataPoint>
              </span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-secondary/80 via-secondary/10 to-transparent" />

          {heroPhotos.length > 0 && (
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={heroPhotos[heroIndex]?.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 5 }}
                  transition={{ duration: dur ?? 0.3 }}
                  className="inline-flex items-center gap-1.5 border border-foreground/20 bg-background/90 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-foreground backdrop-blur-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-gold shrink-0" />
                  {heroPhotos[heroIndex]?.label}
                </motion.span>
              </AnimatePresence>

              <div className="flex items-center gap-2">
                <div role="group" aria-label="Choose a community photo" className="flex items-center gap-1">
                  {heroPhotos.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectHero(i)}
                      aria-label={`Show photo ${i + 1} of ${heroPhotos.length}: ${p.label}`}
                      aria-pressed={i === heroIndex}
                      className="inline-flex size-7 items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
                    >
                      <span
                        className={`block h-1.5 rounded-full transition-all duration-300 ${
                          i === heroIndex ? 'w-4 bg-accent-gold' : 'w-1.5 bg-white/50'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {heroPhotos.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setIsPaused((paused) => !paused)}
                    aria-label={isPaused ? 'Resume photo rotation' : 'Pause photo rotation'}
                    aria-pressed={isPaused}
                    className="inline-flex size-7 items-center justify-center rounded-sm border border-white/30 bg-secondary/60 text-white transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold motion-reduce:hidden"
                  >
                    {isPaused ? (
                      <Play size={12} aria-hidden="true" />
                    ) : (
                      <Pause size={12} aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* ── Row 2: fixed pair ── */}
        <div className="grid grid-cols-2 gap-4">
          {pairPhotos.map((photo) => (
            <div
              key={photo.id}
              className="relative aspect-square overflow-hidden rounded-sm border border-foreground/20 bg-surface-deep"
            >
              <GalleryImage
                src={photo.src}
                alt={photo.alt}
                className="object-cover"
                sizes="(min-width: 1024px) 22vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-secondary/70 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <span className="bg-secondary/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
                  {photo.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Caption strip — outside aria-hidden so the link is keyboard-reachable */}
      <div className="flex items-center justify-between border-t border-foreground/20 pt-3">
        <span
          className="text-[10px] text-muted-foreground dark:text-ink-muted-on-dark font-medium"
          aria-hidden="true"
        >
          <DataPoint as="span" name="home.hero.community_moments" initialData={dataPoints}>
            Community moments
          </DataPoint>
        </span>
        <Link
          href="/gallery"
          className="text-[10px] text-primary-ink dark:text-primary-on-dark-muted hover:text-primary dark:hover:text-primary-on-dark font-bold uppercase tracking-wider transition-colors"
        >
          <DataPoint as="span" name="home.hero.view_gallery" initialData={dataPoints}>
            View Gallery →
          </DataPoint>
        </Link>
      </div>
    </div>
  );
}
