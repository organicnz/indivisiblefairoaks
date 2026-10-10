'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ProductCard } from './ProductCard';

interface ProductSliderProps {
  products: React.ComponentProps<typeof ProductCard>['product'][];
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function ProductSlider({ products }: ProductSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    checkScroll();

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, products]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    // `scrollBy` with smooth behavior is JS-driven, so the global
    // prefers-reduced-motion CSS guard cannot intercept it.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({
      left: direction === 'left' ? -el.clientWidth : el.clientWidth,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  if (!products || products.length === 0) return null;

  const arrow = (direction: 'left' | 'right') => {
    const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
    const visible = direction === 'left' ? showLeftArrow : showRightArrow;
    return (
      <button
        type="button"
        onClick={() => scroll(direction)}
        disabled={!visible}
        // The arrows used to be `opacity-0 group-hover:opacity-100`, which hid
        // them from keyboard users while leaving them focusable. They are now
        // hidden only when there is nothing in that direction, and always
        // visible on focus.
        className={`inline-flex size-12 items-center justify-center rounded-full bg-surface-card border border-border shadow-float transition-colors duration-300 ease-out ${FOCUS_RING} ${
          visible ? 'text-foreground hover:bg-primary hover:text-white' : 'invisible'
        }`}
        aria-label={`Scroll ${direction === 'left' ? 'left' : 'right'}`}
      >
        <Icon className="w-6 h-6" aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className="relative">
      {/*
        The controls were `hidden md:block`, so on a phone the carousel had no
        controls at all. The swipe gesture still worked, but there was no
        discoverable way to reach the off-screen products.
      */}
      <div className="flex justify-end gap-2 mb-3 md:absolute md:top-1/2 md:-right-8 md:-translate-y-1/2 md:mb-0 md:z-20 hidden md:flex">
        {arrow('left')}
        {arrow('right')}
      </div>

      {/*
        `role="region"` + a label + `tabIndex={0}`: an `overflow-x-auto` element
        is no longer focusable by default in Chrome and Firefox, so without this
        a keyboard user cannot scroll the carousel at all.
      */}
      <section
        ref={scrollRef}
        aria-label="Related products"
        // WAI-ARIA "Scrollable Region" pattern: a scroll container must be
        // focusable and named, or a keyboard user cannot reach the off-screen
        // products at all. Browsers stopped making overflow containers
        // focusable on their own. Biome's noNoninteractiveTabindex does not
        // model this pattern; it is suppressed for this file in biome.json.
        tabIndex={0}
        className={`flex gap-4 sm:gap-8 overflow-x-auto pb-4 pt-4 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${FOCUS_RING}`}
      >
        {products.map((product) => (
          <div key={product.id} className="min-w-[46%] sm:min-w-[45%] lg:min-w-[23%] snap-start">
            <ProductCard product={product} />
          </div>
        ))}
      </section>

      {/*
        Touch-only affordance: the arrows are hidden below md, so mobile needs its
        own control. Rendered inline rather than absolutely positioned.
      */}
      <div className="flex justify-center gap-3 mt-2 md:hidden">
        <button
          type="button"
          onClick={() => scroll('left')}
          disabled={!showLeftArrow}
          className={`inline-flex size-12 items-center justify-center rounded-full bg-surface-card border border-border shadow-raised transition-colors duration-300 ease-out ${FOCUS_RING} ${
            showLeftArrow ? 'text-foreground' : 'invisible'
          }`}
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => scroll('right')}
          disabled={!showRightArrow}
          className={`inline-flex size-12 items-center justify-center rounded-full bg-surface-card border border-border shadow-raised transition-colors duration-300 ease-out ${FOCUS_RING} ${
            showRightArrow ? 'text-foreground' : 'invisible'
          }`}
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
