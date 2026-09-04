'use client';

import { Quote, Star } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getTestimonials } from '@/lib/queries/content-client';
import { sanitizeWPContent } from '@/lib/sanitize';

const STAR_POSITIONS = ['first', 'second', 'third', 'fourth', 'fifth'] as const;

export function TestimonialSection() {
  const [testimonials, setTestimonials] = useState<
    { name: string; role: string; content: string; image: string; stars: number }[]
  >([]);

  useEffect(() => {
    getTestimonials().then((data) => {
      if (data) setTestimonials(data);
    });
  }, []);

  const displayTestimonials =
    testimonials.length > 0
      ? testimonials
      : [
          {
            name: 'Capt. Charles',
            role: 'Thunder Charter',
            content:
              'There you go mate! 40.1kg Kingfish, we got 4 yesterday. Your braid doing the business!',
            stars: 5,
            image: 'site/charles-kingfish.png',
          },
          {
            name: 'Ham & Cheese',
            role: 'Local NZ Fishing Celebrities',
            content:
              "She's like rope, it's bloody good stuff. Bay of Plenty Boat Hire use this stuff on their rods when they're catching the big stuff – This is the braid we use on all our gear.",
            stars: 5,
            image: 'site/ham-cheese-kingfish.png',
          },
          {
            name: 'Mike Thompson',
            role: 'Weekend Warrior',
            content:
              "What impressed me most is how well it holds up over time. No fraying, no colour bleed like I've had with other brands, it's super sensitive, you can feel every little nibble.",
            stars: 5,
            image: 'site/mike-fish.png',
          },
        ];

  return (
    <section className="py-40 bg-white relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-xl mb-24">
          <span className="text-primary-ink font-black uppercase tracking-[0.4em] text-[10px] mb-4 block">
            Proven Performance
          </span>
          <h2 className="text-5xl md:text-7xl font-black text-secondary uppercase tracking-tighter leading-[0.9]">
            Trusted By <br /> <span className="text-slate-500">The Pros</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {displayTestimonials.map((t) => (
            <div
              key={t.name}
              className="group p-10 lg:p-12 rounded-[3.5rem] bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-[0_80px_100px_-30px_rgba(0,0,0,0.1)] hover:-translate-y-3 transition-all duration-700 ease-out"
            >
              <div className="flex gap-1 mb-10">
                {STAR_POSITIONS.slice(0, t.stars).map((position) => (
                  <Star
                    key={`${t.name}-star-${position}`}
                    className="w-3 h-3 fill-primary text-primary"
                  />
                ))}
              </div>

              {t.image && (
                <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden mb-10 border border-slate-100 shadow-inner">
                  <Image
                    src={t.image}
                    alt={t.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
              )}

              <div className="relative mb-10">
                <Quote className="w-12 h-12 text-primary/10 absolute -top-4 -left-4 group-hover:text-primary/20 transition-colors duration-500" />
                <p className="text-slate-600 font-medium text-lg lg:text-xl leading-relaxed relative z-10 italic">
                  &ldquo;{sanitizeWPContent(t.content)}&rdquo;
                </p>
              </div>

              <div className="pt-8 border-t border-slate-100">
                <h4 className="font-black text-secondary uppercase tracking-[0.2em] text-xs">
                  {t.name}
                </h4>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">
                  {t.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decorative background flair */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary opacity-[0.03] rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-secondary opacity-[0.02] rounded-full blur-[150px] translate-x-1/4 translate-y-1/4" />
    </section>
  );
}
