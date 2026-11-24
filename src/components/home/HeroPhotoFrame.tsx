'use client';

import { Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { GalleryImage } from '@/components/gallery/GalleryImage';
import { DataPoint } from '@/components/ui/DataPoint';
import { FALLBACK_GALLERY_PHOTOS } from '@/config/gallery-fallback';
import { useDataPoints } from '@/hooks/useDataPoints';
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

const toHeroPhoto = (photo: GalleryPhotoView): Photo => ({
  id: photo.id,
  src: photo.url,
  alt: photo.alt || photo.caption || '',
  label: (photo as { label?: string }).label || photo.caption || '',
});

// Hero crossfade photos (top 4 by sort_order, is_hero=true). The homepage
// supplies these rows from the same server read as the gallery preview, so
// this is a pure projection, not a second client-side fetch.
const resolveHeroPhotos = (photos: GalleryPhotoView[]): Photo[] => {
  const heroes = photos
    .filter((photo) => photo.is_hero === true)
    .slice(0, 4)
    .map(toHeroPhoto);
  return heroes.length > 0 ? heroes : FALLBACK_HERO_PHOTOS;
};

// Pair photos (is_pair=true).
const resolvePairPhotos = (photos: GalleryPhotoView[]): Photo[] => {
  const pairs = photos.filter((photo) => photo.is_pair === true).map(toHeroPhoto);
  return pairs.length > 0 ? pairs : FALLBACK_PAIR_PHOTOS;
};

const HERO_INTERVAL = 6000; // ms between hero crossfades
const HERO_FADE_MS = 1000;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reduced;
}

export function HeroPhotoFrame({
  photos: initialPhotos,
  initialData,
}: {
  photos: GalleryPhotoView[];
  initialData?: Record<string, string>;
}) {
  const { dataPoints } = useDataPoints('home', initialData);
  const reduced = usePrefersReducedMotion();
  const heroPhotos = useMemo(() => resolveHeroPhotos(initialPhotos), [initialPhotos]);
  const pairPhotos = useMemo(() => resolvePairPhotos(initialPhotos), [initialPhotos]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [previousHeroIndex, setPreviousHeroIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (reduced || isPaused || heroPhotos.length < 2) return;
    const t = setInterval(() => {
      setPreviousHeroIndex(heroIndex);
      setHeroIndex((heroIndex + 1) % heroPhotos.length);
    }, HERO_INTERVAL);
    return () => clearInterval(t);
  }, [heroIndex, heroPhotos.length, isPaused, reduced]);

  useEffect(() => {
    if (previousHeroIndex === null) return;
    const t = setTimeout(() => setPreviousHeroIndex(null), HERO_FADE_MS);
    return () => clearTimeout(t);
  }, [previousHeroIndex]);

  const selectHero = (index: number) => {
    if (index === heroIndex) return;
    setPreviousHeroIndex(heroIndex);
    setHeroIndex(index);
    // Choosing a frame should keep it on screen rather than letting the timer
    // immediately move on. The explicit pause control is still available.
    setIsPaused(true);
  };

  const previousHero = previousHeroIndex === null ? undefined : heroPhotos[previousHeroIndex];
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
          {previousHero && previousHero.id !== currentHero?.id && (
            <div className="absolute inset-0" aria-hidden="true">
              <GalleryImage
                src={previousHero.src}
                alt=""
                className="object-cover"
                sizes="(min-width: 1024px) 44vw, 100vw"
              />
            </div>
          )}
          {hasHeroes && (
            <div
              key={currentHero?.id}
              className={`absolute inset-0 ${
                previousHero ? 'animate-in fade-in duration-1000 motion-reduce:animate-none' : ''
              }`}
            >
              <GalleryImage
                src={currentHero?.src ?? ''}
                alt={currentHero?.alt ?? ''}
                className="object-cover"
                sizes="(min-width: 1024px) 44vw, 100vw"
                priority
              />
            </div>
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
