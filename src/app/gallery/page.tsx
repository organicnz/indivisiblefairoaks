'use client';

import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Maximize2,
  Share2,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface CivicPhoto {
  id: string;
  url: string;
  caption: string;
  location: string;
  category: 'Rallies & Vigils' | 'Resistance Choir' | 'Voter Action' | 'Capitol Advocacy';
  date: string;
  photographer: string;
}

const CIVIC_GALLERY: CivicPhoto[] = [
  {
    id: 'rally-fair-oaks-blvd',
    url: 'https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?auto=format&fit=crop&w=1200&q=80',
    caption: 'Democracy Stand-Out: Fair Oaks Blvd & Manzanita Demonstration',
    location: 'Fair Oaks Blvd & Manzanita Ave, Carmichael',
    category: 'Rallies & Vigils',
    date: 'August 2026',
    photographer: 'Indivisible Field Team',
  },
  {
    id: 'choir-street-harmony',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    caption: 'Carmichael Resistance Choir singing "Singing for Our Lives"',
    location: 'St. Michael’s Parish Hall, Carmichael',
    category: 'Resistance Choir',
    date: 'July 2026',
    photographer: 'Elena R., Member',
  },
  {
    id: 'capitol-steps-rally',
    url: 'https://images.unsplash.com/photo-1568992687947-868a62a9f521?auto=format&fit=crop&w=1200&q=80',
    caption: 'Statewide Indivisible Coalition on the California Capitol West Steps',
    location: 'California State Capitol, Sacramento',
    category: 'Capitol Advocacy',
    date: 'June 2026',
    photographer: 'Marcus T., Press Liaison',
  },
  {
    id: 'postcard-blitz-2026',
    url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80',
    caption: 'Writing 1,200 handwritten postcards to swing district voters for voter registration',
    location: 'Fair Oaks Community Clubhouse',
    category: 'Voter Action',
    date: 'September 2026',
    photographer: 'Voter Outreach Working Group',
  },
  {
    id: 'choir-rally-accompaniment',
    url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
    caption: 'Choir members raising four-part harmonies before the chapter monthly assembly',
    location: 'Carmichael Community Hall',
    category: 'Resistance Choir',
    date: 'May 2026',
    photographer: 'David K., Choir Director',
  },
  {
    id: 'climate-justice-stand',
    url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80',
    caption: 'American River Parkway Environmental Protection Demonstration',
    location: 'Sunrise Recreation Area, Fair Oaks',
    category: 'Rallies & Vigils',
    date: 'April 2026',
    photographer: 'Environmental Committee',
  },
  {
    id: 'high-school-voter-drive',
    url: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80',
    caption: 'Youth voter pre-registration drive in Sacramento County high schools',
    location: 'Bella Vista & Del Campo High Schools',
    category: 'Voter Action',
    date: 'October 2026',
    photographer: 'Youth Civic Initiative',
  },
  {
    id: 'town-hall-accountability',
    url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    caption: 'Citizens Town Hall holding Sacramento County leaders accountable',
    location: 'Carmichael Library Assembly Room',
    category: 'Capitol Advocacy',
    date: 'March 2026',
    photographer: 'Sarah P., Organizing Chair',
  },
  {
    id: 'candlelight-democracy-vigil',
    url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
    caption: 'Candlelight Vigil for Constitutional Norms & Peaceful Transfer of Power',
    location: 'Fair Oaks Plaza Park',
    category: 'Rallies & Vigils',
    date: 'January 2026',
    photographer: 'Community Peace Circle',
  },
];

