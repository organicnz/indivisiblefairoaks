'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Download, Plus, Search, X } from 'lucide-react';
import { useRef, useState } from 'react';

export const EVENT_CATEGORIES = [
  'All Actions',
  'Meetings',
  'Resistance Choir',
  'Voter Mobilization',
  'Rallies & Street Action',
  // Issue #153: Mobilize's COMMUNITY / POSTCARD_WRITING / WORKSHOP events have
  // no honest home among the four editorial categories.
  'Community',
] as const;

export function EventsCalendarToolbar({
  dataPoints,
  isAdmin,
  activeCategory,
  searchQuery,
  onCategoryChange,
  onSearchQueryChange,
  onAddEvent,
  onImportMobilize,
}: {
  dataPoints: Record<string, string>;
  isAdmin: boolean;
  activeCategory: string;
  searchQuery: string;
  onCategoryChange: (category: string) => void;
  onSearchQueryChange: (query: string) => void;
  onAddEvent: () => void;
  onImportMobilize: () => void;
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleFiltersWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // When using a vertical scroll wheel (deltaY) over the single-line filters,
    // convert it to smooth horizontal scrolling.
    if (e.deltaY !== 0 && e.deltaX === 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  const handleCategoryClick = (category: string, e: React.MouseEvent<HTMLButtonElement>) => {
    onCategoryChange(category);
    e.currentTarget?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  };

  return (
    <div className="relative z-20 flex items-center justify-between gap-3 border-y border-border bg-surface-card p-2.5 sm:p-3">
  {/* Expandable Search Button & Input */}
  <div
    className={`relative flex items-center transition-all duration-300 ease-out shrink-0 ${
      isSearchOpen || searchQuery ? 'w-52 sm:w-64 md:w-72' : 'w-9'
    }`}
  >
    {/* Collapsed Search Icon Button */}
    {!isSearchOpen && !searchQuery && (
      <button
        type="button"
        onClick={() => {
          setIsSearchOpen(true);
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }}
        aria-label="Search events"
        className="size-9 min-w-9 shrink-0 aspect-square rounded-full bg-surface-muted/80 dark:bg-slate-800/80 hover:bg-surface-muted dark:hover:bg-slate-750 border border-border dark:border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground dark:text-ink-muted-on-dark dark:hover:text-white transition-all cursor-pointer shadow-xs"
      >
        <Search size={16} className="shrink-0" />
      </button>
    )}

    {/* Expanded / Always-Mounted Search Input Field */}
    {/*
      `relative` is part of the expanded branch, NOT the base string.

      An element carrying both `.relative` and `.absolute` resolves to
      whichever Tailwind emits last, and that is `.relative` (measured in
      the deployed stylesheet: `.absolute` at byte 21586, `.relative` at
      21636). So the collapsed state kept this wrapper in flow at `w-full`
      (36px), and the 36px trigger beside it was flex-shrunk to 18px — the
      magnifier pill in the filter bar rendered as a half-width sliver.
      Verified live: the button measured 18x36 collapsed and 36x36 once
      this wrapper was forced to `position: absolute`.
    */}
    <div
      className={`w-full flex items-center transition-opacity duration-200 ${
        isSearchOpen || searchQuery
          ? 'relative opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none absolute inset-0'
      }`}
    >
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark pointer-events-none"
        size={15}
      />
      <input
        ref={searchInputRef}
        type="text"
        placeholder={
          dataPoints['events.search.placeholder'] ||
          'Search actions, meetings, or locations...'
        }
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        onFocus={() => setIsSearchOpen(true)}
        onBlur={() => {
          if (!searchQuery) {
            setIsSearchOpen(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onSearchQueryChange('');
            setIsSearchOpen(false);
            searchInputRef.current?.blur();
          }
        }}
        className="w-full pl-9 pr-8 py-1.5 rounded-full bg-surface-muted dark:bg-slate-800/90 border border-border dark:border-white/15 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-ink-muted-on-dark text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
      />
      {(isSearchOpen || searchQuery) && (
        <button
          type="button"
          onClick={() => {
            onSearchQueryChange('');
            setIsSearchOpen(false);
            searchInputRef.current?.blur();
          }}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground dark:text-ink-muted-on-dark dark:hover:text-white transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  </div>

  {/* Category Filters (Single-line, horizontally scrollable via vertical mouse wheel) */}
  <div
    onWheel={handleFiltersWheel}
    className="flex items-center gap-1.5 flex-nowrap overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-1 min-w-0 py-1"
  >
    {EVENT_CATEGORIES.map((cat) => (
      <button
        key={cat}
        type="button"
        onClick={(e) => handleCategoryClick(cat, e)}
        className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
          activeCategory === cat
            ? 'bg-primary-bright text-white shadow-md'
            : 'bg-surface-muted text-muted-foreground hover:text-foreground border border-border dark:bg-secondary/60 dark:border-transparent dark:text-ink-muted-on-dark dark:hover:text-ink-on-dark dark:hover:bg-white/5'
        }`}
      >
        {cat}
      </button>
    ))}
  </div>

  {/* In-Page Admin Controls (Issue #153: unified dropdown with Add Event & Import Mobilize) */}
  {isAdmin && (
    <div className="shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Add or import event"
            className="inline-flex min-h-11 cursor-pointer select-none items-center gap-2 border border-accent-gold bg-accent-gold px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-strong transition-colors hover:brightness-95"
          >
            <Plus size={15} />
            <span>Add Event</span>
            <ChevronDown size={14} className="opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="z-[9999] min-w-56 rounded-sm border border-border bg-surface-card p-2 shadow-float animate-in fade-in-0 zoom-in-95"
          >
            <DropdownMenuItem
              className="flex items-start gap-3 p-2.5 rounded-xl cursor-pointer outline-none transition-colors hover:bg-surface-muted dark:hover:bg-white/10"
              onClick={onAddEvent}
            >
              <div className="size-8 rounded-lg bg-accent-gold/20 text-accent-gold flex items-center justify-center shrink-0 mt-0.5">
                <Plus size={16} />
              </div>
              <div>
                <span className="block text-xs font-bold text-foreground dark:text-white">
                  Add Event
                </span>
                <span className="block text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
                  Manually create a new civic event
                </span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="flex items-start gap-3 p-2.5 rounded-xl cursor-pointer outline-none transition-colors hover:bg-surface-muted dark:hover:bg-white/10 mt-1"
              onClick={onImportMobilize}
            >
              <div className="size-8 rounded-lg bg-primary/15 text-primary-bright dark:text-accent-gold flex items-center justify-center shrink-0 mt-0.5">
                <Download size={16} />
              </div>
              <div>
                <span className="block text-xs font-bold text-foreground dark:text-white">
                  Import Mobilize
                </span>
                <span className="block text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
                  1-click import from any Mobilize URL
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    </div>
  )}
</div>
  );
}
