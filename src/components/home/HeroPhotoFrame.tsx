'use client';

import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getGalleryPhotos } from '@/lib/queries/content-client';

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

// Hero crossfade photos (top 4 by sort_order, is_hero=true)
const useHeroPhotos = (): Photo[] => {
  const [heroPhotos, setHeroPhotos] = useState<Photo[]>([]);
  useEffect(() => {
    getGalleryPhotos().then((photos) => {
      // GalleryPhoto has: id, url, alt, caption, location, category, signQuote, date, photographer, is_hero, is_pair, sort_order
      // Type 'category' is string, not the union type — filter by known categories
      const knownCategories = [
        'No Kings Sacramento',
        'NorCal Resist',
        'Sacramento Unity',
        'Witty Signs',
        'Resistance Choir',
        'Legacy Archives',
      ] as const;
      const heroes = photos
        .filter(
          (p): p is typeof p & { is_hero: true } =>
            p.is_hero === true &&
            knownCategories.includes(p.category as (typeof knownCategories)[number])
        )
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      setHeroPhotos(
        heroes.slice(0, 4).map((p) => ({
          id: p.id,
          src: p.url,
          alt: p.alt || p.caption || '',
          label: (p as { label?: string }).label || p.caption || '',
        }))
      );
    });
  }, []);

  return heroPhotos;
};

// Pair photos (is_pair=true)
const usePairPhotos = (): Photo[] => {
  const [pairPhotos, setPairPhotos] = useState<Photo[]>([]);
  useEffect(() => {
    getGalleryPhotos().then((photos) => {
      const pairs = photos.filter((p) => p.is_pair === true);
      setPairPhotos(
        pairs.map((p) => ({
          id: p.id,
          src: p.url,
          alt: p.alt || p.caption || '',
          label: (p as { label?: string }).label || p.caption || '',
        }))
      );
    });
  }, []);

  return pairPhotos;
};

const HERO_INTERVAL = 6000; // ms between hero crossfades

const EASE_STD = [0.4, 0, 0.2, 1] as const;

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_STD, delay: i * 0.11 },
  }),
};

export function HeroPhotoFrame() {
  const reduced = useReducedMotion();
  const heroPhotos = useHeroPhotos();
  const pairPhotos = usePairPhotos();
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    if (reduced !== false) return;
    const t = setInterval(() => setHeroIndex((p) => (p + 1) % heroPhotos.length), HERO_INTERVAL);
    return () => clearInterval(t);
  }, [reduced, heroPhotos.length]);

  const dur = reduced !== false ? 0 : undefined;

  return (
    <div className="flex flex-col gap-3 select-none w-full max-w-full md:max-w-2xl lg:max-w-3xl mx-auto">
      <div aria-hidden="true" className="flex flex-col gap-3">
        {/* ── Row 1: crossfading large photo ── */}
        <motion.div
          custom={0}
          variants={rowVariants}
          initial={reduced !== false ? 'visible' : 'hidden'}
          animate="visible"
          className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50 aspect-[4/3]"
        >
          <AnimatePresence mode="sync">
            <motion.div
              key={heroPhotos[heroIndex]?.id}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: dur ?? 1.1, ease: EASE_STD }}
            >
              <Image
                src={heroPhotos[heroIndex]?.src}
                alt={heroPhotos[heroIndex]?.alt}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 44vw, 100vw"
                priority
              />
            </motion.div>
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent pointer-events-none" />

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <AnimatePresence mode="wait">
              <motion.span
                key={heroPhotos[heroIndex]?.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 5 }}
                transition={{ duration: dur ?? 0.3 }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-sm border border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-300"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {heroPhotos[heroIndex]?.label}
              </motion.span>
            </AnimatePresence>

            <div className="flex items-center gap-1.5">
              {heroPhotos.map((p, i) => (
                <span
                  key={p.id}
                  className={`block rounded-full transition-all duration-300 ${
                    i === heroIndex ? 'w-4 h-1.5 bg-amber-400' : 'w-1.5 h-1.5 bg-white/25'
                  }`}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Row 2: fixed pair ── */}
        <motion.div
          custom={1}
          variants={rowVariants}
          initial={reduced !== false ? 'visible' : 'hidden'}
          animate="visible"
          className="grid grid-cols-2 gap-3"
        >
          {pairPhotos.map((photo) => (
            <div
              key={photo.id}
              className="relative rounded-xl overflow-hidden border border-white/10 shadow-lg aspect-square"
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 22vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300 bg-slate-950/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                  {photo.label}
                </span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Caption strip — outside aria-hidden so the link is keyboard-reachable */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-slate-500 font-medium" aria-hidden="true">
          Community moments
        </span>
        <Link
          href="/gallery"
          className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider transition-colors"
        >
          View Gallery →
        </Link>
      </div>
    </div>
  );
}
