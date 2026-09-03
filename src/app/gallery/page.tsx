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
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';

interface CivicPhoto {
  id: string;
  url: string;
  caption: string;
  location: string;
  category: 'No Kings Protests' | 'Witty Signs & Humor' | 'Resistance Choir' | 'Community Action';
  date: string;
  photographer: string;
  signQuote?: string;
}

const CIVIC_GALLERY: CivicPhoto[] = [
  {
    id: 'no-kings-protest-mass',
    url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
    caption: 'No Kings in America: Mass mobilization defending constitutional rule of law',
    location: 'Downtown Sacramento Plaza',
    category: 'No Kings Protests',
    date: 'October 2026',
    photographer: 'Indivisible Action Media',
    signQuote: 'We Fought A War About This In 1776',
  },
  {
    id: 'funny-sign-ikea',
    url: 'https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?auto=format&fit=crop&w=1200&q=80',
    caption: 'Creative Resistance: Witty Cardboard Signs at Fair Oaks Blvd Stand-Out',
    location: 'Fair Oaks Blvd & Manzanita Ave, Carmichael',
    category: 'Witty Signs & Humor',
    date: 'August 2026',
    photographer: 'Elena R., Member',
    signQuote: "I've Seen Smarter Cabinets At IKEA",
  },
  {
    id: 'choir-street-harmony',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    caption: 'Carmichael Resistance Choir singing "Singing for Our Lives"',
    location: 'St. Michael’s Parish Hall, Carmichael',
    category: 'Resistance Choir',
    date: 'July 2026',
    photographer: 'Marcus T., Press Liaison',
    signQuote: 'Defiant 4-Part Harmonies for Democracy',
  },
  {
    id: 'funny-introverts-rally',
    url: 'https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?auto=format&fit=crop&w=1200&q=80',
    caption: 'Humor in the Streets: Even Introverts Out Here Defending Norms',
    location: 'Carmichael Park Community Rally',
    category: 'Witty Signs & Humor',
    date: 'September 2026',
    photographer: 'David K., Member',
    signQuote: "You Know It's Bad When Introverts Are Out Here",
  },
  {
    id: 'capitol-steps-no-kings',
    url: 'https://images.unsplash.com/photo-1568992687947-868a62a9f521?auto=format&fit=crop&w=1200&q=80',
    caption: 'No Kings Day of Action on the California State Capitol West Steps',
    location: 'California State Capitol, Sacramento',
    category: 'No Kings Protests',
    date: 'June 2026',
    photographer: 'Statewide Coalition Press Pool',
    signQuote: 'Democracy Over Dictatorship',
  },
  {
    id: 'sign-think-again',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
    caption: 'Make America Think Again: Critical Thinking Street Canvas',
    location: 'Sunrise Blvd & Madison Ave, Fair Oaks',
    category: 'Witty Signs & Humor',
    date: 'August 2026',
    photographer: 'Youth Organizing Committee',
    signQuote: 'Make America Think Again',
  },
  {
    id: 'choir-rally-accompaniment',
    url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
    caption: 'Choir raising four-part harmonies before chapter monthly assembly',
    location: 'Carmichael Community Hall',
    category: 'Resistance Choir',
    date: 'May 2026',
    photographer: 'Choir Working Group',
    signQuote: "Ain't Gonna Let Nobody Turn Us Around",
  },
  {
    id: 'good-trouble-banner-drop',
    url: 'https://images.unsplash.com/photo-1576267423445-b2e0074d68a4?auto=format&fit=crop&w=1200&q=80',
    caption: 'Good Trouble Lives On: Annual John Lewis Overpass Banner Action',
    location: 'Highway 50 Pedestrian Overpass, Sacramento',
    category: 'No Kings Protests',
    date: 'July 2026',
    photographer: 'Direct Action Working Group',
    signQuote: 'Good Trouble Lives On!',
  },
  {
    id: 'sign-party-banner-making',
    url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
    caption: 'Hand-painted resistance banners and clever cardboard sign workshop',
    location: 'Fair Oaks Village Arts Center',
    category: 'Witty Signs & Humor',
    date: 'September 2026',
    photographer: 'Creative Arts Team',
    signQuote: 'Art Is Defiant Resistance',
  },
  {
    id: 'rally-fair-oaks-blvd',
    url: 'https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?auto=format&fit=crop&w=1200&q=80',
    caption: 'Democracy Stand-Out: Fair Oaks Blvd & Manzanita Demonstration',
    location: 'Fair Oaks Blvd & Manzanita Ave, Carmichael',
    category: 'No Kings Protests',
    date: 'August 2026',
    photographer: 'Indivisible Field Team',
  },
  {
    id: 'postcard-blitz-2026',
    url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80',
    caption: 'Writing 1,200 handwritten postcards to swing district voters',
    location: 'Fair Oaks Community Clubhouse',
    category: 'Community Action',
    date: 'September 2026',
    photographer: 'Voter Outreach Working Group',
  },
  {
    id: 'high-school-voter-drive',
    url: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80',
    caption: 'Youth voter pre-registration drive in Sacramento County high schools',
    location: 'Bella Vista & Del Campo High Schools',
    category: 'Community Action',
    date: 'October 2026',
    photographer: 'Youth Civic Initiative',
  },
  {
    id: 'candlelight-democracy-vigil',
    url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
    caption: 'Candlelight Vigil for Constitutional Norms & Peaceful Transfer of Power',
    location: 'Fair Oaks Plaza Park',
    category: 'No Kings Protests',
    date: 'January 2026',
    photographer: 'Community Peace Circle',
  },
  {
    id: 'volunteers-solidarity-day',
    url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
    caption: 'Sacramento & Fair Oaks volunteers ready for neighborhood canvassing blitz',
    location: 'Ancil Hoffman Park, Carmichael',
    category: 'Community Action',
    date: 'August 2026',
    photographer: 'Grassroots Field Coordinator',
  },
];

