'use client';

import { ArrowUpRight, Calendar, Heart, Music, PhoneCall, Sparkles, Vote } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { getTickerEvents } from '@/lib/queries/civic-client';

export interface TickerItem {
  icon?: React.ReactNode;
  label: string;
  detail: string;
  href: string;
  badge: string;
}

const DEFAULT_TICKER_ITEMS: TickerItem[] = [
  {
    icon: <Calendar size={14} className="text-accent-gold-on-dark" />,
    label: 'Next Chapter Assembly',
    detail: "1st Tuesday of the month • St. Michael's Carmichael",
    href: '/events',
    badge: 'Meeting',
  },
  {
    icon: <Music size={14} className="text-accent-gold-on-dark" />,
    label: 'Resistance Choir Rehearsal',
    detail: 'Every other Wednesday • 6:30 PM • All Voices Welcome',
    href: '/choir',
    badge: 'Choir',
  },
  {
    icon: <PhoneCall size={14} className="text-accent-gold-on-dark" />,
    label: 'Sacramento Rep Directory & 5 Calls Scripts',
    detail: 'Lookup CA-03 / CA-06 elected officials in seconds',
    href: '/voter-info',
    badge: 'Advocacy',
  },
  {
    icon: <Vote size={14} className="text-accent-gold-on-dark" />,
    label: 'Grassroots Postcard Blitz',
    detail: 'Writing swing voter cards across Sacramento County',
    href: '/events',
    badge: 'Voter Turnout',
  },
  {
    icon: <Heart size={14} className="text-accent-gold-on-dark" />,
    label: 'Community Food Bank Drive',
    detail: 'Bring non-perishable cans to our monthly gathering',
    href: '/events',
    badge: 'Mutual Aid',
  },
];

export function CivicActionTicker({
  items: initialItems,
  initialData,
}: {
  items?: TickerItem[];
  initialData?: Record<string, string>;
} = {}) {
  const { dataPoints } = useDataPoints('home', initialData);
  const [items, setItems] = useState<TickerItem[]>(initialItems ?? []);

  useEffect(() => {
    if (initialItems && initialItems.length > 0) return;
    getTickerEvents().then((rows) => {
      if (rows.length > 0) {
        setItems(
          rows.map((r) => ({ ...r, icon: <Sparkles size={14} className="text-accent-gold" /> }))
        );
      }
    });
  }, [initialItems]);

  const TICKER_ITEMS = items.length > 0 ? items : DEFAULT_TICKER_ITEMS;
  // The old strip let its fifth item run off the right edge without any
  // indication that it could be scrolled. Two featured items keep each line
  // readable; the rest stay one click away in All events.
  const displayItems = TICKER_ITEMS.slice(0, 2);

  return (
    <section
      aria-label="Community pulse"
      className="relative border-y border-white/10 bg-secondary text-ink-on-dark"
    >
      <h2 className="sr-only">Community pulse</h2>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-stretch">
          <div className="flex shrink-0 items-start gap-3 border-b border-white/10 py-3 md:w-52 md:border-b-0 md:border-r md:py-4 md:pr-6">
            <span className="flex size-8 shrink-0 items-center justify-center border border-accent-gold-on-dark/35 bg-white/5">
              <Sparkles size={14} className="text-accent-gold-on-dark" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-accent-gold-on-dark">
                <DataPoint as="span" name="home.ticker.pulse" initialData={dataPoints}>
                  Community Pulse
                </DataPoint>
              </p>
              <p className="mt-1 hidden text-[10px] leading-snug text-ink-muted-on-dark md:block">
                What&apos;s happening next
              </p>
              <Link
                href="/events"
                className="mt-1.5 hidden min-h-11 items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-on-dark transition-colors hover:text-accent-gold-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold-on-dark focus-visible:ring-inset md:inline-flex"
              >
                All events
                <ArrowUpRight size={11} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="relative min-w-0 flex-1">
            <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-2 md:overflow-visible">
              {displayItems.map((item, index) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group flex min-w-[19rem] snap-start items-start gap-3 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold-on-dark focus-visible:ring-inset md:min-w-0 md:px-5 md:py-4 ${
                    index > 0 ? 'border-l border-white/10' : ''
                  }`}
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-white/15 bg-white/5">
                    {item.icon ?? (
                      <Sparkles size={14} className="text-accent-gold-on-dark" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-accent-gold-on-dark">
                      {item.badge}
                    </span>
                    <span className="mt-1 block font-display text-[1.05rem] font-semibold leading-snug text-white transition-colors group-hover:text-accent-gold-on-dark">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-ink-muted-on-dark">
                      {item.detail}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-secondary to-transparent lg:hidden"
            />
          </div>

        </div>
      </div>
    </section>
  );
}
