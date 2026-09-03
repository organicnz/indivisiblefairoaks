'use client';

import { ArrowRight, Camera, Filter, MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

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
    id: 'no-kings-capitol',
    title: 'No Kings in America Mass Demonstration',
    location: 'California State Capitol West Steps, Sacramento',
    category: 'No Kings Sacramento',
    signQuote: 'We Fought A War About This In 1776',
    date: 'Sacramento Mobilization',
    image:
      'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'norcal-resist-court',
    title: 'Sacramento Court Watch & Accompaniment',
    location: '501 I Street Federal Courthouse, Sacramento',
    category: 'NorCal Resist',
    signQuote: 'No Human Being Is Illegal',
    date: 'Direct Solidarity Circle',
    image:
      'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'witty-ikea',
    title: 'Satirical Cardboard on Fair Oaks Blvd',
    location: 'Fair Oaks Blvd & Manzanita Ave, Carmichael',
    category: 'Witty Signs',
    signQuote: "I've Seen Smarter Cabinets At IKEA",
    date: 'Community Sidewalk Action',
    image:
      'https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'choir-st-michaels',
    title: 'Resistance Choir 4-Part Harmonies',
    location: 'St. Michael’s Parish Hall, Carmichael',
    category: 'Resistance Choir',
    signQuote: 'Every Good Protest Movement Needs Music',
    date: 'Bi-Weekly Assembly',
    image:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'unity-carmichael-park',
    title: 'Intergenerational Solidarity Gathering',
    location: 'Carmichael Park, Carmichael',
    category: 'Sacramento Unity',
    signQuote: 'United For The Next Generation',
    date: 'Grassroots Community Care',
    image:
      'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'legacy-good-trouble-drop',
    title: 'John Lewis Highway 50 Banner Drop',
    location: 'Highway 50 Pedestrian Overpass, Sacramento',
    category: 'Legacy Archives',
    signQuote: 'Good Trouble Lives On!',
    date: 'Historic Chapter Archive',
    image: '/images/legacy/legacy-good-trouble-banner.jpg',
  },
  {
    id: 'no-kings-tower-bridge',
    title: 'Tower Bridge Mass Mobilization',
    location: 'Tower Bridge & Sacramento River, Sacramento',
    category: 'No Kings Sacramento',
    signQuote: 'Presidents Are Not Kings',
    date: 'Sacramento River March',
    image:
      'https://images.unsplash.com/photo-1568992687947-868a62a9f521?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'norcal-brake-light',
    title: 'Oak Park Free Brake Light Clinic',
    location: 'Oak Park Community Center, Sacramento',
    category: 'NorCal Resist',
    signQuote: 'Fixing Lights To Protect Neighbors',
    date: 'Mutual Aid Defense',
    image:
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'witty-introverts',
    title: 'When Introverts Leave the House',
    location: 'Carmichael Park Community Stand-Out',
    category: 'Witty Signs',
    signQuote: "You Know It's Bad When Introverts Are Out Here",
    date: 'Sidewalk Stand-Out',
    image:
      'https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?auto=format&fit=crop&w=800&q=80',
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
            <span>Explore Full 35+ Photo Gallery</span>
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
                className="object-cover group-hover:scale-105 transition-transform duration-700 brightness-90 group-hover:brightness-100"
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
