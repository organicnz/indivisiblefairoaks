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
  // --- LEGACY SITE ARCHIVES (Original assets recovered from indivisiblefairoaks.org Google Drive) ---
  {
    id: 'legacy-banner',
    url: '/images/legacy/legacy-banner.jpg',
    caption: 'Indivisible Fair Oaks Official Chapter Welcome Banner',
    location: 'Fair Oaks & Carmichael, CA',
    category: 'Legacy Site Archives',
    date: '2026 Archive',
    photographer: 'Indivisible Fair Oaks Founding Committee',
    signQuote: 'Indivisible Fair Oaks - Carmichael',
  },
  {
    id: 'legacy-resistance-choir',
    url: '/images/legacy/legacy-resistance-choir.jpg',
    caption: 'Carmichael Resistance Choir: Community Vocal Rehearsal Invitation',
    location: 'Carmichael, CA',
    category: 'Legacy Site Archives',
    date: 'Bi-Weekly Rehearsals',
    photographer: 'Carmichael Resistance Choir',
    signQuote: 'Every Good Protest Movement Needs Music',
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
    id: 'legacy-good-trouble-1',
    url: '/images/legacy/legacy-good-trouble-1.jpg',
    caption: 'Good Trouble Weekend of Action & Protest Song Assembly',
    location: 'Fair Oaks & Carmichael Community Spaces',
    category: 'Legacy Site Archives',
    date: 'July 2026 Memorial Action',
    photographer: 'Chapter Organizing Committee',
    signQuote: 'Never, Ever Be Afraid To Make Noise',
  },
  {
    id: 'legacy-homeless-vote',
    url: '/images/legacy/legacy-homeless-vote.jpg',
    caption: 'Homeless Is Not Voteless: Grassroots Sacramento Voter Rights Initiative',
    location: 'Sacramento County Outreach',
    category: 'Legacy Site Archives',
    date: 'Civic Rights Campaign',
    photographer: 'Sacramento Voting Rights Advocates',
    signQuote: 'Homeless Is Not Voteless',
  },
  {
    id: 'legacy-preregister-16',
    url: '/images/legacy/legacy-preregister-16.jpg',
    caption: 'Pre-Register At 16: Sacramento County High School Civic Education Campaign',
    location: 'Sacramento Area High Schools',
    category: 'Legacy Site Archives',
    date: 'Youth Civic Initiative',
    photographer: 'Youth Voting Project',
    signQuote: 'Pre-Register At 16: Your Future, Your Voice',
  },
  {
    id: 'legacy-voting-rights-reentry',
    url: '/images/legacy/legacy-voting-rights-reentry.jpg',
    caption: 'Restoration of Voting Rights: Sacramento Reentry Education Initiative',
    location: 'Sacramento County',
    category: 'Legacy Site Archives',
    date: 'Justice Working Group',
    photographer: 'Community Legal Alliance',
    signQuote: 'Voting Rights Restoration For All',
  },
  {
    id: 'legacy-newsletter',
    url: '/images/legacy/legacy-newsletter.jpg',
    caption: 'Indivisible Fair Oaks-Carmichael Grassroots Dispatch & Newsletter',
    location: 'Fair Oaks-Carmichael, CA',
    category: 'Legacy Site Archives',
    date: 'April 2026 Edition',
    photographer: 'Editorial Working Group',
    signQuote: 'Informed, Connected, Indivisible',
  },

  // --- NORCAL RESIST (Sacramento Grassroots Direct Solidarity & Mutual Aid) ---
  {
    id: 'norcal-resist-court-watch',
    url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=1200&q=80',
    caption: 'Sacramento Immigration Court Accompaniment: NorCal Resist Court Watch Volunteers',
    location: '501 I Street Federal Courthouse, Sacramento',
    category: 'NorCal Resist',
    date: '2026 Direct Solidarity',
    photographer: 'NorCal Resist Media Collective',
    signQuote: 'No Human Being Is Illegal',
  },
  {
    id: 'norcal-resist-brake-light-clinic',
    url: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1200&q=80',
    caption:
      'NorCal Resist Free Brake Light Repair Clinic: Keeping Drivers Safe from Pretextual Stops',
    location: 'Oak Park Community Center, Sacramento',
    category: 'NorCal Resist',
    date: 'Monthly Mutual Aid Clinic',
    photographer: 'Community Defense Working Group',
    signQuote: 'Fixing Tail Lights To Protect Our Neighbors',
  },
  {
    id: 'norcal-resist-bail-fund',
    url: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=80',
    caption:
      'NorCal Resist Community Bail & Bond Fund: Cycling Community Cash Bail for Detained Neighbors',
    location: 'Sacramento County Jail Support Hub',
    category: 'NorCal Resist',
    date: 'Grassroots Bond Support',
    photographer: 'National Bail Fund Network',
    signQuote: 'Solidarity Not Charity: Free Them All',
  },
  {
    id: 'norcal-resist-diaper-food',
    url: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=1200&q=80',
    caption: 'Monthly Mutual Aid Essentials Distribution: Diapers, Formula & Groceries',
    location: 'South Sacramento Community Hub',
    category: 'NorCal Resist',
    date: 'Monthly Aid Circle',
    photographer: 'Sacramento Mutual Aid Circle',
    signQuote: 'Mutual Aid Across Every Neighborhood',
  },
  {
    id: 'norcal-resist-legal-observers',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    caption:
      'Neon Green Hats at the Capitol: NorCal Resist Trained Legal Observers Protecting Free Speech',
    location: 'California State Capitol, Sacramento',
    category: 'NorCal Resist',
    date: '2026 Mobilization',
    photographer: 'Guild Legal Observers',
    signQuote: 'Independent Eyes Safeguarding First Amendment Rights',
  },

  // --- NO KINGS SACRAMENTO (State Capitol, Tower Bridge, DOCO Plaza, Federal Courthouse) ---
  {
    id: 'no-kings-capitol-steps',
    url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
    caption: 'No Kings in America: Mass Demonstration on California State Capitol West Steps',
    location: 'California State Capitol West Steps, Sacramento',
    category: 'No Kings Sacramento',
    date: 'October 2026 Day of Action',
    photographer: 'Grassroots Coalition Press',
    signQuote: 'We Fought A War About This In 1776',
  },
  {
    id: 'no-kings-tower-bridge',
    url: 'https://images.unsplash.com/photo-1568992687947-868a62a9f521?auto=format&fit=crop&w=1200&q=80',
    caption: 'Tower Bridge Mass March: Golden Bridge Packed with Anti-Monarchy Protesters',
    location: 'Tower Bridge & Sacramento River',
    category: 'No Kings Sacramento',
    date: 'June 2026 Mobilization',
    photographer: 'Sacramento River Citizen Press',
    signQuote: 'Presidents Are Not Kings — Defend The Constitution',
  },
  {
    id: 'no-kings-doco-plaza',
    url: 'https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?auto=format&fit=crop&w=1200&q=80',
    caption: 'Downtown Commons Stand-Out: Grassroots Rally for Rule of Law & Civil Liberties',
    location: 'Downtown Sacramento Commons (DOCO)',
    category: 'No Kings Sacramento',
    date: 'August 2026',
    photographer: 'Indivisible Action Media',
    signQuote: 'Rule of Law, Not Rule of Men',
  },
  {
    id: 'no-kings-federal-courthouse',
    url: 'https://images.unsplash.com/photo-1576267423445-b2e0074d68a4?auto=format&fit=crop&w=1200&q=80',
    caption: 'Federal Courthouse Stand-Out: Holding Signs Demanding Executive Accountability',
    location: 'Robert T. Matsui Federal Courthouse, Sacramento',
    category: 'No Kings Sacramento',
    date: 'July 2026',
    photographer: 'Direct Action Working Group',
    signQuote: 'No Man Is Above The Law',
  },
  {
    id: 'no-kings-capitol-mall-march',
    url: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
    caption: 'Capitol Mall March: Community Members Linking Arms from River to Capitol',
    location: 'Capitol Mall, Sacramento',
    category: 'No Kings Sacramento',
    date: 'April 2026',
    photographer: 'Coalition Dispatch',
    signQuote: 'Government Of The People, By The People',
  },

  // --- SACRAMENTO UNITY (Intergenerational Solidarity, Community Care & Assemblies) ---
  {
    id: 'unity-food-bank-drive',
    url: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=80',
    caption: 'Fair Oaks Food Bank Collection: Non-Perishable Food Cans at Chapter Meeting',
    location: 'Fair Oaks Community Clubhouse',
    category: 'Sacramento Unity',
    date: 'September 2026 Gathering',
    photographer: 'Community Care Working Group',
    signQuote: 'Neighbors Caring For Neighbors',
  },
  {
    id: 'unity-carmichael-park',
    url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1200&q=80',
    caption:
      'Carmichael Park Intergenerational Gathering: Elders & Youth Building Grassroots Power',
    location: 'Carmichael Park, Carmichael',
    category: 'Sacramento Unity',
    date: 'June 2026',
    photographer: 'Youth & Elders Circle',
    signQuote: 'United For The Next Generation',
  },
  {
    id: 'unity-peace-vigil',
    url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
    caption: 'Peaceful Candlelight Vigil for Constitutional Norms & Democratic Unity',
    location: 'Fair Oaks Plaza Park',
    category: 'Sacramento Unity',
    date: 'January 2026',
    photographer: 'Community Peace Circle',
    signQuote: 'Lighting The Path For Democracy',
  },
  {
    id: 'unity-postcard-writing',
    url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80',
    caption: 'Writing 1,200 Handwritten Postcards to Protect Voting Access in California',
    location: 'Fair Oaks Village Backyard Circle',
    category: 'Sacramento Unity',
    date: 'September 2026',
    photographer: 'Voter Outreach Working Group',
    signQuote: 'Every Voice, Every Vote',
  },
  {
    id: 'unity-ancil-hoffman',
    url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
    caption: 'Grassroots Volunteer Debrief & Picnic: Solidarity Along the American River Parkway',
    location: 'Ancil Hoffman Park, Carmichael',
    category: 'Sacramento Unity',
    date: 'August 2026',
    photographer: 'Sacramento Field Coordinator',
    signQuote: 'Our Community, Our Strength',
  },
  {
    id: 'unity-indigenous-solidarity',
    url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=80',
    caption: 'Sutter’s Landing Solidarity Circle: Honoring Nisenan Ancestral Lands & River Commons',
    location: 'Sutter’s Landing Park, Sacramento River',
    category: 'Sacramento Unity',
    date: 'October 2026',
    photographer: 'Sacramento River Alliance',
    signQuote: 'Water Is Life, Justice For All',
  },

  // --- WITTY & FUNNY SIGNS (Sacramento & Nationwide Satirical Protest Art) ---
  {
    id: 'witty-ikea-cabinets',
    url: 'https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?auto=format&fit=crop&w=1200&q=80',
    caption: 'Satirical Cardboard at Fair Oaks Blvd Stand-Out',
    location: 'Fair Oaks Blvd & Manzanita Ave, Carmichael',
    category: 'Witty & Funny Signs',
    date: 'August 2026',
    photographer: 'Elena R., Member',
    signQuote: "I've Seen Smarter Cabinets At IKEA",
  },
  {
    id: 'witty-introverts-rally',
    url: 'https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?auto=format&fit=crop&w=1200&q=80',
    caption: 'When Introverts Leave the House: Carmichael Park Stand-Out',
    location: 'Carmichael Park Community Stand-Out',
    category: 'Witty & Funny Signs',
    date: 'September 2026',
    photographer: 'David K., Member',
    signQuote: "You Know It's Bad When Introverts Are Out Here",
  },
  {
    id: 'witty-librarians-loud',
    url: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=1200&q=80',
    caption: 'Librarians Against Tyranny: Carmichael Library Gathering',
    location: 'Carmichael Library Assembly Area',
    category: 'Witty & Funny Signs',
    date: 'May 2026',
    photographer: 'Literacy Working Group',
    signQuote: 'So Bad Even Librarians Are Getting Loud',
  },
  {
    id: 'witty-cat-checks-balances',
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=80',
    caption: 'Pet Companions for the Constitution: Carmichael Sidewalk Gathering',
    location: 'Carmichael Farmers Market Stand-Out',
    category: 'Witty & Funny Signs',
    date: 'July 2026',
    photographer: 'Elena R., Member',
    signQuote: 'Even My Cat Knows We Need Checks & Balances',
  },
  {
    id: 'witty-stayed-in-1775',
    url: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?auto=format&fit=crop&w=1200&q=80',
    caption: 'Historical Truth on Cardboard: Downtown Sacramento Rally',
    location: 'Downtown Sacramento Plaza',
    category: 'Witty & Funny Signs',
    date: 'June 2026',
    photographer: 'Historical Resistance Team',
    signQuote: 'If You Liked Monarchy, You Should Have Stayed In 1775',
  },
  {
    id: 'witty-arms-tired-since-2017',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
    caption: 'Endurance on the Capitol Steps: Marathon Grassroots Activism',
    location: 'California State Capitol, Sacramento',
    category: 'Witty & Funny Signs',
    date: 'October 2026',
    photographer: 'Statewide Coalition Press',
    signQuote: 'My Arms Are Tired From Holding This Sign Since 2017',
  },
  {
    id: 'witty-agree-wrong',
    url: 'https://images.unsplash.com/photo-1516251193007-45ef944ab0c6?auto=format&fit=crop&w=1200&q=80',
    caption: 'Diplomacy in the Streets: Sacramento Commons Satire',
    location: 'Capitol Mall Walkway, Sacramento',
    category: 'Witty & Funny Signs',
    date: 'August 2026',
    photographer: 'Grassroots Satirists',
    signQuote: "I'd Agree With You But Then We'd Both Be Wrong",
  },
  {
    id: 'witty-evidence-science',
    url: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=1200&q=80',
    caption: 'Science & Fact-Based Policy: Sacramento March for Science Alliance',
    location: 'Sacramento State Capitol Park',
    category: 'Witty & Funny Signs',
    date: 'April 2026',
    photographer: 'Scientists For Civic Sanity',
    signQuote: 'What Do We Want? Peer Review! When Do We Want It? After Revisions!',
  },
  {
    id: 'witty-brought-snacks',
    url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
    caption: 'Prepared for the Long Haul: Fair Oaks Village Art & Sign Workshop',
    location: 'Fair Oaks Village Arts Center',
    category: 'Witty & Funny Signs',
    date: 'September 2026',
    photographer: 'Creative Arts Team',
    signQuote: 'History Has Its Eyes On Us (And We Brought Snacks)',
  },

  // --- RESISTANCE CHOIR (Carmichael Resistance Choir & Street Harmonies) ---
  {
    id: 'choir-st-michaels',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    caption: 'Carmichael Resistance Choir singing "Singing for Our Lives"',
    location: 'St. Michael’s Parish Hall, Carmichael',
    category: 'Resistance Choir',
    date: 'July 2026',
    photographer: 'Marcus T., Press Liaison',
    signQuote: 'Defiant 4-Part Harmonies for Democracy',
  },
  {
    id: 'choir-rushhour-singing',
    url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
    caption: 'Rush Hour Singing Protest: Lawn Chairs, Song Sheets & Sidewalk Harmonies',
    location: 'Fair Oaks Blvd & Manzanita Ave, Carmichael',
    category: 'Resistance Choir',
    date: 'August 2026',
    photographer: 'Choir Working Group',
    signQuote: 'Bring Your Signs, Chairs, & Voices!',
  },
  {
    id: 'choir-rehearsal-circle',
    url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
    caption: 'Carmichael Resistance Choir Bi-Weekly Rehearsal Gathering',
    location: 'Carmichael Parish Rehearsal Room',
    category: 'Resistance Choir',
    date: 'June 2026',
    photographer: 'Choir Media Team',
    signQuote: 'Weaving Voices Together in Song',
  },
  {
    id: 'choir-park-amphitheater',
    url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
    caption: 'Community Songfest at Carmichael Park: Songs of Hope, Courage & Solidarity',
    location: 'Carmichael Park Community Bandstand',
    category: 'Resistance Choir',
    date: 'September 2026',
    photographer: 'Community Music Liaison',
    signQuote: 'Music Lifts Us Up In Troubled Times',
  },
];

export default function GalleryPage() {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            <Camera size={14} className="text-amber-400" />
            <span>Grassroots Visual Archives & Solidarity</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08]">
            Democracy In Full View
          </h1>

          <div className="h-1.5 w-24 bg-amber-400 rounded-full" />

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl">
            Curated from our legacy site archives, Sacramento No Kings demonstrations, NorCal Resist
            community defense, Carmichael Resistance Choir, and witty grassroots cardboard signs.
            Strictly 100% grassroots — zero politicians, zero corporate branding.
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

          {/* Category Filter Chips */}
          <div className="flex items-center justify-center gap-2 flex-wrap pt-6">
            <Filter size={15} className="text-slate-400 mr-1 hidden sm:inline-block" />
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
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
              className="group relative h-84 rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-900 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-700 transition-all shadow-xl"
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