export default function GalleryPage() {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedLink, setCopiedLink] = useState(false);

  const categories = [
    'All',
    'Rallies & Vigils',
    'Resistance Choir',
    'Voter Action',
    'Capitol Advocacy',
  ];

  const filteredPhotos = CIVIC_GALLERY.filter(
    (photo) => selectedCategory === 'All' || photo.category === selectedCategory
  );

  const selectedPhoto = CIVIC_GALLERY.find((p) => p.id === selectedPhotoId) ?? null;
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

  // Keyboard navigation
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
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="bg-slate-950 text-white min-h-screen pt-24 pb-20">
      {/* Hero Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            <Camera size={14} className="text-amber-400" />
            <span>Photojournalism & Grassroots Moments</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08]">
            Democracy In Full View
          </h1>

          <div className="h-1.5 w-24 bg-amber-400 rounded-full" />

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
            From singing peaceful protest songs on local street corners to handwriting thousands of
            postcards and rallying at the California State Capitol, here is our grassroots movement
            in action.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full pt-4">
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-center">
              <span className="text-2xl font-black text-amber-400 block font-mono">50+</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Street Rallies
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-center">
              <span className="text-2xl font-black text-blue-400 block font-mono">12,000+</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Postcards Sent
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-center">
              <span className="text-2xl font-black text-emerald-400 block font-mono">40+</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Choir Anthems
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-center">
              <span className="text-2xl font-black text-purple-400 block font-mono">8+ Years</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Local Organizing
              </span>
            </div>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center justify-center gap-2 flex-wrap mt-10">
          <Filter size={15} className="text-slate-400 mr-1 hidden sm:inline-block" />
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105'
                  : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPhotos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedPhotoId(photo.id)}
              className="group relative h-80 rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-900 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-700 transition-all shadow-xl"
            >
              <Image
                src={photo.url}
                alt={photo.caption}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700 brightness-90 group-hover:brightness-100"
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />

              {/* Top Tag */}
              <div className="absolute top-4 left-4 z-10">
                <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-900/80 backdrop-blur-md border border-slate-700 text-amber-300">
                  {photo.category}
                </span>
              </div>

              <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white border border-slate-700">
                  <Maximize2 size={14} />
                </div>
              </div>

              {/* Bottom Caption */}
              <div className="absolute bottom-0 inset-x-0 p-5 z-10 space-y-1.5">
                <h3 className="font-bold text-white text-base sm:text-lg leading-snug group-hover:text-blue-300 transition-colors">
                  {photo.caption}
                </h3>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1 truncate max-w-[70%]">
                    <MapPin size={12} className="shrink-0 text-amber-400" />
                    <span className="truncate">{photo.location}</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 shrink-0">
                    {photo.date}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Submit Photo CTA */}
        <div className="mt-16 p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-slate-800 text-center space-y-4 max-w-3xl mx-auto">
          <h3 className="text-2xl font-black text-white">Have Photos from a Recent Action?</h3>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Were you at a recent Fair Oaks rally, chorus rehearsal, or voter outreach drive? Send us
            your photos to be featured in our community archive!
          </p>
          <div className="pt-2">
            <a
              href="mailto:contact@indivisiblefairoaks.org?subject=Community%20Photo%20Submission"
              className="inline-block px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/25"
            >
              Submit Photos to Media Committee
            </a>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 md:p-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPhotoId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSelectedPhotoId(null);
          }}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={() => setSelectedPhotoId(null)}
            className="absolute top-6 right-6 z-50 p-3 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close image modal"
          >
            <X size={20} />
          </button>

          {/* Prev Button */}
          <button
            type="button"
            onClick={() => handlePrev()}
            className="absolute left-4 sm:left-6 z-50 p-3 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Next Button */}
          <button
            type="button"
            onClick={() => handleNext()}
            className="absolute right-4 sm:right-6 z-50 p-3 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Next image"
          >
            <ChevronRight size={24} />
          </button>

          {/* Modal Content Box */}
          <div className="relative max-w-5xl w-full max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            {/* Image Container */}
            <div className="relative w-full h-[55vh] sm:h-[65vh] bg-black">
              <Image
                src={selectedPhoto.url}
                alt={selectedPhoto.caption}
                fill
                priority
                className="object-contain"
              />
            </div>

            {/* Modal Info Bar */}
            <div className="p-6 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono uppercase font-bold">
                    {selectedPhoto.category}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{selectedPhoto.date}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">{selectedPhoto.caption}</h2>
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
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center gap-1.5"
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
    </div>
  );
}
