'use client';

import { ArrowRight, Camera, Filter, MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { getStorageUrl } from '@/lib/supabase';

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

const PREVIEW_PHOTOS: PreviewPhoto[] = [
  {
    id: 'no-kings-constitution',
    title: 'No Kings in America: Constitution Banner',
    location: 'Fair Oaks Boulevard Demonstration',
    category: 'No Kings Sacramento',
    signQuote: 'No Kings In America — The Constitution',
    date: 'Community Stand-Out',
    image: getStorageUrl('gallery/no-kings-constitution-banner.jpg'),
  },
  {
    id: 'no-kings-standout',
    title: 'Gold Country Blvd Grassroots Mobilization',
    location: 'Gold Country Blvd, Fair Oaks',
    category: 'No Kings Sacramento',
    signQuote: 'No ICE, No War, No King',
    date: 'Weekend Stand-Out',
    image: getStorageUrl('gallery/no-kings-roadside-standout.jpg'),
  },
  {
    id: 'norcal-mutual-aid',
    title: 'Indivisible Mutual Aid & Food Drive',
    location: 'Fair Oaks Park Pavilion',
    category: 'NorCal Resist',
    signQuote: 'Mutual Aid Across Every Neighborhood',
    date: 'Community Food Drive',
    image: getStorageUrl('gallery/mutual-aid-fair-oaks-park.jpg'),
  },
  {
    id: 'norcal-voter-rights',
    title: 'Grassroots Voter Registration Action',
    location: 'Sacramento Community Hub',
    category: 'NorCal Resist',
    signQuote: 'Homeless Does Not Mean Voteless',
    date: 'Civic Engagement Drive',
    image: getStorageUrl('gallery/voter-registration-homeless-vote.jpg'),
  },
  {
    id: 'unity-be-brave',
    title: 'Be Brave With Us! Solidarity Line',
    location: 'Fair Oaks Blvd & Sunrise Blvd',
    category: 'Sacramento Unity',
    signQuote: 'Be Brave With Us! Indivisible Fair Oaks',
    date: 'Boulevard Stand-Out',
    image: getStorageUrl('gallery/unity-be-brave-with-us.jpg'),
  },
  {
    id: 'unity-one-voice',
    title: 'Sacramento Grassroots Democracy Stand-Out',
    location: 'Fair Oaks Village Center',
    category: 'Sacramento Unity',
    signQuote: 'One Voice — Your Vote Counts In CA',
    date: 'Community Gathering',
    image: getStorageUrl('gallery/unity-one-voice-vote-counts.jpg'),
  },
  {
    id: 'witty-grandfather',
    title: 'Historical Truth On Cardboard',
    location: 'Fair Oaks Boulevard',
    category: 'Witty Signs',
    signQuote: 'If Your Grandfather Fought In WW2 He Was Anti-Fascist!',
    date: 'Sidewalk Action',
    image: getStorageUrl('gallery/witty-grandfather-ww2-antifa.jpg'),
  },
  {
    id: 'witty-cat-nope',
    title: 'Satirical Grassroots Wit',
    location: 'Carmichael Community Sidewalk',
    category: 'Witty Signs',
    signQuote: 'Democracy Needs Your Courage (NOPE Since 1776)',
    date: 'Grassroots Rally',
    image: getStorageUrl('gallery/witty-cat-nope-since-1776.jpg'),
  },
  {
    id: 'choir-outdoor',
    title: 'Carmichael Resistance Choir Outdoor Rehearsal',
    location: 'Carmichael Community Park',
    category: 'Resistance Choir',
    signQuote: 'Singing For Democracy Under The Trees',
    date: 'Vocal Resistance Rehearsal',
    image: getStorageUrl('gallery/choir-outdoor-rehearsal.jpg'),
  },
  {
    id: 'legacy-highway-banner',
    title: 'Highway 50 Good Trouble Banner Drop',
    location: 'Highway 50 Pedestrian Overpass',
    category: 'Legacy Archives',
    signQuote: 'Good Trouble Lives On! Honoring John Lewis',
    date: 'Annual Highway Action',
    image: getStorageUrl('gallery/highway-overpass-good-trouble.jpg'),
  },
  {
    id: 'legacy-foam-hands',
    title: 'Overpass Waves to Highway 50 Commuters',
    location: 'Highway 50 Overpass, Sacramento',
    category: 'Legacy Archives',
    signQuote: 'Waving For Democracy & Justice',
    date: 'Overpass Action',
    image: getStorageUrl('gallery/highway-overpass-foam-hands.jpg'),
  },
  {
    id: 'legacy-official-banner',
    title: 'Official Chapter Welcome Banner',
    location: 'Fair Oaks & Carmichael, CA',
    category: 'Legacy Archives',
    signQuote: 'Indivisible Fair Oaks - Carmichael',
    date: 'Historic Chapter Archive',
    image: getStorageUrl('gallery/legacy-chapter-official-banner.jpg'),
  },
];

export function HomeGalleryPreview() {
  const [selectedFilter, setSelectedFilter] = useState<string>('All');

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
      ? PREVIEW_PHOTOS.slice(0, 6)
      : PREVIEW_PHOTOS.filter((p) => p.category === selectedFilter);

  return (
    <section className="py-16 md:py-24 bg-slate-950 text-white border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-3">
              <Camera size={14} className="text-amber-400" />
              <span>Photojournalism In Action</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight">
              Moments of Peaceful Resistance
            </h2>
            <p className="text-sm sm:text-base text-slate-300 mt-2 max-w-2xl leading-relaxed">
              Snapshots of our neighbors gathering, singing, holding signs, and speaking truth to
              power across Sacramento County. Strictly 100% grassroots — zero politicians, zero
              corporate branding.
            </p>
          </div>

          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-wider group shrink-0"
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
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-105'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
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
              className="group relative h-88 rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl hover:border-slate-700 transition-all block text-left"
            >
              <Image
                src={photo.image}
                alt={photo.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700 brightness-95 group-hover:brightness-100"
              />

              {/* Gradient Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />

              {/* Top Badges */}
              <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5 max-w-[85%]">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-900/85 backdrop-blur-md border border-slate-700 text-amber-300">
                  {photo.category}
                </span>
                {photo.signQuote && (
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-400 text-slate-950 shadow-md truncate max-w-full">
                    “{photo.signQuote}”
                  </span>
                )}
              </div>

              {/* Bottom Metadata */}
              <div className="absolute bottom-0 inset-x-0 p-5 z-10 space-y-1.5">
                <h3 className="font-bold text-white text-base sm:text-lg leading-snug group-hover:text-blue-300 transition-colors">
                  {photo.title}
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
            </Link>
          ))}
        </div>

        {/* Community Callout Strip */}
        <div className="mt-12 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm font-bold text-white">
              Have grassroots protest photos, witty signs, or choir snapshots from Sacramento?
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Zero politicians, zero corporate branding — 100% neighbor-to-neighbor solidarity.
            </p>
          </div>
          <Link
            href="/gallery"
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 shrink-0"
          >
            View All Archives
          </Link>
        </div>
      </div>
    </section>
  );
}
