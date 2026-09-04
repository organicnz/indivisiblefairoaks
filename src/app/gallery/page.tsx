'use client';

import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Maximize2,
  Search,
  Share2,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { getStorageUrl } from '@/lib/supabase';

interface CivicPhoto {
  id: string;
  url: string;
  caption: string;
  location: string;
  category:
    | 'No Kings Sacramento'
    | 'NorCal Resist'
    | 'Sacramento Unity'
    | 'Witty & Funny Signs'
    | 'Resistance Choir'
    | 'Legacy Site Archives';
  date: string;
  photographer: string;
  signQuote?: string;
}

const CIVIC_GALLERY: CivicPhoto[] = [
  // ==========================================
  // 1. NO KINGS SACRAMENTO
  // ==========================================
  {
    id: 'no-kings-constitution-banner',
    url: getStorageUrl('gallery/no-kings-constitution-banner.jpg'),
    caption: 'No Kings in America: Chapter Members with Handcrafted Constitutional Rights Banner',
    location: 'Fair Oaks Blvd & Sunrise Blvd, Fair Oaks',
    category: 'No Kings Sacramento',
    date: 'Chapter Stand-Out',
    photographer: 'Indivisible Fair Oaks Archive',
    signQuote: 'No Kings In America — The Constitution',
  },
  {
    id: 'no-kings-roadside-standout',
    url: getStorageUrl('gallery/no-kings-roadside-standout.jpg'),
    caption: 'Gold Country Boulevard Mobilization: Defending Constitutional Democracy',
    location: 'Gold Country Blvd & Fair Oaks Blvd, Fair Oaks',
    category: 'No Kings Sacramento',
    date: 'Grassroots Stand-Out',
    photographer: 'Indivisible Action Team',
    signQuote: 'No ICE, No War, No King',
  },
  {
    id: 'no-kings-sacramento-capitol',
    url: getStorageUrl('gallery/no-kings-sacramento-capitol.jpg'),
    caption: 'Standing For Constitutional Checks & Balances with Peace Sign',
    location: 'Sacramento County Stand-Out',
    category: 'No Kings Sacramento',
    date: 'Weekend of Action',
    photographer: 'Community Photojournalism',
    signQuote: 'United We Stand — No Kings',
  },
  {
    id: 'no-kings-defend-democracy',
    url: getStorageUrl('gallery/no-kings-defend-democracy.jpg'),
    caption: 'Defending Public Institutions & Civil Rights on the Boulevard',
    location: 'Sunrise Boulevard & Fair Oaks Blvd',
    category: 'No Kings Sacramento',
    date: 'Peaceful Mobilization',
    photographer: 'Grassroots Photo Collective',
    signQuote: 'Defend Democracy, Support Public Institutions',
  },
  {
    id: 'no-kings-carmichael-line',
    url: getStorageUrl('gallery/no-kings-carmichael-line.jpg'),
    caption: 'Carmichael Crossroads Stand-Out: Grassroots Accountability',
    location: 'Fair Oaks Blvd & Manzanita Ave, Carmichael',
    category: 'No Kings Sacramento',
    date: 'Community Stand-Out',
    photographer: 'Indivisible Fair Oaks-Carmichael',
    signQuote: 'Rule of Law, Not Rule of Men',
  },
  {
    id: 'no-kings-fair-oaks-standout',
    url: getStorageUrl('gallery/real-legacy-28.jpg'),
    caption: 'Fair Oaks Community Action: Standing Up For Equal Justice',
    location: 'Fair Oaks Village, CA',
    category: 'No Kings Sacramento',
    date: 'Civic Action Day',
    photographer: 'Chapter Member Photo',
    signQuote: 'No One Is Above The Law',
  },

  // ==========================================
  // 2. NORCAL RESIST & MUTUAL AID
  // ==========================================
  {
    id: 'mutual-aid-fair-oaks-park',
    url: getStorageUrl('gallery/mutual-aid-fair-oaks-park.jpg'),
    caption: 'Indivisible Fair Oaks Mutual Aid Committee: Fair Oaks Park Food & Essentials Drive',
    location: 'Fair Oaks Park Pavilion, Fair Oaks',
    category: 'NorCal Resist',
    date: 'Monthly Mutual Aid',
    photographer: 'Mutual Aid Working Group',
    signQuote: 'Mutual Aid Across Every Neighborhood',
  },
  {
    id: 'voter-registration-homeless-vote',
    url: getStorageUrl('gallery/voter-registration-homeless-vote.jpg'),
    caption: 'Grassroots Civic Defense: "Homeless Does Not Mean Voteless" Registration Action',
    location: 'Sacramento County Outreach Hub',
    category: 'NorCal Resist',
    date: 'Voter Defense Drive',
    photographer: 'Voting Rights Committee',
    signQuote: 'Homeless Does Not Mean Voteless',
  },
  {
    id: 'norcal-solidarity-gold-country',
    url: getStorageUrl('gallery/norcal-solidarity-gold-country.jpg'),
    caption: 'Community Solidarity Stand-Out: Defending Immigrant Neighbors and Due Process',
    location: 'Gold Country Blvd, Fair Oaks',
    category: 'NorCal Resist',
    date: 'Rapid Response Solidarity',
    photographer: 'Direct Action Media',
    signQuote: 'Standing In Solidarity With All Neighbors',
  },
  {
    id: 'norcal-organizing-inclusive-democracy',
    url: getStorageUrl('gallery/norcal-organizing-inclusive-democracy.jpg'),
    caption: 'Chapter Strategy Session: Building Inclusive Democracy & Community Defense',
    location: 'Fair Oaks Community Clubhouse',
    category: 'NorCal Resist',
    date: 'Monthly Strategy Assembly',
    photographer: 'Chapter Organizing Collective',
    signQuote: 'Build Inclusive Democracy, Defeat Authoritarianism',
  },
  {
    id: 'norcal-peace-action-sacramento',
    url: getStorageUrl('gallery/norcal-peace-action-sacramento.jpg'),
    caption: 'Sacramento County Peace Action: Grassroots Coalition Gathering for Civil Rights',
    location: 'Sacramento County Community Hub',
    category: 'NorCal Resist',
    date: 'Coalition Gathering',
    photographer: 'Community Peace Circle',
    signQuote: 'People-Powered Peace and Justice',
  },

  // ==========================================
  // 3. SACRAMENTO UNITY & PEACEFUL RESISTANCE
  // ==========================================
  {
    id: 'unity-be-brave-with-us',
    url: getStorageUrl('gallery/unity-be-brave-with-us.jpg'),
    caption: 'Be Brave With Us! Indivisible Fair Oaks Solidarity Line on the Boulevard',
    location: 'Fair Oaks Blvd & Sunrise Blvd, Fair Oaks',
    category: 'Sacramento Unity',
    date: 'Weekly Stand-Out',
    photographer: 'Indivisible Action Team',
    signQuote: 'Be Brave With Us! Indivisible Fair Oaks',
  },
  {
    id: 'unity-one-voice-vote-counts',
    url: getStorageUrl('gallery/unity-one-voice-vote-counts.jpg'),
    caption: 'One Voice: Demonstrators with American Flag Umbrella on the Sidewalk',
    location: 'Fair Oaks Village Center',
    category: 'Sacramento Unity',
    date: 'Community Stand-Out',
    photographer: 'Chapter Photo Archive',
    signQuote: 'One Voice — Your Vote Counts In California',
  },
  {
    id: 'unity-give-a-damn',
    url: getStorageUrl('gallery/unity-give-a-damn.jpg'),
    caption: 'Civic Engagement Stand-Out: "Give A Damn" Sign with Flags',
    location: 'Fair Oaks Blvd Sidewalk Action',
    category: 'Sacramento Unity',
    date: 'Weekend Stand-Out',
    photographer: 'Member Dispatch',
    signQuote: 'Give A Damn — Defend Our Neighbors',
  },
  {
    id: 'unity-ban-hate-not-books',
    url: getStorageUrl('gallery/unity-ban-hate-not-books.jpg'),
    caption: 'Defending Public Libraries: "Ban Hate, Not Books" Community Gathering',
    location: 'Fair Oaks & Carmichael Libraries',
    category: 'Sacramento Unity',
    date: 'Library Defense Action',
    photographer: 'Literacy Working Group',
    signQuote: 'Ban Hate, Not Books — Protect Public Libraries',
  },
  {
    id: 'unity-fair-oaks-boulevard-line',
    url: getStorageUrl('gallery/unity-fair-oaks-boulevard-line.jpg'),
    caption: 'Fair Oaks Boulevard Community Stand-Out & Honk-and-Waves',
    location: 'Fair Oaks Blvd & Madison Ave',
    category: 'Sacramento Unity',
    date: 'Honk & Wave Stand-Out',
    photographer: 'Grassroots Photojournalism',
    signQuote: 'Honk For Democracy!',
  },
  {
    id: 'unity-citrus-heights-sunrise',
    url: getStorageUrl('gallery/unity-citrus-heights-sunrise.jpg'),
    caption: 'Sunrise Boulevard Weekly Stand-Out in Citrus Heights',
    location: 'Sunrise Blvd & Greenback Lane, Citrus Heights',
    category: 'Sacramento Unity',
    date: 'Saturday Morning Gathering',
    photographer: 'Sunrise Solidarity Working Group',
    signQuote: 'Being In Community Is Our Superpower',
  },

  // ==========================================
  // 4. WITTY & FUNNY PROTEST SIGNS
  // ==========================================
  {
    id: 'witty-grandfather-ww2-antifa',
    url: getStorageUrl('gallery/witty-grandfather-ww2-antifa.jpg'),
    caption: 'Cardboard Truth: "If Your Grandfather Fought In WW2 He Was Anti-Fascist!"',
    location: 'Fair Oaks Blvd Stand-Out',
    category: 'Witty & Funny Signs',
    date: 'Sidewalk Stand-Out',
    photographer: 'Member Photojournalism',
    signQuote: 'If Your Grandfather Fought In WW2 He Was Anti-Fascist!',
  },
  {
    id: 'witty-cat-nope-since-1776',
    url: getStorageUrl('gallery/witty-cat-nope-since-1776.jpg'),
    caption: 'Satirical Grassroots Sign: "Democracy Needs Courage & NOPE Since 1776"',
    location: 'Carmichael Community Sidewalk',
    category: 'Witty & Funny Signs',
    date: 'Weekend Action',
    photographer: 'Chapter Creative Team',
    signQuote: 'Democracy Needs Your Courage (NOPE Since 1776)',
  },
  {
    id: 'witty-grandma-standing-up',
    url: getStorageUrl('gallery/witty-grandma-standing-up.jpg'),
    caption: 'Senior Power in Fair Oaks: "This Grandma Is Standing Up For Democracy!"',
    location: 'Fair Oaks Boulevard',
    category: 'Witty & Funny Signs',
    date: 'Community Stand-Out',
    photographer: 'Grassroots Dispatch',
    signQuote: 'This Grandma Is Standing Up For Democracy!',
  },
  {
    id: 'witty-so-much-fubar',
    url: getStorageUrl('gallery/witty-so-much-fubar.jpg'),
    caption: 'Humor In Action: "So Much Is FUBAR It Doesn\'t Fit On One Sign"',
    location: 'Gold Country Blvd Stand-Out',
    category: 'Witty & Funny Signs',
    date: 'Sidewalk Stand-Out',
    photographer: 'Elena R., Member',
    signQuote: "So Much Is FUBAR It Doesn't Fit On One Sign",
  },
  {
    id: 'witty-ban-liars-not-books',
    url: getStorageUrl('gallery/witty-ban-liars-not-books.jpg'),
    caption: 'Roadside Cardboard Wit: "Ban Liars & Crooks Not History Books"',
    location: 'Fair Oaks Blvd & Sunrise Blvd',
    category: 'Witty & Funny Signs',
    date: 'Sidewalk Stand-Out',
    photographer: 'David K., Member',
    signQuote: 'Ban Liars & Crooks Not History Books',
  },

  // ==========================================
  // 5. CARMICHAEL RESISTANCE CHOIR
  // ==========================================
  {
    id: 'choir-outdoor-rehearsal',
    url: getStorageUrl('gallery/choir-outdoor-rehearsal.jpg'),
    caption: 'Carmichael Resistance Choir: Singing For Democracy Under The Trees',
    location: 'Carmichael Community Park',
    category: 'Resistance Choir',
    date: 'Vocal Rehearsal Assembly',
    photographer: 'Choir Organizing Team',
    signQuote: 'Singing For Democracy Under The Trees',
  },
  {
    id: 'choir-voices-for-justice',
    url: getStorageUrl('gallery/choir-voices-for-justice.jpg'),
    caption: 'Harmonies of Resistance: Community Chorus Preparing Protest Hymns',
    location: 'Carmichael Community Spaces',
    category: 'Resistance Choir',
    date: 'Choral Workshop',
    photographer: 'Marcus T., Press Liaison',
    signQuote: 'Every Good Protest Movement Needs Music',
  },
  {
    id: 'choir-songbook-cover',
    url: getStorageUrl('gallery/choir-songbook-cover.jpg'),
    caption: 'Carmichael Resistance Choir: Original Songbook Charter & Civic Vocal Repertoire',
    location: 'Carmichael, CA',
    category: 'Resistance Choir',
    date: 'Historic Choir Dispatch',
    photographer: 'Resistance Choir Working Group',
    signQuote: 'Music Sustains The Movement',
  },

  // ==========================================
  // 6. LEGACY SITE ARCHIVES (Original Authentic Banners & Graphics)
  // ==========================================
  {
    id: 'highway-overpass-good-trouble',
    url: getStorageUrl('gallery/highway-overpass-good-trouble.jpg'),
    caption: 'Highway 50 Overpass Banner Drop: Good Trouble Lives On Honoring John Lewis',
    location: 'Highway 50 Pedestrian Overpass, Sacramento',
    category: 'Legacy Site Archives',
    date: 'Weekend of Action',
    photographer: 'Chapter Action Team',
    signQuote: 'Good Trouble Lives On! Honoring John Lewis',
  },
  {
    id: 'highway-overpass-foam-hands',
    url: getStorageUrl('gallery/highway-overpass-foam-hands.jpg'),
    caption: 'Highway 50 Pedestrian Bridge: Giant Foam Hands Waving to Commuters',
    location: 'Highway 50 Pedestrian Overpass',
    category: 'Legacy Site Archives',
    date: 'Highway Banner Mobilization',
    photographer: 'Direct Action Volunteers',
    signQuote: 'Waving For Democracy & Equal Justice',
  },
  {
    id: 'legacy-good-trouble-full-banner',
    url: getStorageUrl('gallery/legacy-good-trouble-full-banner.jpg'),
    caption: 'Hand-Painted Memorial Banner: "Good Trouble Lives On!"',
    location: 'Sacramento County',
    category: 'Legacy Site Archives',
    date: 'July Memorial Archive',
    photographer: 'Civic Arts Collective',
    signQuote: 'Never, Ever Be Afraid To Make Noise',
  },
  {
    id: 'legacy-chapter-official-banner',
    url: getStorageUrl('gallery/legacy-chapter-official-banner.jpg'),
    caption: 'Official Indivisible Fair Oaks Chapter Welcome Banner',
    location: 'Fair Oaks & Carmichael, CA',
    category: 'Legacy Site Archives',
    date: 'Historic Founding Archive',
    photographer: 'Founding Committee',
    signQuote: 'Indivisible Fair Oaks - Carmichael',
  },
  {
    id: 'legacy-preregister-at-16',
    url: getStorageUrl('gallery/legacy-preregister-at-16.jpg'),
    caption: 'Youth Civic Education: California High School Pre-Registration at 16',
    location: 'Sacramento Area High Schools',
    category: 'Legacy Site Archives',
    date: 'Youth Civic Initiative',
    photographer: 'Youth Voting Project',
    signQuote: 'Pre-Register At 16: Your Future, Your Voice',
  },
  {
    id: 'legacy-voting-rights-restoration',
    url: getStorageUrl('gallery/legacy-voting-rights-restoration.jpg'),
    caption: 'Voting Rights Restoration: Reentry Educational Campaign Poster',
    location: 'Sacramento County',
    category: 'Legacy Site Archives',
    date: 'Justice Working Group',
    photographer: 'Community Legal Alliance',
    signQuote: 'Voting Rights Restoration For All',
  },
  {
    id: 'legacy-newsletter',
    url: getStorageUrl('gallery/legacy-newsletter.jpg'),
    caption: 'Indivisible Fair Oaks-Carmichael Grassroots Dispatch & Newsletter',
    location: 'Fair Oaks-Carmichael, CA',
    category: 'Legacy Site Archives',
    date: 'Historic Dispatch',
    photographer: 'Editorial Working Group',
    signQuote: 'Informed, Connected, Indivisible',
  },
];

