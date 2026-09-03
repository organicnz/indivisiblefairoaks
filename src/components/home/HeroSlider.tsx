'use client';

import { useReducedMotion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStorageUrl } from '@/lib/supabase';

const SLIDE_DURATION = 8000; // 8 seconds per slide

const slides = [
  {
    image: '/stock-split-fish.jpg',
    upperTitle: 'Precision Engineered in NZ',
    title: 'Engineered to',
    highlight: 'Perform.',
    description:
      'High-performance fishing gear, tested in the harshest New Zealand environments. Built for those who demand the best.',
    cta: 'Shop the Collection',
    link: '/products',
  },
  {
    image: '/stock-hooks.jpg',
    upperTitle: 'Proven Performance',
    title: 'Tested in',
    highlight: 'the Wild.',
    description:
      'Battle-tested by experts, trusted by professional charters. We provide gear that stands up to the harshest challenges.',
    cta: 'Our Story',
    link: '/about-us',
  },
  {
    image: '/stock-reel-hands.jpg',
    upperTitle: 'Trophy Results',
    title: 'Tried and',
    highlight: 'True.',
    description:
      'From the Three Kings to the Deep South, our gear is pushed to its absolute limits by the elements.',
    cta: 'View Gallery',
    link: '/gallery',
  },
  {
    image: '/stock-reel-close.jpg',
    upperTitle: 'Precision Engineering',
    title: 'Built for',
    highlight: 'Results.',
    description:
      'Every piece of gear is designed for maximum feedback and durability in the heat of the catch.',
    cta: 'Shop the Gear',
    link: '/products',
  },
  {
    image: '/stock-marlin-vector.png',
    upperTitle: 'Community First',
    title: 'Never Out of',
    highlight: 'a Catch.',
    description:
      'A community of dedicated anglers sharing their best moments from the NZ coastline.',
    cta: 'View Snaps',
    link: '/gallery',
  },
];

export function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // WCAG 2.3.3: autoplay motion must stop for users who opt out of
    // animation; also pause on hover/focus so readers can finish a slide.
    if (reducedMotion || paused) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, [reducedMotion, paused]);

  return (
    <section
      aria-label="Hero — Explore our World"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative h-screen min-h-screen h-[100dvh] w-full flex items-center overflow-hidden bg-secondary"
    >
      {/* Background Images */}
      {slides.map((slide, index) => (
        <div
          key={slide.highlight}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === currentSlide ? 'opacity-60 z-0 scale-100' : 'opacity-0 -z-10 scale-110'
          }`}
          style={{ transition: 'opacity 2000ms ease-in-out, transform 12000ms linear' }}
        >
          <Image
            src={slide.image.startsWith('/') ? slide.image : getStorageUrl(slide.image)}
            alt={slide.title}
            fill
            className="object-cover"
            priority={index === 0}
          />
        </div>
      ))}

      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/20 to-secondary z-1" />
      <div className="absolute inset-0 bg-gradient-to-r from-secondary/40 via-transparent to-transparent z-1" />

      {/* Content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="max-w-4xl">
          <span
            key={`upper-${currentSlide}`}
            className="text-primary font-black uppercase tracking-[0.5em] text-[10px] md:text-xs mb-8 block animate-fade-in"
          >
            {slides[currentSlide].upperTitle}
          </span>
          <h1
            key={`title-${currentSlide}`}
            className="text-6xl md:text-8xl lg:text-[10rem] font-black tracking-tight text-white uppercase leading-[0.8] mb-12 animate-fade-in transition-all duration-700"
          >
            {slides[currentSlide].title} <br />
            <span className="text-primary italic">{slides[currentSlide].highlight}</span>
          </h1>
          <p
            key={`desc-${currentSlide}`}
            className="mt-4 text-xl md:text-2xl text-slate-300 font-medium mb-16 max-w-2xl leading-relaxed animate-fade-in delay-200"
          >
            {slides[currentSlide].description}
          </p>
          <div
            key={`cta-${currentSlide}`}
            className="flex flex-wrap gap-8 items-center animate-fade-in delay-500"
          >
            <Link
              href={slides[currentSlide].link}
              className="group relative inline-flex items-center justify-center bg-primary text-secondary font-black py-6 px-16 rounded-full transition-all duration-500 uppercase tracking-[0.3em] text-xs shadow-2xl shadow-primary/20 hover:scale-105"
            >
              {slides[currentSlide].cta}
            </Link>
          </div>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-12 right-12 flex gap-4 z-20">
        {slides.map((slide, index) => (
          <button
            key={slide.link + slide.highlight}
            type="button"
            onClick={() => setCurrentSlide(index)}
            className="group relative h-1 w-12 bg-white/20 rounded-full overflow-hidden transition-all hover:bg-white/40"
            aria-label={`Go to slide ${index + 1}`}
          >
            {index === currentSlide && (
              <div
                className="absolute top-0 left-0 h-full bg-primary"
                style={{
                  animation: `progress ${SLIDE_DURATION}ms linear forwards`,
                  width: '100%',
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 text-white/40 z-20 hidden md:flex">
        <span className="text-[8px] font-black uppercase tracking-[0.5em] vertical-rl">Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-primary to-transparent" />
      </div>

      <style>{`
        @keyframes progress {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-fade-in {
          animation: fadeIn 1.2s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
