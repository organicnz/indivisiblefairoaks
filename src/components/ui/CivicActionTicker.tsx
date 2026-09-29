'use client';

import { Calendar, Heart, Music, PhoneCall, Sparkles, Vote } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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

export function CivicActionTicker({ items: initialItems }: { items?: TickerItem[] } = {}) {
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
    <div className="w-full bg-secondary/90 border-y border-white/10 overflow-hidden py-3 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Fixed Title Tag */}
        <div className="shrink-0 flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary-bright/20 border border-primary-on-dark-muted/30 text-primary-on-dark text-[11px] font-black uppercase tracking-wider">
          <Sparkles size={12} className="text-accent-gold animate-pulse" />
          <span>Community Pulse</span>
        </div>

        {/* Scrolling / Flex Items */}
        <div className="flex items-center gap-8 overflow-x-auto [scrollbar-width:none] py-1 text-xs">
          {TICKER_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-2.5 whitespace-nowrap text-ink-on-dark hover:text-white group transition-colors"
            >
              <span className="p-1 rounded-md bg-secondary border border-white/10 group-hover:border-slate-700">
                {item.icon ?? <Sparkles size={14} className="text-accent-gold" />}
              </span>
              <span className="font-bold text-white group-hover:text-primary-on-dark transition-colors">
                {item.label}:
              </span>
              <span className="text-ink-muted-on-dark text-[11px]">{item.detail}</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-secondary text-accent-gold border border-accent-gold/20">
                {item.badge}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