export default function GalleryPage() {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedLink, setCopiedLink] = useState(false);

  const categories = [
    'All',
    'No Kings Protests',
    'Witty Signs & Humor',
    'Resistance Choir',
    'Community Action',
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
      {/* Hero Header with VGPU Constellation Network */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-16 px-4 sm:px-6 lg:px-8">
        <VgpuCivicConstellation />
        <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center text-center space-y-4 pointer-events-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            <Camera size={14} className="text-amber-400" />
            <span>Resistance Moments & Creative Signs</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08]">
            Democracy In Full View
          </h1>

          <div className="h-1.5 w-24 bg-amber-400 rounded-full" />

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
            From No Kings protests and witty cardboard signs on Fair Oaks Blvd to four-part harmony
            singing protests and Capitol steps rallies, here is our grassroots resistance in action.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-4xl pt-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-2xl font-black text-amber-400 block font-mono">50+</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                No Kings Rallies
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-2xl font-black text-blue-400 block font-mono">100+</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Creative Signs
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-2xl font-black text-emerald-400 block font-mono">40+</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Choir Anthems
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-2xl font-black text-purple-400 block font-mono">100%</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Grassroots
              </span>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center justify-center gap-2 flex-wrap pt-6">
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
      </div>

      {/* Gallery Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
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

              {/* Top Tag & Witty Sign Badge */}
              <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5 max-w-[80%]">
                <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-900/80 backdrop-blur-md border border-slate-700 text-amber-300">
                  {photo.category}
                </span>
                {photo.signQuote && (
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-400 text-slate-950 shadow-md truncate max-w-full">
                    “{photo.signQuote}”
                  </span>
                )}
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
          <h3 className="text-2xl font-black text-white">
            Have Great Resistance Pics or Funny Signs?
          </h3>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Did you snap a brilliant, funny cardboard sign or a high-energy photo at a recent No
            Kings rally, choir singing protest, or neighborhood stand-out? Send them to our chapter
            media team!
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
                {selectedPhoto.signQuote && (
                  <div className="inline-block my-1 px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-black tracking-tight">
                    Featured Sign: “{selectedPhoto.signQuote}”
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