export default function GalleryPage() {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  const categories = [
    'All',
    'No Kings Sacramento',
    'NorCal Resist',
    'Sacramento Unity',
    'Witty & Funny Signs',
    'Resistance Choir',
    'Legacy Site Archives',
  ];

  // Category item counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: CIVIC_GALLERY.length };
    for (const photo of CIVIC_GALLERY) {
      counts[photo.category] = (counts[photo.category] || 0) + 1;
    }
    return counts;
  }, []);

  // Filter and search
  const filteredPhotos = useMemo(() => {
    return CIVIC_GALLERY.filter((photo) => {
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
  }, [selectedCategory, searchQuery]);

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
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            <Camera size={14} className="text-amber-400" />
            <span>Photojournalism In Action • Moments of Peaceful Resistance</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08]">
            Democracy In Full View
          </h1>

          <div className="h-1.5 w-24 bg-amber-400 rounded-full" />

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl">
            Snapshots of our neighbors gathering, singing, holding signs, and speaking truth to
            power across Sacramento County. Curated from our legacy site archives, Sacramento No
            Kings mobilizations, NorCal Resist community defense, Carmichael Resistance Choir, and
            witty grassroots cardboard art. Strictly 100% grassroots — zero politicians, zero
            corporate branding.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-4xl pt-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-2xl font-black text-amber-400 block font-mono">No Kings</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Sacramento Actions
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-2xl font-black text-emerald-400 block font-mono">
                NorCal Resist
              </span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Direct Solidarity
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-2xl font-black text-blue-400 block font-mono">Witty Signs</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Grassroots Humor
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-2xl font-black text-purple-400 block font-mono">
                0 Politicians
              </span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                100% People Power
              </span>
            </div>
          </div>

          {/* Real-time Search & Filter Controls */}
          <div className="w-full max-w-2xl pt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by quote, slogan, location (e.g. 'IKEA', 'Tower Bridge', 'Brake Light')..."
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
                const count = categoryCounts[category] || 0;
                const isSelected = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105'
                        : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <span>{category}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
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
                  alt={photo.caption}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-700 brightness-95 group-hover:brightness-100"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />

                {/* Top Tag & Witty Sign Badge */}
                <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5 max-w-[80%]">
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-900/85 backdrop-blur-md border border-slate-700 text-amber-300">
                    {photo.category}
                  </span>
                  {photo.signQuote && (
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-400 text-slate-950 shadow-md truncate max-w-full">
                      “{photo.signQuote}”
                    </span>
                  )}
                </div>

                <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white border border-slate-700 shadow-md">
                    <Maximize2 size={14} />
                  </div>
                </div>

                {/* Bottom Caption */}
                <div className="absolute bottom-0 inset-x-0 p-5 z-10 space-y-1.5">
                  <h3 className="font-bold text-white text-base sm:text-lg leading-snug group-hover:text-blue-300 transition-colors line-clamp-2">
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
        )}

        {/* Submit Photo CTA */}
        <div className="mt-16 p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-slate-800 text-center space-y-4 max-w-3xl mx-auto">
          <h3 className="text-2xl font-black text-white">
            Have Sacramento Resistance Pics, Unity Shots, or Funny Signs?
          </h3>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Did you snap a brilliant, witty cardboard sign, an uplifting choir moment, or neighbors
            standing in solidarity? Strictly grassroots (zero politicians, zero corporate imagery) —
            send your photos to our media circle to be included!
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
            className="absolute top-6 right-6 z-50 p-3 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close image modal"
          >
            <X size={20} />
          </button>

          {/* Prev Button */}
          <button
            type="button"
            onClick={() => handlePrev()}
            className="absolute left-4 sm:left-6 z-50 p-3 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Previous image"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Next Button */}
          <button
            type="button"
            onClick={() => handleNext()}
            className="absolute right-4 sm:right-6 z-50 p-3 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
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
    </div>
  );
}
