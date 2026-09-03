import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getStorageUrl } from '@/lib/supabase';

export const metadata: Metadata = {
  alternates: { canonical: '/partners' },
  title: 'Our Partners | Catch-22 New Zealand',
  description:
    'Meet the fishing guides, charters, and conservation organisations that test and trust Catch-22 gear in the harshest New Zealand conditions.',
  openGraph: {
    title: 'Our Partners | Catch-22 New Zealand',
    description:
      'Meet the fishing guides, charters, and conservation organisations that test and trust Catch-22 gear in the harshest New Zealand conditions.',
    url: 'https://catch-22.co.nz/partners',
    siteName: 'Catch-22',
    locale: 'en_NZ',
    type: 'website',
    images: [
      {
        url: 'https://wcoaqlglwxwceqktpckt.supabase.co/storage/v1/object/public/media/site/partner-thunder.jpg',
        width: 1200,
        height: 630,
        alt: 'Catch-22 Partners — THUNDER Charter and Sea Cleaners',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Our Partners | Catch-22 New Zealand',
    description:
      'Meet the fishing guides, charters, and conservation organisations that test and trust Catch-22 gear in the harshest New Zealand conditions.',
    images: [
      'https://wcoaqlglwxwceqktpckt.supabase.co/storage/v1/object/public/media/site/partner-thunder.jpg',
    ],
  },
};

export default function PartnersPage() {
  const partners = [
    {
      name: 'Ham & Cheese Fishing Adventures',
      description:
        'Follow Ham & Cheese for some off the hook entertainment. Check out their shop for custom mugs, hats, and the legendary Sledger Rigs.',
      links: [
        { label: 'Facebook', url: 'https://www.facebook.com/share/g/1HJnwn1Pt9/' },
        { label: 'YouTube', url: 'https://www.youtube.com/@hamandtysfishingadventures9685' },
      ],
      image: '/partners/ham-cheese-logo.jpg',
      imageAlt: 'Ham and Cheese Fishing Adventures',
    },
    {
      name: 'Northland Fishing and Mental Wellness Support Group',
      description:
        'A dedicated initiative combining the healing power of fishing and the outdoors with community support for mental wellness. A safe place to share and heal.',
      links: [
        { label: 'Facebook Group', url: 'https://www.facebook.com/groups/531386178569441/' },
        {
          label: 'Donate',
          url: 'https://givealittle.co.nz/cause/koha-towards-community-fishing-program-focusing-on',
        },
      ],
      image: '/partners/northland-logo.jpg',
      imageAlt: 'Northland Fishing and Mental Wellness Support Group community',
    },
    {
      name: 'NZ ANGLER',
      description:
        'Our mates down at NZ ANGLER provide solid acidwrap rods and pro-series reels for the serious fisho.',
      links: [{ label: 'Visit Website', url: 'https://nzangler.co.nz/' }],
      image: getStorageUrl('site/snap2.jpg'),
      imageAlt: 'NZ Angler fishing rods and reels',
    },
    {
      name: 'THUNDER Charter',
      description:
        'Run by Charles at Bay of Plenty Boat Hire. A premier charter experience testing Catch-22 gear in the toughest conditions.',
      links: [{ label: 'Visit Website', url: 'https://www.bayofplentyboathire.co.nz' }],
      image: '/partners/thunder-logo.jpg',
      imageAlt: 'THUNDER Charter boat on Bay of Plenty waters',
    },
    {
      name: 'Sea Cleaners',
      description:
        'Dedicated to preserving our New Zealand coastlines. We are proud to support their mission by donating 2.5% of all profits.',
      links: [{ label: 'Visit Website', url: 'https://seacleaners.org.nz/' }],
      image: '/seacleaners-logos.png',
      imageAlt: 'Sea Cleaners volunteers cleaning New Zealand coastline',
    },
  ];

  return (
    <main className="bg-white pt-(--header-h) pb-16 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center text-center mb-16">
          <h1 className="text-4xl font-black text-secondary uppercase tracking-tight mb-4">
            Our Partners
          </h1>
          <div className="h-2 w-24 bg-primary" />
          <p className="mt-6 text-slate-500 font-medium text-lg max-w-2xl">
            We work with the best in the business to ensure our gear is truly tried and true.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="group bg-slate-50 rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 ease-out flex flex-col"
            >
              <div className="relative h-64 overflow-hidden bg-white">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-secondary/20 group-hover:bg-secondary/10 transition-colors z-10 pointer-events-none"
                />
                <Image
                  src={partner.image}
                  alt={partner.imageAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-contain p-8 group-hover:scale-105 transition-transform duration-500 ease-out"
                />
              </div>
              <div className="p-8 flex flex-col flex-1">
                <h2 className="text-2xl font-black text-secondary uppercase mb-4 leading-tight">
                  {partner.name}
                </h2>
                <p className="text-slate-600 font-medium mb-8">{partner.description}</p>
                <div className="flex flex-wrap gap-4 mt-auto">
                  {partner.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit ${partner.name} ${link.label} (opens in new tab)`}
                      className="inline-block bg-white text-secondary border-2 border-secondary hover:bg-secondary hover:text-white font-black py-3 px-6 rounded-full transition-all uppercase tracking-widest text-[10px]"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-24 text-center">
          <h3 className="text-xl font-black text-secondary uppercase tracking-[0.2em] mb-8">
            Want to partner with us?
          </h3>
          <Link
            href="/contact"
            className="text-primary-ink font-black uppercase tracking-widest border-b-2 border-primary-ink hover:text-secondary hover:border-secondary transition-all"
          >
            Get in touch today
          </Link>
        </div>
      </div>
    </main>
  );
}
