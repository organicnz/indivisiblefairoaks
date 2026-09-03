import { ArrowRight, Camera, MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface PreviewPhoto {
  title: string;
  location: string;
  category: string;
  image: string;
}

const PREVIEW_PHOTOS: PreviewPhoto[] = [
  {
    title: 'Fair Oaks Blvd Stand-Out',
    location: 'Fair Oaks Blvd & Manzanita Ave, Carmichael',
    category: 'Rallies & Vigils',
    image:
      'https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Resistance Choir 4-Part Harmonies',
    location: 'St. Michael’s Parish Hall, Carmichael',
    category: 'Resistance Choir',
    image:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'California Capitol Steps Rally',
    location: 'State Capitol West Steps, Sacramento',
    category: 'Capitol Advocacy',
    image:
      'https://images.unsplash.com/photo-1568992687947-868a62a9f521?auto=format&fit=crop&w=800&q=80',
  },
];

export function HomeGalleryPreview() {
  return (
    <section className="py-16 md:py-24 bg-slate-950 text-white border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-3">
              <Camera size={14} className="text-amber-400" />
              <span>Photojournalism In Action</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Moments of Peaceful Resistance
            </h2>
            <p className="text-sm sm:text-base text-slate-300 mt-2 max-w-xl leading-relaxed">
              Snapshots of our neighbors gathering, singing, holding signs, and speaking truth to
              power across Sacramento County.
            </p>
          </div>

          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-wider group"
          >
            <span>Explore Full Photo Gallery</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PREVIEW_PHOTOS.map((photo) => (
            <Link
              key={photo.title}
              href="/gallery"
              className="group relative h-80 rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl hover:border-slate-700 transition-all block"
            >
              <Image
                src={photo.image}
                alt={photo.title}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700 brightness-90 group-hover:brightness-100"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />

              <div className="absolute top-4 left-4 z-10">
                <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-900/80 backdrop-blur-md border border-slate-700 text-amber-300">
                  {photo.category}
                </span>
              </div>

              <div className="absolute bottom-0 inset-x-0 p-6 z-10 space-y-2">
                <h3 className="font-bold text-white text-lg group-hover:text-blue-300 transition-colors">
                  {photo.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin size={13} className="text-amber-400 shrink-0" />
                  <span className="truncate">{photo.location}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
