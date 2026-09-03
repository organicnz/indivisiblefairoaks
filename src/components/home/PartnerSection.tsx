import Image from 'next/image';
import { getStorageUrl } from '@/lib/supabase';

const partners = [
  { name: 'Sea Cleaners', logo: getStorageUrl('site/partner-seacleaners.jpg') },
  { name: 'Bay of Plenty Boat Hire', logo: getStorageUrl('site/partner-bop.jpg') },
  { name: 'Thunder Charter', logo: getStorageUrl('site/partner-thunder.jpg') },
  { name: 'Shimano', logo: getStorageUrl('site/partner-shimano.png') },
  { name: 'Yamaha', logo: getStorageUrl('site/partner-yamaha.png') },
  { name: 'Garmin', logo: getStorageUrl('site/partner-garmin.png') },
];

export function PartnerSection() {
  return (
    <section className="py-20 bg-slate-50 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-500 mb-4 italic">
            Trusted By <span className="text-primary-ink not-italic">Experts</span>
          </h2>
          <div className="h-px w-20 bg-primary mx-auto" />
        </div>

        <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-60">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="relative w-32 h-16 grayscale hover:grayscale-0 transition-all duration-500 hover:opacity-100"
            >
              <Image src={partner.logo} alt={partner.name} fill className="object-contain" />
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-2xl mx-auto">
            We collaborate with industry leaders to ensure our gear meets the highest standards of
            performance and reliability.
          </p>
        </div>
      </div>
    </section>
  );
}
