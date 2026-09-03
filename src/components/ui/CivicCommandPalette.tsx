'use client';

import {
  Calendar,
  ExternalLink,
  FileText,
  Heart,
  Mail,
  Music,
  Search,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';

interface PaletteItem {
  id: string;
  title: string;
  description: string;
  category: 'Pages' | 'Direct Actions' | 'Civic Resources';
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isExternal?: boolean;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    id: 'home',
    title: 'Home',
    description: 'Mission, upcoming actions, and chapter overview',
    category: 'Pages',
    href: '/',
    icon: Users,
  },
  {
    id: 'events',
    title: 'Upcoming Events & Actions',
    description: 'Community meetings, rallies, and canvassing dates',
    category: 'Pages',
    href: '/events',
    icon: Calendar,
  },
  {
    id: 'voter-info',
    title: 'Voter Information & Guides',
    description: 'Sacramento County ballot measures, deadlines, and rights',
    category: 'Civic Resources',
    href: '/voter-info',
    icon: Vote,
  },
  {
    id: 'choir',
    title: 'Carmichael Resistance Choir',
    description: 'Music rehearsal schedule, songbook, and events',
    category: 'Pages',
    href: '/choir',
    icon: Music,
  },
  {
    id: 'about',
    title: 'About Our Chapter',
    description: 'Core values, history, and grassroots organizing',
    category: 'Pages',
    href: '/about',
    icon: Users,
  },
  {
    id: 'news',
    title: 'Newsletters & Alerts',
    description: 'Legislative updates and calls to action',
    category: 'Pages',
    href: '/news',
    icon: FileText,
  },
  {
    id: 'links',
    title: 'Coalition Links & Allies',
    description: 'National Indivisible, Sister District, 5 Calls',
    category: 'Civic Resources',
    href: '/links',
    icon: ExternalLink,
  },
  {
    id: 'donate',
    title: 'Donate via ActBlue',
    description: 'Support local grassroots flyers, postcard stamps, and rallies',
    category: 'Direct Actions',
    href: '/donate',
    icon: Heart,
  },
  {
    id: 'contact',
    title: 'Contact Chapter Organizers',
    description: 'Send a message or inquire about volunteering',
    category: 'Pages',
    href: '/contact',
    icon: Mail,
  },
  {
    id: 'ca-voter-reg',
    title: 'Official CA Voter Registration',
    description: 'Register online or check your registration status',
    category: 'Direct Actions',
    href: 'https://registertovote.ca.gov',
    icon: Vote,
    isExternal: true,
  },
  {
    id: 'actblue-direct',
    title: 'ActBlue Chapter Donation',
    description: 'Secure online grassroots donation portal',
    category: 'Direct Actions',
    href: 'https://secure.actblue.com/donate/indivisiblefoc1432155925',
    icon: Heart,
    isExternal: true,
  },
];

export function CivicCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const filteredItems = PALETTE_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (item: PaletteItem) => {
    setIsOpen(false);
    setQuery('');
    if (item.isExternal) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(item.href);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev === 0 ? Math.max(0, filteredItems.length - 1) : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = filteredItems[selectedIndex];
      if (current) handleSelect(current);
    }
  };

  return (
    <>
      {/* Trigger Button in Header */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium transition-all shadow-sm"
        aria-label="Search site (Cmd+K)"
      >
        <Search size={14} className="text-slate-400" />
        <span>Quick Search...</span>
        <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-400">
          ⌘K
        </kbd>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Civic Quick Search"
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          {/* Backdrop button to dismiss */}
          <button
            type="button"
            className="absolute inset-0 w-full h-full cursor-default bg-transparent -z-10 border-0"
            onClick={() => setIsOpen(false)}
            aria-label="Close search modal"
          />

          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 relative z-10">
            {/* Search Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-slate-800 gap-3">
              <Search size={18} className="text-blue-400 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Type a page, action, or civic topic..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleListKeyDown}
                className="w-full bg-transparent text-white placeholder-slate-400 text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close search dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Results List */}
            <div
              role="listbox"
              className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-800/50"
            >
              {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No matching civic actions or pages found.
                </div>
              ) : (
                filteredItems.map((item, index) => {
                  const Icon = item.icon;
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full text-left flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600/20 text-white border border-blue-500/30'
                          : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            <span>{item.title}</span>
                            {item.isExternal && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                external
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">{item.description}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800/80">
                        {item.category}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer / Shortcuts */}
            <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <span>Navigate</span>
                <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono">
                  ↑
                </kbd>
                <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono">
                  ↓
                </kbd>
                <span className="ml-2">Select</span>
                <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono">
                  ↵
                </kbd>
              </div>
              <div>
                <span>Close</span>
                <kbd className="ml-1.5 px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono">
                  esc
                </kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
