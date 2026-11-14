'use client';

import { Calendar, Heart, Music, PhoneCall, Sparkles, Vote } from 'lucide-react';
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
    icon: <Calendar size={14} className="text-accent-gold" />,
    label: 'Next Chapter Assembly',
    detail: "1st Tuesday of the month • St. Michael's Carmichael",
    href: '/events',
    badge: 'Meeting',
  },
  {
    icon: <Music size={14} className="text-primary-on-dark-muted" />,
    label: 'Resistance Choir Rehearsal',
    detail: 'Every other Wednesday • 6:30 PM • All Voices Welcome',
    href: '/choir',
    badge: 'Choir',
  },
  {
    icon: <PhoneCall size={14} className="text-emerald-400" />,
    label: 'Sacramento Rep Directory & 5 Calls Scripts',
    detail: 'Lookup CA-03 / CA-06 elected officials in seconds',
    href: '/voter-info',
    badge: 'Advocacy',
  },
  {
    icon: <Vote size={14} className="text-purple-400" />,
    label: 'Grassroots Postcard Blitz',
    detail: 'Writing swing voter cards across Sacramento County',
    href: '/events',
    badge: 'Voter Turnout',
  },
  {
    icon: <Heart size={14} className="text-rose-400" />,
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

  return (
    <div className="w-full overflow-hidden border-y border-secondary bg-secondary py-3.5 text-ink-on-dark">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Fixed title. A ruled label, not another rounded pill. */}
        <div className="flex shrink-0 items-center gap-2 border-r border-white/20 pr-4 text-[10px] font-bold uppercase tracking-[0.16em] text-accent-gold">
          <Sparkles size={12} className="animate-pulse" />
          <DataPoint as="span" name="home.ticker.pulse" initialData={dataPoints}>
            Community Pulse
          </DataPoint>
        </div>

        {/* Scrolling / Flex Items */}
        <div className="flex min-w-0 flex-1 items-center gap-8 overflow-x-auto py-1 text-xs [scrollbar-width:none]">
          {TICKER_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="group flex items-center gap-2.5 whitespace-nowrap transition-colors hover:text-white"
            >
              <span className="p-1 text-accent-gold">
                {item.icon ?? <Sparkles size={14} className="text-accent-gold" />}
              </span>
              <span className="font-bold text-white transition-colors group-hover:text-accent-gold">
                {item.label}:
              </span>
              <span className="text-[11px] text-ink-muted-on-dark">{item.detail}</span>
              <span className="border border-white/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-accent-gold">
                {item.badge}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
