'use client';

import { ChevronLeft, ChevronRight, Filter, MapPin, Search, Share2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GalleryPhotoRow } from '@/lib/queries/civic';

export interface GalleryClientPhoto {
  id: string;
  url: string;
  alt: string;
  caption: string;
  location: string;
  category: string;
  signQuote: string | null;
  date: string;
  photographer: string;
  is_hero?: boolean;
  is_pair?: boolean;
}

interface Props {
  photos: GalleryClientPhoto[];
}

export function GalleryClient({ photos }: Props) {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of photos) set.add(p.category);
    return ['All', ...Array.from(set)];
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
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
  }, [selectedCategory, searchQuery, photos]);

  const selectedPhoto = photos.find((p) => p.id === selectedPhotoId) ?? null;
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedPhotoId) return;
      if (e.key === 'Escape') setSelectedPhotoId(null);
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoId, handleNext, handlePrev]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <>
      {/* Real-time Search & Filter Controls */}
      <div className="w-full max-w-2xl pt-6 space-y-4 mx-auto">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="Search gallery"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by quote, slogan, location…"
            className="w-full pl-12 pr-10 py-3 rounded-2xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-md shadow-lg"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Filter size={15} className="text-slate-400 mr-1 hidden sm:inline-block" />
          {categories.map((category) => {
            const count = photos.filter((p) => p.category === category).length;
            const isSelected = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedCategory(category)}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105'
                    : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{category}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 rounded-full ${
                    isSelected ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {filteredPhotos.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <p className="text-slate-400 text-base">
              No photos match your current search or category filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold uppercase tracking-wider"
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
                onClick={() => setSelectedPhotoId(photo.id)}
                className="group relative h-88 rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-900 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-700 transition-all shadow-xl"
              >
                <Image
                  src={photo.url}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300 brightness-95 group-hover:brightness-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />
                <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5 max-w-[85%]">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-900/85 backdrop-blur-md border border-slate-700 text-amber-300">
                    {photo.category}
                  </span>
                  {photo.signQuote && (
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-400 text-slate-950 shadow-md truncate max-w-full">
                      &ldquo;{photo.signQuote}&rdquo;
                    </span>
                  )}
                </div>
                <div className="absolute bottom-0 inset-x-0 p-5 z-10 space-y-1.5">
                  <h3 className="font-bold text-white text-base sm:text-lg leading-snug group-hover:text-blue-300 transition-colors line-clamp-2">
                    {photo.caption}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 truncate max-w-[70%]">
                      <MapPin size={12} className="text-amber-400 shrink-0" />
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
        <div className="mt-16 p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-slate-800 text-center space-y-4 max-w-3xl mx-auto">
          <h3 className="text-2xl font-black text-white">
            Have Sacramento Resistance Pics, Unity Shots, or Funny Signs?
          </h3>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Strictly grassroots (zero politicians, zero corporate imagery) — send your photos to our
            media circle to be included!
          </p>
          <div className="pt-2">
            <a
              href="mailto:contact@indivisiblefairoaks.org?subject=Community%20Photo%20Submission"
              className="inline-block px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/25"
            >
              Submit Grassroots Photos
            </a>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedPhoto.caption}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 md:p-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPhotoId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSelectedPhotoId(null);
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedPhotoId(null)}
            className="absolute top-6 right-6 z-50 p-3 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close image modal"
          >
            <X size={20} />
          </button>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-4 sm:left-6 z-50 p-3 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Previous image"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 sm:right-6 z-50 p-3 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Next image"
          >
            <ChevronRight size={24} />
          </button>
          <div className="relative max-w-5xl w-full max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="relative w-full h-[55vh] sm:h-[65vh] bg-black">
              <Image
                src={selectedPhoto.url}
                alt={selectedPhoto.alt}
                fill
                priority
                className="object-contain"
              />
            </div>
            <div className="p-6 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono uppercase font-bold">
                    {selectedPhoto.category}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{selectedPhoto.date}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">{selectedPhoto.caption}</h2>
                {selectedPhoto.signQuote && (
                  <div className="inline-block my-1 px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-black tracking-tight">
                    Featured Sign: &ldquo;{selectedPhoto.signQuote}&rdquo;
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-slate-400 pt-0.5">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-amber-400" />
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
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 size={14} />
                  <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
                </button>
                <Link
                  href="/events"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Attend Next Action
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Re-export type alias so the server page can import from a single location
export type { GalleryPhotoRow };
