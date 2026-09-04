'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// Row 1 — crossfading hero (full-width, marches & rallies)
const HERO_PHOTOS = [
  {
    src: '/images/gallery/sacramento-tower-bridge-march.jpg',
    alt: 'Sacramento Tower Bridge march',
    label: 'Sacramento Bridge March',
  },
  {
    src: '/images/gallery/sacramento-capitol-no-kings.jpg',
    alt: 'Sacramento Capitol No Kings rally',
    label: 'No Kings Rally',
  },
];

// Row 2 — fixed pair
const PAIR_PHOTOS = [
  {
    src: '/images/gallery/carmichael-resistance-choir.jpg',
    alt: 'Carmichael Resistance Choir',
    label: 'Resistance Choir',
  },
  {
    src: '/images/gallery/norcal-resist-brake-light-clinic.jpg',
    alt: 'NorCal Resist brake light clinic',
    label: 'Brake Light Clinic',
  },
];

// Row 3 — rotating strip (witty signs + legacy shots)
const STRIP_PHOTOS = [
  {
    src: '/images/gallery/witty-ikea-sign.jpg',
    alt: 'Witty IKEA-style protest sign',
    label: 'Witty Signs',
  },
  {
    src: '/images/gallery/witty-introverts-sign.jpg',
    alt: 'Witty introverts protest sign',
    label: 'Witty Signs',
  },
  {
    src: '/images/legacy/legacy-good-trouble-1.jpg',
    alt: 'Good Trouble action',
    label: 'Good Trouble',
  },
  {
    src: '/images/legacy/legacy-banner.jpg',
    alt: 'Chapter banner action',
    label: 'Chapter Action',
  },
  {
    src: '/images/legacy/legacy-resistance-choir.jpg',
    alt: 'Resistance Choir legacy photo',
    label: 'Resistance Choir',
  },
];

const HERO_INTERVAL = 6000; // ms between hero crossfades
const STRIP_INTERVAL = 2800; // ms between strip advances

// Staggered mount fade-up for each row
const rowVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const, delay: i * 0.11 },
  }),
};

export function HeroPhotoFrame() {
  const reduced = useReducedMotion();
  const [heroIndex, setHeroIndex] = useState(0);
  const [stripIndex, setStripIndex] = useState(0);

  // Hero crossfade timer
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setHeroIndex((p) => (p + 1) % HERO_PHOTOS.length), HERO_INTERVAL);
    return () => clearInterval(t);
  }, [reduced]);

  // Strip advance timer
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(
      () => setStripIndex((p) => (p + 1) % STRIP_PHOTOS.length),
      STRIP_INTERVAL
    );
    return () => clearInterval(t);
  }, [reduced]);

  const heroPhoto = HERO_PHOTOS[heroIndex];
  // 3-wide sliding window, wraps around
  const stripWindow = [0, 1, 2].map((o) => STRIP_PHOTOS[(stripIndex + o) % STRIP_PHOTOS.length]);

  return (
    <div className="hidden lg:flex flex-col gap-3 select-none" aria-hidden="true">
      {/* ── Row 1: crossfading large photo ── */}
      <motion.div
        custom={0}
        variants={rowVariants}
        initial={reduced ? 'visible' : 'hidden'}
        animate="visible"
        className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50 aspect-[4/3]"
      >
        <AnimatePresence mode="sync">
          <motion.div
            key={heroPhoto.src}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 1.1, ease: 'easeInOut' }}
          >
            <Image
              src={heroPhoto.src}
              alt={heroPhoto.alt}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 44vw, 0px"
              priority
            />
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent pointer-events-none" />

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          {/* Animated label */}
          <AnimatePresence mode="wait">
            <motion.span
              key={heroPhoto.label}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              transition={{ duration: reduced ? 0 : 0.3 }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-sm border border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              {heroPhoto.label}
            </motion.span>
          </AnimatePresence>

          {/* Pill dots */}
          <div className="flex items-center gap-1.5">
            {HERO_PHOTOS.map((p, i) => (
              <span
                key={p.src}
                className={`block rounded-full transition-all duration-400 ${
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
        initial={reduced ? 'visible' : 'hidden'}
        animate="visible"
        className="grid grid-cols-2 gap-3"
      >
        {PAIR_PHOTOS.map((photo) => (
          <div
            key={photo.src}
            className="relative rounded-xl overflow-hidden border border-white/10 shadow-lg aspect-square"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 22vw, 0px"
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

      {/* ── Row 3: rotating strip (3 visible at a time) ── */}
      <motion.div
        custom={2}
        variants={rowVariants}
        initial={reduced ? 'visible' : 'hidden'}
        animate="visible"
        className="grid grid-cols-3 gap-3"
      >
        <AnimatePresence mode="popLayout">
          {stripWindow.map((photo) => (
            <motion.div
              key={photo.src}
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.93 }}
              transition={{ duration: reduced ? 0 : 0.4, ease: [0.4, 0, 0.2, 1] as const }}
              className="relative rounded-xl overflow-hidden border border-white/10 shadow-md aspect-[4/3]"
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 14vw, 0px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
              <div className="absolute bottom-1.5 left-1.5 right-1.5">
                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full leading-none">
                  {photo.label}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* ── Caption strip ── */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-slate-500 font-medium">Community moments</span>
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
