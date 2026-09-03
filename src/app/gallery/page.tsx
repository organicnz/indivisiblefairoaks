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
  // 1. NO KINGS SACRAMENTO (State Capitol, Tower Bridge, DOCO, Courthouse)
  // ==========================================
  {
    id: 'no-kings-capitol-steps',
    url: '/images/gallery/sacramento-capitol-no-kings.jpg',
    caption: 'No Kings in America: Citizens on the California State Capitol West Steps',
    location: 'California State Capitol West Steps, Sacramento',
    category: 'No Kings Sacramento',
    date: 'Sacramento Day of Action',
    photographer: 'Grassroots Photojournalism Collective',
    signQuote: 'We Fought A War About This In 1776',
  },
  {
    id: 'no-kings-tower-bridge',
    url: '/images/gallery/sacramento-tower-bridge-march.jpg',
    caption: 'Tower Bridge Mass Mobilization: Citizens Marching Across the Sacramento River',
    location: 'Tower Bridge & Sacramento River, Sacramento',
    category: 'No Kings Sacramento',
    date: 'Sacramento River March',
    photographer: 'River City Citizen Press',
    signQuote: 'Presidents Are Not Kings',
  },
  {
    id: 'no-kings-doco-plaza',
    url: 'https://images.unsplash.com/photo-1741244486182-c199906548d5?auto=format&fit=crop&w=1200&q=80',
    caption: 'Downtown Commons Demonstration: Defending Constitutional Checks & Balances',
    location: 'Downtown Sacramento Commons (DOCO)',
    category: 'No Kings Sacramento',
    date: 'Downtown Stand-Out',
    photographer: 'Coalition Photojournalism',
    signQuote: 'Rule of Law, Not Rule of Men',
  },
  {
    id: 'no-kings-courthouse-standout',
    url: 'https://images.unsplash.com/photo-1775536863648-400ffd7d3cfa?auto=format&fit=crop&w=1200&q=80',
    caption: 'Robert T. Matsui Federal Courthouse Stand-Out: Equal Justice Under Law',
    location: '501 I Street Federal Courthouse, Sacramento',
    category: 'No Kings Sacramento',
    date: 'Citizen Accountability Action',
    photographer: 'Direct Action Media',
    signQuote: 'No Man Is Above The Law',
  },
  {
    id: 'no-kings-capitol-mall-crowd',
    url: 'https://images.unsplash.com/photo-1782401510264-0149d95e4e8c?auto=format&fit=crop&w=1200&q=80',
    caption: 'Capitol Mall People’s Assembly: Linking Arms for Democratic Institutions',
    location: 'Capitol Mall, Sacramento',
    category: 'No Kings Sacramento',
    date: 'Sacramento Coalition March',
    photographer: 'Civic Media Project',
    signQuote: 'Government Of The People, By The People',
  },

  // ==========================================
  // 2. NORCAL RESIST (Direct Solidarity & Community Defense)
  // ==========================================
  {
    id: 'norcal-resist-brake-light-clinic',
    url: '/images/gallery/norcal-resist-brake-light-clinic.jpg',
    caption:
      'NorCal Resist Free Brake Light Repair Clinic: Keeping Drivers Safe from Pretextual Stops',
    location: 'Oak Park Community Center, Sacramento',
    category: 'NorCal Resist',
    date: 'Monthly Mutual Aid Clinic',
    photographer: 'NorCal Resist Media Collective',
    signQuote: 'Fixing Tail Lights To Protect Our Neighbors',
  },
  {
    id: 'norcal-resist-court-support',
    url: 'https://images.unsplash.com/photo-1784631912491-32b002c3da8a?auto=format&fit=crop&w=1200&q=80',
    caption: 'Sacramento Immigration Court Accompaniment: Standing With Immigrant Neighbors',
    location: '501 I Street Federal Courthouse, Sacramento',
    category: 'NorCal Resist',
    date: 'Court Watch Solidarity',
    photographer: 'Community Defense Working Group',
    signQuote: 'No Human Being Is Illegal',
  },
  {
    id: 'norcal-resist-jail-support',
    url: 'https://images.unsplash.com/photo-1776294309452-f2f942f5d9db?auto=format&fit=crop&w=1200&q=80',
    caption: 'Sacramento County Jail Support & Community Bail Fund Mobilization',
    location: 'Sacramento County Jail Hub, Sacramento',
    category: 'NorCal Resist',
    date: 'Community Bail Defense',
    photographer: 'National Bail Fund Network',
    signQuote: 'Solidarity Not Charity: Free Them All',
  },
  {
    id: 'norcal-resist-mutual-aid',
    url: 'https://images.unsplash.com/photo-1775536864202-a5d486087bb7?auto=format&fit=crop&w=1200&q=80',
    caption: 'South Sacramento Mutual Aid Circle: Essentials Distribution & Community Care',
    location: 'South Sacramento Community Hub',
    category: 'NorCal Resist',
    date: 'Monthly Mutual Aid',
    photographer: 'Sacramento Mutual Aid Working Group',
    signQuote: 'Mutual Aid Across Every Neighborhood',
  },
  {
    id: 'norcal-resist-speaker',
    url: 'https://images.unsplash.com/photo-1776294285771-58216da8b3c2?auto=format&fit=crop&w=1200&q=80',
    caption: 'Community Defense Organizer Speaking on Due Process and Sanctuary Policies',
    location: 'Colonial Heights, Sacramento',
    category: 'NorCal Resist',
    date: 'Rapid Response Training',
    photographer: 'Grassroots Dispatch',
    signQuote: 'When Neighbors Are Under Threat, We Show Up',
  },

  // ==========================================
  // 3. SACRAMENTO UNITY & PEACEFUL RESISTANCE
  // ==========================================
  {
    id: 'unity-citrus-heights-sunrise',
    url: 'https://images.unsplash.com/photo-1784631912491-4cb9fa3b51d4?auto=format&fit=crop&w=1200&q=80',
    caption: 'Sunrise Solidarity Peaceful Demonstration in Citrus Heights',
    location: 'Sunrise Blvd & Greenback Lane, Citrus Heights',
    category: 'Sacramento Unity',
    date: 'Saturday Morning Gathering',
    photographer: 'Sunrise Solidarity Working Group',
    signQuote: 'Being In Community Is Our Superpower',
  },
  {
    id: 'unity-silent-vigil',
    url: 'https://images.unsplash.com/photo-1770251960846-384b8bd21d60?auto=format&fit=crop&w=1200&q=80',
    caption: 'Silent Vigil for Democracy: Neighbors in Dark Attire Holding Handwritten Cardboard',
    location: 'Fair Oaks Plaza Park, Fair Oaks Village',
    category: 'Sacramento Unity',
    date: 'Bi-Weekly Silent Vigil',
    photographer: 'Community Peace Circle',
    signQuote: 'When People See Others Speak Out, It Gives Courage',
  },
  {
    id: 'unity-folsom-demonstration',
    url: 'https://images.unsplash.com/photo-1760829165167-498d112d2293?auto=format&fit=crop&w=1200&q=80',
    caption: 'Folsom Community Defense Demonstration: Family-Friendly Sidewalk Gathering',
    location: 'Iron Point Rd & East Bidwell St, Folsom',
    category: 'Sacramento Unity',
    date: 'Weekly Sidewalk Action',
    photographer: 'Folsom Grassroots Alliance',
    signQuote: 'Protect Families, Protect Civil Rights',
  },
  {
    id: 'unity-carmichael-gathering',
    url: 'https://images.unsplash.com/photo-1761069234395-3c13a712bbbb?auto=format&fit=crop&w=1200&q=80',
    caption: 'Carmichael Park Intergenerational Gathering: Elders & Youth for Democracy',
    location: 'Carmichael Park, Carmichael',
    category: 'Sacramento Unity',
    date: 'Intergenerational Assembly',
    photographer: 'Youth & Elders Circle',
    signQuote: 'United For The Next Generation',
  },

  // ==========================================
  // 4. WITTY & FUNNY PROTEST SIGNS
  // ==========================================
  {
    id: 'witty-ikea-cabinets',
    url: '/images/gallery/witty-ikea-sign.jpg',
    caption: 'Satirical Cardboard on Fair Oaks Blvd: Community Humor In Action',
    location: 'Fair Oaks Blvd & Manzanita Ave, Carmichael',
    category: 'Witty & Funny Signs',
    date: 'Sidewalk Stand-Out',
    photographer: 'Elena R., Member',
    signQuote: "I've Seen Smarter Cabinets At IKEA",
  },
  {
    id: 'witty-introverts-rally',
    url: '/images/gallery/witty-introverts-sign.jpg',
    caption: 'When Introverts Leave the House: Grassroots Protest Humor',
    location: 'Downtown Sacramento Demonstration',
    category: 'Witty & Funny Signs',
    date: 'Sidewalk Stand-Out',
    photographer: 'David K., Member',
    signQuote: "You Know It's Bad When Introverts Are Out Here",
  },
  {
    id: 'witty-stayed-in-1775',
    url: 'https://images.unsplash.com/photo-1775536863648-400ffd7d3cfa?auto=format&fit=crop&w=1200&q=80',
    caption: 'Historical Truth on Cardboard: Demonstrator on the Capitol Steps',
    location: 'California State Capitol, Sacramento',
    category: 'Witty & Funny Signs',
    date: 'State Capitol Rally',
    photographer: 'Historical Resistance Team',
    signQuote: 'If You Liked Monarchy, You Should Have Stayed In 1775',
  },
  {
    id: 'witty-librarians-loud',
    url: 'https://images.unsplash.com/photo-1784631912491-32b002c3da8a?auto=format&fit=crop&w=1200&q=80',
    caption: 'Librarians Against Tyranny: Academic Freedom & Civil Liberties',
    location: 'Carmichael Library Assembly Area',
    category: 'Witty & Funny Signs',
    date: 'Grassroots Action',
    photographer: 'Literacy Working Group',
    signQuote: 'So Bad Even Librarians Are Getting Loud',
  },
  {
    id: 'witty-brought-snacks',
    url: 'https://images.unsplash.com/photo-1784631912491-4cb9fa3b51d4?auto=format&fit=crop&w=1200&q=80',
    caption: 'Prepared for the Long Haul: Fair Oaks Village Art & Sign Workshop',
    location: 'Fair Oaks Village Arts Center',
    category: 'Witty & Funny Signs',
    date: 'Sign-Making Assembly',
    photographer: 'Creative Arts Team',
    signQuote: 'History Has Its Eyes On Us (And We Brought Snacks)',
  },

  // ==========================================
  // 5. CARMICHAEL RESISTANCE CHOIR
  // ==========================================
  {
    id: 'choir-bandstand-concert',
    url: '/images/gallery/carmichael-resistance-choir.jpg',
    caption: 'Carmichael Resistance Choir: Community Harmony Assembly at the Park Bandstand',
    location: 'Carmichael Park Bandstand, Carmichael',
    category: 'Resistance Choir',
    date: 'Community Vocal Assembly',
    photographer: 'Marcus T., Press Liaison',
    signQuote: 'Music Sustains The Movement',
  },
  {
    id: 'choir-legacy-invitation',
    url: '/images/legacy/legacy-resistance-choir.jpg',
    caption: 'Carmichael Resistance Choir: Original Vocal Rehearsal Invitation & Charter',
    location: 'Carmichael Community Spaces',
    category: 'Resistance Choir',
    date: 'Historic Choir Dispatch',
    photographer: 'Carmichael Resistance Choir',
    signQuote: 'Every Good Protest Movement Needs Music',
  },
  {
    id: 'choir-street-harmonies',
    url: 'https://images.unsplash.com/photo-1776294285771-58216da8b3c2?auto=format&fit=crop&w=1200&q=80',
    caption: 'Rush Hour Sidewalk Harmonies: Lawn Chairs, Song Sheets & Civic Voices',
    location: 'Fair Oaks Blvd & Manzanita Ave, Carmichael',
    category: 'Resistance Choir',
    date: 'Rush Hour Singing Protest',
    photographer: 'Choir Working Group',
    signQuote: 'Bring Your Signs, Chairs, & Voices!',
  },

  // ==========================================
  // 6. LEGACY SITE ARCHIVES (Original Authentic Banners & Graphics)
  // ==========================================
  {
    id: 'legacy-banner',
    url: '/images/legacy/legacy-banner.jpg',
    caption: 'Indivisible Fair Oaks Official Chapter Welcome Banner',
    location: 'Fair Oaks & Carmichael, CA',
    category: 'Legacy Site Archives',
    date: 'Historic Archive',
    photographer: 'Indivisible Fair Oaks Founding Committee',
    signQuote: 'Indivisible Fair Oaks - Carmichael',
  },
  {
    id: 'legacy-good-trouble-banner',
    url: '/images/legacy/legacy-good-trouble-banner.jpg',
    caption: 'Good Trouble Lives On: Annual John Lewis Highway 50 Banner Drop Artwork',
    location: 'Highway 50 Pedestrian Overpass, Sacramento',
    category: 'Legacy Site Archives',
    date: 'July 17 Weekend of Action',
    photographer: 'Indivisible Action Team',
    signQuote: 'Good Trouble Lives On!',
  },
  {
    id: 'legacy-good-trouble-artwork',
    url: '/images/legacy/legacy-good-trouble-artwork.png',
    caption: 'John Lewis Commemorative Banner Print: Original High-Resolution Vector Artwork',
    location: 'Sacramento County',
    category: 'Legacy Site Archives',
    date: 'July Memorial Archive',
    photographer: 'Civic Arts Collective',
    signQuote: 'Get In Good Trouble, Necessary Trouble',
  },
  {
    id: 'legacy-good-trouble-1',
    url: '/images/legacy/legacy-good-trouble-1.jpg',
    caption: 'Good Trouble Weekend of Action & Protest Song Assembly Program',
    location: 'Fair Oaks & Carmichael Community Spaces',
    category: 'Legacy Site Archives',
    date: 'July Memorial Action',
    photographer: 'Chapter Organizing Committee',
    signQuote: 'Never, Ever Be Afraid To Make Noise',
  },
  {
    id: 'legacy-good-trouble-flyer',
    url: '/images/legacy/legacy-good-trouble-flyer.png',
    caption: 'Weekend of Action Community Organizing Flyer & Event Guide',
    location: 'Fair Oaks & Carmichael, CA',
    category: 'Legacy Site Archives',
    date: 'Weekend of Action',
    photographer: 'Chapter Dispatch Committee',
    signQuote: 'Speaking Truth to Power Together',
  },
  {
    id: 'legacy-homeless-vote',
    url: '/images/legacy/legacy-homeless-vote.jpg',
    caption: 'Homeless Is Not Voteless: Grassroots Sacramento Voter Rights Campaign Poster',
    location: 'Sacramento County Outreach',
    category: 'Legacy Site Archives',
    date: 'Civic Rights Campaign',
    photographer: 'Sacramento Voting Rights Advocates',
    signQuote: 'Homeless Is Not Voteless',
  },
  {
    id: 'legacy-preregister-16',
    url: '/images/legacy/legacy-preregister-16.jpg',
    caption: 'Pre-Register At 16: Sacramento County High School Civic Education Poster',
    location: 'Sacramento Area High Schools',
    category: 'Legacy Site Archives',
    date: 'Youth Civic Initiative',
    photographer: 'Youth Voting Project',
    signQuote: 'Pre-Register At 16: Your Future, Your Voice',
  },
  {
    id: 'legacy-voting-rights-reentry',
    url: '/images/legacy/legacy-voting-rights-reentry.jpg',
    caption: 'Restoration of Voting Rights: Sacramento Reentry Education Initiative Poster',
    location: 'Sacramento County',
    category: 'Legacy Site Archives',
    date: 'Justice Working Group',
    photographer: 'Community Legal Alliance',
    signQuote: 'Voting Rights Restoration For All',
  },
  {
    id: 'legacy-newsletter',
    url: '/images/legacy/legacy-newsletter.jpg',
    caption: 'Indivisible Fair Oaks-Carmichael Grassroots Dispatch & Newsletter Cover',
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
