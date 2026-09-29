'use client';

import * as Dialog from '@radix-ui/react-dialog';
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
import { useCallback, useEffect, useId, useMemo, useState } from 'react';

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

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary';

export function CivicCommandPalette({
  isOpen: controlledOpen,
  setIsOpen: setControlledOpen,
}: {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen: (open: boolean) => void = setControlledOpen ?? setInternalOpen;
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const listboxId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return PALETTE_ITEMS;
    return PALETTE_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle)
    );
  }, [query]);

  // The highlight must stay inside the result set: shrinking the list while the
  // last index was selected left the palette with no active option and Enter did
  // nothing.
  const activeIndex =
    filteredItems.length === 0 ? -1 : Math.min(selectedIndex, filteredItems.length - 1);
  const activeItem = filteredItems[activeIndex];

  const handleSelect = useCallback(
    (item: PaletteItem) => {
      setIsOpen(false);
      setQuery('');
      setSelectedIndex(0);
      if (item.isExternal) {
        window.open(item.href, '_blank', 'noopener,noreferrer');
      } else {
        router.push(item.href);
      }
    },
    [router, setIsOpen]
  );

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(filteredItems.length === 0 ? 0 : (activeIndex + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(
        filteredItems.length === 0
          ? 0
          : (activeIndex - 1 + filteredItems.length) % filteredItems.length
      );
    } else if (e.key === 'Enter' && activeItem) {
      e.preventDefault();
      handleSelect(activeItem);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelectedIndex(0);
    } else if (e.key === 'End' && filteredItems.length > 0) {
      e.preventDefault();
      setSelectedIndex(filteredItems.length - 1);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        // p-2 plus a 20px glyph is 36px — under the 44px minimum target.
        className={`inline-flex items-center justify-center size-11 -mr-1 rounded-lg text-ink-on-dark hover:text-white hover:bg-white/10 transition-colors duration-300 ease-out ${FOCUS_RING}`}
        aria-label="Search site (Command K)"
        title="Search site (⌘K)"
      >
        <Search size={20} aria-hidden="true" />
      </button>

      {/*
        This was a hand-rolled `role="dialog" aria-modal="true"` div. It had no
        focus trap, no `inert` on the page behind it, no scroll lock, and no focus
        restoration — so tabbing walked straight out of the "modal" into the page
        underneath. Radix supplies all of it and is already a dependency.

        The result list was also semantically broken: a `<button>` with its role
        overridden to `option`, inside a `role="listbox"`, with focus never
        entering the listbox. `aria-selected` was therefore never announced and
        the entire selection model was unreachable non-visually. It is now a
        proper combobox: focus stays in the input and `aria-activedescendant`
        points at the active option.

        The two Biome a11y rules disabled for this file in biome.json
        (`noNoninteractiveElementToInteractiveRole`, `useFocusableInteractive`)
        assume a listbox that takes DOM focus. This one does not — options are
        intentionally unfocusable because `aria-activedescendant` is what conveys
        the active option, and `ul`/`li` are the elements ARIA-in-HTML designates
        for `listbox`/`option`.
      */}
      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[120] bg-secondary/80 backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
          <Dialog.Content
            className="fixed left-1/2 top-20 sm:top-28 z-[130] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 bg-secondary border border-white/10 rounded-2xl shadow-float overflow-hidden data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:duration-200 data-[state=closed]:duration-150"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">Civic quick search</Dialog.Title>

            <div className="flex items-center px-4 py-3.5 border-b border-white/10 gap-3">
              <Search size={18} className="text-primary-light shrink-0" aria-hidden="true" />
              <input
                type="text"
                role="combobox"
                aria-expanded={filteredItems.length > 0}
                aria-controls={listboxId}
                aria-activedescendant={activeItem ? `${listboxId}-${activeItem.id}` : undefined}
                aria-autocomplete="list"
                aria-label="Search pages and actions"
                autoFocus
                placeholder="Type a page, action, or civic topic…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleInputKeyDown}
                className="w-full bg-transparent text-white placeholder-ink-muted-on-dark text-sm focus:outline-none"
              />
              <Dialog.Close
                className={`inline-flex items-center justify-center size-9 rounded-md text-ink-muted-on-dark hover:text-white hover:bg-white/10 transition-colors duration-300 ease-out ${FOCUS_RING}`}
                aria-label="Close search dialog"
              >
                <X size={16} aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/*
              Result count is announced: without it, filtering to zero results is
              completely silent.
            */}
            <p role="status" aria-live="polite" className="sr-only">
              {filteredItems.length} result{filteredItems.length === 1 ? '' : 's'} available
            </p>

            <ul
              id={listboxId}
              role="listbox"
              aria-label="Search results"
              className="max-h-80 overflow-y-auto p-2 divide-y divide-white/5 list-none"
            >
              {filteredItems.length === 0 ? (
                <li className="py-8 text-center text-ink-muted-on-dark text-xs">
                  No matching civic actions or pages found.
                </li>
              ) : (
                filteredItems.map((item, index) => {
                  const Icon = item.icon;
                  const isSelected = index === activeIndex;
                  return (
                    <li
                      key={item.id}
                      id={`${listboxId}-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      // `onMouseDown` fires before the input's blur, so a click
                      // both selects and keeps focus in the combobox.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(item);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors duration-300 ease-out list-none ${
                        isSelected
                          ? 'bg-primary/20 text-white border border-primary-light/30'
                          : 'text-ink-on-dark border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-primary text-white'
                              : 'bg-white/10 text-ink-muted-on-dark'
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            <span>{item.title}</span>
                            {item.isExternal && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-ink-muted-on-dark font-mono">
                                external
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-ink-muted-on-dark">{item.description}</div>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-ink-muted-on-dark px-2 py-0.5 rounded bg-white/5">
                        {item.category}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="px-4 py-2 bg-secondary/60 border-t border-white/10 flex items-center justify-between text-xs text-ink-muted-on-dark">
              <div className="flex items-center gap-2">
                <span>Navigate</span>
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono">
                  ↑
                </kbd>
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono">
                  ↓
                </kbd>
                <span className="ml-2">Select</span>
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono">
                  ↵
                </kbd>
              </div>
              <div>
                <span>Close</span>
                <kbd className="ml-1.5 px-1 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono">
                  esc
                </kbd>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
