'use client';

import { Pause, Play } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GalleryImage } from '@/components/gallery/GalleryImage';
import { DataPoint } from '@/components/ui/DataPoint';
import { FALLBACK_GALLERY_PHOTOS } from '@/config/gallery-fallback';
import { useDataPoints } from '@/hooks/useDataPoints';

import { getGalleryPhotos } from '@/lib/queries/content-client';
import type { GalleryPhotoView } from '@/types/gallery';

interface Photo {
  id: string;
  src: string;
  alt: string;
  label: string;
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
  const currentHero = heroPhotos[heroIndex];
  const hasHeroes = heroPhotos.length > 0;
  const hasMultipleHeroes = heroPhotos.length > 1;

  return (
    <div className="mx-auto flex w-full select-none flex-col gap-5 md:max-w-2xl lg:max-w-3xl">
      {/* ── Row 1: crossfading large photo ── */}
      <figure>
        <div
          role="group"
          aria-roledescription="carousel"
          aria-label="Community photo highlights"
          className="relative aspect-[4/3] overflow-hidden rounded-sm border border-foreground/25 bg-surface-deep"
        >
          <span aria-hidden="true" className="absolute left-2 top-2 z-10 size-1.5 bg-accent" />
          {hasHeroes && (
            <AnimatePresence initial={false}>
              <motion.div
                key={currentHero?.id}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur ?? 1.1, ease: EASE_STD }}
              >
                <GalleryImage
                  src={currentHero?.src ?? ''}
                  alt={currentHero?.alt ?? ''}
                  className="object-cover"
                  sizes="(min-width: 1024px) 44vw, 100vw"
                  priority
                />
              </motion.div>
            </AnimatePresence>
          )}
          {!hasHeroes && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-muted px-6 text-center">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground dark:text-ink-muted-on-dark">
                <DataPoint as="span" name="home.hero.community_moments" initialData={dataPoints}>
                  Community moments
                </DataPoint>
              </span>
            </div>
          )}

          {hasMultipleHeroes && (
            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
              <div
                role="group"
                aria-label="Choose a community photo"
                className="flex items-center gap-1 border border-white/15 bg-secondary/55 p-1 backdrop-blur-sm"
              >
                {heroPhotos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectHero(i)}
                    aria-label={`Show photo ${i + 1} of ${heroPhotos.length}: ${p.label}`}
                    aria-pressed={i === heroIndex}
                    className="inline-flex size-9 items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
                  >
                    <span
                      className={`block h-1.5 rounded-full transition-all duration-300 ${
                        i === heroIndex ? 'w-4 bg-accent-gold' : 'w-1.5 bg-white/50'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsPaused((paused) => !paused)}
                aria-label={isPaused ? 'Resume photo rotation' : 'Pause photo rotation'}
                aria-pressed={isPaused}
                className="inline-flex size-9 items-center justify-center rounded-sm border border-white/15 bg-secondary/55 text-white backdrop-blur-sm transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold motion-reduce:hidden"
              >
                {isPaused ? (
                  <Play size={14} aria-hidden="true" />
                ) : (
                  <Pause size={14} aria-hidden="true" />
                )}
              </button>
            </div>
          )}
        </div>

        <figcaption className="mt-3 flex flex-col gap-2 border-t border-foreground/25 pt-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
          <div className="min-w-0">
            <span className="civic-meta">
              <DataPoint as="span" name="home.hero.community_moments" initialData={dataPoints}>
                Community moments
              </DataPoint>
            </span>
            {hasHeroes && (
              <span className="mt-1 line-clamp-2 block min-h-[2lh] font-display text-sm font-semibold leading-snug text-foreground">
                {currentHero?.label}
              </span>
            )}
          </div>
          {hasHeroes && (
            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground lg:pt-0.5">
              {String(heroIndex + 1).padStart(2, '0')} /{' '}
              {String(heroPhotos.length).padStart(2, '0')}
            </span>
          )}
        </figcaption>
      </figure>

      {/* ── Row 2: fixed pair ── */}
      <div className="grid grid-cols-2 gap-4">
        {pairPhotos.map((photo) => (
          <figure key={photo.id} className="min-w-0">
            <div className="relative aspect-square overflow-hidden rounded-sm border border-foreground/20 bg-surface-deep">
              <GalleryImage
                src={photo.src}
                alt={photo.alt}
                className="object-cover"
                sizes="(min-width: 1024px) 22vw, 50vw"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-secondary/20 to-transparent"
              />
            </div>
            <figcaption className="mt-2 min-h-8 border-t border-foreground/20 pt-2">
              <span className="line-clamp-2 text-[10px] font-semibold leading-snug text-muted-foreground">
                {photo.label}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      {/* Archive link — outside aria-hidden so it is keyboard-reachable */}
      <div className="flex items-center justify-between border-t border-foreground/20 pt-3">
        <span className="civic-meta" aria-hidden="true">
          Chapter photo archive
        </span>
        <Link
          href="/gallery"
          className="inline-flex min-h-10 items-center text-[10px] font-bold uppercase tracking-wider text-primary-ink transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-primary-on-dark-muted dark:hover:text-primary-on-dark"
        >
          <DataPoint as="span" name="home.hero.view_gallery" initialData={dataPoints}>
            View Gallery →
          </DataPoint>
        </Link>
      </div>
    </div>
  );
}
