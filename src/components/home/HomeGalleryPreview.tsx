'use client';

import { ArrowRight, Camera, Filter, MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getGalleryPhotos } from '@/lib/queries/content-client';
import type { GalleryPhotoView } from '@/types/gallery';

interface PreviewPhoto {
  id: string;
  title: string;
  location: string;
  category:
    | 'No Kings Sacramento'
    | 'NorCal Resist'
    | 'Sacramento Unity'
    | 'Witty Signs'
    | 'Resistance Choir'
    | 'Legacy Archives';
  image: string;
  signQuote?: string;
  date: string;
}

export function HomeGalleryPreview({
  photos: initialPhotos,
}: {
  photos?: GalleryPhotoView[];
} = {}) {
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [previewPhotos, setPreviewPhotos] = useState<PreviewPhoto[]>(() => {
    if (initialPhotos && initialPhotos.length > 0) {
      return initialPhotos.map((p) => ({
        id: p.id,
        title: p.caption || p.alt || '',
        location: p.location || '',
        category: (p.category as PreviewPhoto['category']) || 'No Kings Sacramento',
        image: p.url || '',
        signQuote: p.signQuote ?? undefined,
        date: p.date || '',
      }));
    }
    return [];
  });

  useEffect(() => {
    if (initialPhotos && initialPhotos.length > 0) return;
    getGalleryPhotos().then((photos) => {
      // Map gallery_photos rows to PreviewPhoto format
      const mapped = photos.map((p) => ({
        id: p.id,
        title: p.caption || p.alt || '',
        location: p.location || '',
        category: (p.category as PreviewPhoto['category']) || 'No Kings Sacramento',
        image: p.url || '',
        signQuote: p.signQuote ?? undefined,
        date: p.date || '',
      }));
      setPreviewPhotos(mapped);
    });
  }, [initialPhotos]);

  const filterOptions = [
    'All',
    'No Kings Sacramento',
    'NorCal Resist',
    'Sacramento Unity',
    'Witty Signs',
    'Resistance Choir',
    'Legacy Archives',
  ];

  const displayedPhotos =
    selectedFilter === 'All'
      ? previewPhotos.slice(0, 6)
      : previewPhotos.filter((p) => p.category === selectedFilter);

  return (
    <section className="py-16 md:py-24 bg-secondary text-white border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-bright/10 border border-primary-on-dark-muted/30 text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-3">
              <Camera size={14} className="text-accent-gold" />
              <span>Photojournalism In Action</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight">
              Moments of Peaceful Resistance
            </h2>
            <p className="text-sm sm:text-base text-ink-on-dark mt-2 max-w-2xl leading-relaxed">
              Snapshots of our neighbors gathering, singing, holding signs, and speaking truth to
              power across Sacramento County. Strictly 100% grassroots — zero politicians, zero
              corporate branding.
            </p>
          </div>

          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-sm font-bold text-accent-gold hover:text-accent-gold transition-colors uppercase tracking-wider group shrink-0"
          >
            <span>Explore Full Gallery</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Interactive Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap mb-8 pb-2">
          <Filter size={14} className="text-slate-500 mr-1 hidden sm:inline-block" />
          {filterOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSelectedFilter(option)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedFilter === option
                  ? 'bg-primary-bright text-white shadow-md shadow-blue-500/25 scale-105'
                  : 'bg-secondary text-ink-muted-on-dark hover:text-white hover:bg-white/5 border border-white/10'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Responsive Photojournalism Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedPhotos.map((photo) => (
            <Link
              key={photo.id}
              href="/gallery"
              className="group relative h-88 rounded-3xl overflow-hidden border border-white/10 bg-secondary shadow-xl hover:border-slate-700 transition-all block text-left"
            >
              <Image
                src={photo.image}
                alt={photo.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300 brightness-95 group-hover:brightness-100"
              />

              {/* Gradient Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />

              {/* Top Badges */}
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

              {/* Bottom Metadata */}
              <div className="absolute bottom-0 inset-x-0 p-5 z-10 space-y-1.5">
                <h3 className="font-bold text-white text-base sm:text-lg leading-snug group-hover:text-primary-on-dark transition-colors">
                  {photo.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-ink-muted-on-dark">
                  <span className="flex items-center gap-1 truncate max-w-[70%]">
                    <MapPin size={12} className="text-accent-gold shrink-0" />
                    <span className="truncate">{photo.location}</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 shrink-0">
                    {photo.date}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
