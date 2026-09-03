'use client';

import { Camera, ChevronLeft, ChevronRight, MapPin, Maximize2, Share2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getStorageUrl } from '@/lib/supabase';

// Temporary static data - will eventually come from Supabase DB
const snaps = [
  {
    id: 1,
    url: '/snap1.jpg',
    caption: 'Speared Cape Kingfish',
    location: 'Cape Reinga',
    author: '@diver_dan',
  },
  {
    id: 2,
    url: '/snap2.jpg',
    caption: 'Ranfurly Banks Quad',
    location: 'Ranfurly Banks',
    author: '@catch22_crew',
  },
  {
    id: 3,
    url: '/snap3.jpg',
    caption: 'Hauraki Gulf Snapper',
    location: 'Hauraki Gulf',
    author: '@snapper_slayer',
  },
  {
    id: 4,
    url: '/snap4.jpg',
    caption: 'Double Hapuku Drop',
    location: 'White Island',
    author: '@deep_drop_specialist',
  },
  {
    id: 5,
    url: '/snap5.jpg',
    caption: 'Three Kings Groper',
    location: 'Three Kings Islands',
    author: '@groper_hunter',
  },
  {
    id: 6,
    url: '/snap6.jpg',
    caption: 'Ramp Kingfish Double',
    location: 'Mangawhai',
    author: '@harbour_boys',
  },
  {
    id: 7,
    url: '/snap7.jpg',
    caption: 'Offshore Yellowtail',
    location: 'Tutukaka',
    author: '@blue_water_junkie',
  },
  {
    id: 8,
    url: '/snap8.jpg',
    caption: 'Firth Kingfish Lure',
    location: 'Firth of Thames',
    author: '@camo_angler',
  },
  {
    id: 9,
    url: '/snap9.jpg',
    caption: 'Sharing the Catch',
    location: 'Mercury Islands',
    author: '@red_boat_adventures',
  },
  {
    id: 10,
    url: '/snap10.jpg',
    caption: 'Father & Son Trophy',
    location: 'Tauranga Harbour',
    author: '@family_fishing_nz',
  },
  {
    id: 11,
    url: '/snap11.jpg',
    caption: 'Pure Kingfish Hype',
    location: 'Cape Reinga',
    author: '@screaming_reel',
  },
  {
    id: 12,
    url: '/snap12.jpg',
    caption: 'Young Gun Catch',
    location: 'Aldermen Islands',
    author: '@junior_angler',
  },
  {
    id: 13,
    url: '/snap13.jpg',
    caption: 'Sledging Offshore',
    location: 'Mayor Island',
    author: '@mayor_boss',
  },
  {
    id: 14,
    url: '/snap14.jpg',
    caption: 'Deep Drop Groper Double',
    location: 'Ranfurly Banks',
    author: '@hapuku_master',
  },
  {
    id: 15,
    url: '/snap15.jpg',
    caption: 'The Money Shot',
    location: 'Poor Knights Islands',
    author: '@gaff_master',
  },
  {
    id: 16,
    url: '/snap16.jpg',
    caption: 'Trophy Cape Kingfish',
    location: 'Cape Karikari',
    author: '@saltwater_elite',
  },
  {
    id: 17,
    url: '/snap17.jpg',
    caption: 'Sledging the Banks',
    location: 'Ranfurly Banks',
    author: '@banks_basher',
  },
  {
    id: 18,
    url: '/snap18.jpg',
    caption: 'Weigh-in Double',
    location: 'White Island',
    author: '@stussy_scales',
  },
];

