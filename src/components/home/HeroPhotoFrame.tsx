'use client';

import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStorageUrl } from '@/lib/supabase';

interface Photo {
  id: string;
  src: string;
  alt: string;
  label: string;
}

// Row 1 — crossfading hero (full-width) — all sourced from Supabase storage
const HERO_PHOTOS: Photo[] = [
  {
    id: 'no-kings-banner',
    src: getStorageUrl('gallery/no-kings-constitution-banner.jpg'),
    alt: 'Chapter members with handcrafted constitutional rights banner',
    label: 'No Kings In America',
  },
  {
    id: 'unity-brave',
    src: getStorageUrl('gallery/unity-be-brave-with-us.jpg'),
    alt: 'Be Brave With Us solidarity stand-out',
    label: 'Be Brave With Us',
  },
  {
    id: 'witty-grandfather',
    src: getStorageUrl('gallery/witty-grandfather-ww2-antifa.jpg'),
    alt: 'Witty WW2 antifa protest sign',
    label: 'Witty Signs',
  },
  {
    id: 'highway-good-trouble',
    src: getStorageUrl('gallery/highway-overpass-good-trouble.jpg'),
    alt: 'Good Trouble banner drop on Highway 50 overpass',
    label: 'Good Trouble',
  },
];

// Row 2 — fixed pair — sourced from Supabase storage
const PAIR_PHOTOS: Photo[] = [
  {
    id: 'choir-outdoor',
    src: getStorageUrl('gallery/choir-outdoor-rehearsal.jpg'),
    alt: 'Carmichael Resistance Choir outdoor rehearsal',
    label: 'Resistance Choir',
  },
  {
    id: 'voter-registration',
    src: getStorageUrl('gallery/voter-registration-homeless-vote.jpg'),
    alt: 'Grassroots voter registration action',
    label: 'Voter Registration',
  },
];

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
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    if (reduced !== false) return;
    const t = setInterval(() => setHeroIndex((p) => (p + 1) % HERO_PHOTOS.length), HERO_INTERVAL);
    return () => clearInterval(t);
  }, [reduced]);

  const heroPhoto = HERO_PHOTOS[heroIndex];
  const dur = reduced !== false ? 0 : undefined;

  return (
    // Outer wrapper — decorative, hidden from AT. Gallery link is outside.
    // Visible on all breakpoints: stacked below copy on mobile, right column on lg+.
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
              key={heroPhoto.id}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: dur ?? 1.1, ease: EASE_STD }}
            >
              <Image
                src={heroPhoto.src}
                alt={heroPhoto.alt}
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
                key={heroPhoto.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 5 }}
                transition={{ duration: dur ?? 0.3 }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-sm border border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-300"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {heroPhoto.label}
              </motion.span>
            </AnimatePresence>

            <div className="flex items-center gap-1.5">
              {HERO_PHOTOS.map((p, i) => (
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
          {PAIR_PHOTOS.map((photo) => (
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
