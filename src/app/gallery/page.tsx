import { Camera } from 'lucide-react';
import type { Metadata } from 'next';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { getGalleryPhotos } from '@/lib/queries/civic';
import { getStorageUrl } from '@/lib/supabase';
import { GalleryClient, type GalleryClientPhoto } from './GalleryClient';

export const metadata: Metadata = {
  alternates: { canonical: '/gallery' },
  title: 'Community Gallery | Indivisible Fair Oaks-Carmichael',
  description:
    'Snapshots of Fair Oaks and Carmichael neighbors gathering, singing, holding signs, and speaking truth to power across Sacramento County. 100% grassroots — zero politicians, zero corporate branding.',
  openGraph: {
    title: 'Community Gallery | Indivisible Fair Oaks-Carmichael',
    description:
      'Photojournalism from No Kings Sacramento mobilizations, NorCal Resist community defense, the Carmichael Resistance Choir, and witty grassroots cardboard art.',
    url: 'https://indivisiblefairoaks.org/gallery',
    siteName: 'Indivisible Fair Oaks-Carmichael',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Community Gallery | Indivisible Fair Oaks-Carmichael',
    description: 'Moments of peaceful resistance across Sacramento County.',
  },
};

export default async function GalleryPage() {
  const rows = await getGalleryPhotos();

  // Map DB rows → client-safe shape (resolve storage_path → full URL)
  const photos: GalleryClientPhoto[] = rows.map((row) => ({
    id: String(row.id),
    url: getStorageUrl(row.storage_path),
    alt: row.alt || row.caption,
    caption: row.caption,
    location: row.location,
    category: row.category,
    signQuote: row.sign_quote,
    date: row.date_label,
    photographer: row.photographer,
  }));

  return (
    <div className="bg-slate-950 text-white min-h-screen pt-24 pb-20">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-16 px-4 sm:px-6 lg:px-8">
        <VgpuCivicConstellation />
        <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center text-center space-y-4 pointer-events-auto">
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
            {[
              { value: 'No Kings', label: 'Sacramento Actions', color: 'text-amber-400' },
              { value: 'NorCal Resist', label: 'Direct Solidarity', color: 'text-emerald-400' },
              { value: 'Witty Signs', label: 'Grassroots Humor', color: 'text-blue-400' },
              { value: '0 Politicians', label: '100% People Power', color: 'text-purple-400' },
            ].map(({ value, label, color }) => (
              <div
                key={label}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center"
              >
                <span className={`text-2xl font-black block font-mono ${color}`}>{value}</span>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Interactive client leaf: search, filter chips, grid, lightbox */}
          <GalleryClient photos={photos} />
        </div>
      </div>
    </div>
  );
}