export default function GalleryPage() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleNext = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex((prev) => ((prev ?? 0) + 1) % snaps.length);
  }, [selectedIndex]);

  const handlePrev = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex((prev) => ((prev ?? 0) - 1 + snaps.length) % snaps.length);
  }, [selectedIndex]);

  const handleClose = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') handleClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, handleNext, handlePrev, handleClose]);

  const selectedImage = selectedIndex !== null ? snaps[selectedIndex] : null;

  return (
    <main className="min-h-screen pt-32 pb-20 bg-secondary">
      <div className="container mx-auto px-4">
        {/* Header Section */}
        <div className="max-w-4xl mb-24">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-8">
            <Camera className="w-3 h-3 text-primary" />
            <span className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">
              Community Feed
            </span>
          </div>
          <h1 className="text-6xl md:text-9xl font-black text-white uppercase tracking-tighter leading-[0.8] mb-10">
            Catch <br /> <span className="text-primary italic">Snaps</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-2xl font-medium max-w-2xl leading-relaxed tracking-wide">
            A visual collection of moments from the rugged New Zealand coastline.
          </p>
        </div>

        {/* Masonry-style Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {snaps.map((snap, index) => (
            <div
              key={snap.id}
              className="group relative aspect-[4/5] bg-white/5 rounded-[3rem] overflow-hidden shadow-2xl hover:shadow-primary/10 transition-all duration-700 hover:-translate-y-2 border border-white/5"
            >
              <Image
                src={snap.url.startsWith('/') ? snap.url : getStorageUrl(snap.url)}
                alt={snap.caption}
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-110 opacity-80 group-hover:opacity-100"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-secondary/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-10 pointer-events-none">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-primary font-black uppercase tracking-widest text-[10px]">
                    {snap.location}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2 italic">
                  {snap.caption}
                </h3>
                <p className="text-white/60 text-sm font-bold">{snap.author}</p>

                <div className="mt-8 pt-8 border-t border-white/10 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-white">
                    <Maximize2 className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Enlarge
                    </span>
                  </span>
                  <Share2 className="w-5 h-5 text-white/40" />
                </div>
              </div>

              {/* Single interactive control per card — the whole card opens the
                  lightbox. Keeps axe's nested-interactive rule satisfied while
                  preserving the hover-reveal caption overlay. */}
              <button
                type="button"
                className="absolute inset-0 z-20 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => setSelectedIndex(index)}
                aria-label={`View ${snap.caption} from ${snap.location}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 overscroll-contain"
          role="dialog"
          aria-modal="true"
          aria-label="Gallery image viewer"
        >
          <button
            type="button"
            className="absolute inset-0 bg-secondary/98 backdrop-blur-2xl cursor-default"
            onClick={handleClose}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleClose();
            }}
            aria-label="Close gallery"
          />

          {/* Navigation Arrows */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 md:left-10 z-[110] w-14 h-14 bg-white/5 hover:bg-primary hover:text-secondary rounded-full flex items-center justify-center text-white backdrop-blur-md transition-all hidden md:flex"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 md:right-10 z-[110] w-14 h-14 bg-white/5 hover:bg-primary hover:text-secondary rounded-full flex items-center justify-center text-white backdrop-blur-md transition-all hidden md:flex"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="relative w-full max-w-6xl aspect-[4/5] md:aspect-auto md:h-full bg-secondary rounded-[4rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 border border-white/5 z-10">
            <div className="grid grid-cols-1 lg:grid-cols-4 h-full">
              <div className="lg:col-span-3 relative bg-black flex items-center justify-center group/image">
                <Image
                  key={selectedImage.url}
                  src={
                    selectedImage.url.startsWith('/')
                      ? selectedImage.url
                      : getStorageUrl(selectedImage.url)
                  }
                  alt={selectedImage.caption}
                  fill
                  className="object-contain transition-opacity duration-500"
                />
                <button
                  type="button"
                  className="absolute top-10 right-10 w-14 h-14 bg-white/10 hover:bg-primary hover:text-secondary rounded-full flex items-center justify-center text-white backdrop-blur-md transition-all z-20"
                  onClick={handleClose}
                  aria-label="Close gallery"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-12 lg:p-16 flex flex-col justify-center bg-secondary border-l border-white/5">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black italic">
                    {selectedImage.author[1].toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-white font-black uppercase tracking-widest text-sm">
                      {selectedImage.author}
                    </h4>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
                      Verified Angler
                    </p>
                  </div>
                </div>

                <h3 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-6 italic">
                  {selectedImage.caption}
                </h3>

                <div className="flex items-center gap-3 mb-12">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-primary font-black uppercase tracking-widest text-[10px]">
                    {selectedImage.location}
                  </span>
                </div>

                <Link
                  href="/products"
                  className="group flex items-center gap-4 text-white font-black uppercase tracking-[0.3em] text-[10px] hover:text-primary transition-all mt-auto"
                >
                  Shop the Setup{' '}
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
