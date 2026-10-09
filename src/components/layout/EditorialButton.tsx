'use client';

import { ChevronDown, Layers, PenLine, Plus, Settings, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { collectPageSections, type PageSection } from '@/lib/visual-edit-mode';
import { useEditContext } from './useEditContext';
import { useVisualEditMode } from './visual-edit-store';

/**
 * Editorial Button in the site header and navigation menu.
 *
 * Provides a luxury admin control with a live section-by-section navigator:
 * - One-click toggle of site-wide visual editing mode
 * - Live detection of all addressable sections on the current page
 * - Section navigation popover allowing admins to jump to, highlight, and edit any section
 * - Quick toggles for in-page frames, badges, block insertion, and page settings
 */
export function EditorialButton() {
  const pathname = usePathname();
  const { loading, isAdmin, target } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sections, setSections] = useState<PageSection[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Discover sections on the current page when enabled
  const refreshSections = useCallback(() => {
    if (!enabled) {
      setSections([]);
      return;
    }
    const markedRoot = document.querySelector<HTMLElement>('[data-visual-edit-root]');
    const main = document.querySelector<HTMLElement>('main');
    const root =
      markedRoot ||
      (main &&
      main.children.length === 1 &&
      main.firstElementChild instanceof HTMLElement &&
      (main.firstElementChild as HTMLElement).children.length > 1
        ? (main.firstElementChild as HTMLElement)
        : main);

    if (root) {
      setSections(collectPageSections(root));
    }
  }, [enabled]);

  useEffect(() => {
    refreshSections();
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<PageSection[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setSections(customEvent.detail);
      } else {
        refreshSections();
      }
    };
    window.addEventListener('indivisible:page-sections-updated', handleUpdate);
    return () => {
      window.removeEventListener('indivisible:page-sections-updated', handleUpdate);
    };
  }, [refreshSections]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleSelectSection = (index: number, openEdit = false) => {
    setIsMenuOpen(false);
    window.dispatchEvent(
      new CustomEvent('indivisible:focus-section', {
        detail: { index, openEdit },
      })
    );
  };

  if (loading) {
    return (
      <span aria-hidden="true" className="hidden sm:inline-block size-11 rounded-lg bg-white/10" />
    );
  }

  if (!isAdmin) return null;

  const tooltip = enabled
    ? `Visual editing is ON${target ? ` for ${target.label}` : ''} — click to configure sections`
    : `Turn on visual editing${target ? ` for ${target.label}` : ' for this page'}`;

  return (
    <div ref={containerRef} className="relative hidden sm:inline-flex items-center">
      <div
        className={`inline-flex items-center rounded-xl transition-all duration-300 ease-out ${
          enabled
            ? 'bg-accent-gold/20 ring-2 ring-accent-gold shadow-[0_0_15px_rgba(245,158,11,0.35)]'
            : 'border border-white/10 bg-white/5 hover:border-accent-gold/40 hover:bg-white/10'
        }`}
      >
        {/* Main Mode Toggle Button */}
        <button
          type="button"
          onClick={toggle}
          aria-pressed={enabled}
          data-testid="editorial-edit-button"
          title={tooltip}
          aria-label={tooltip}
          className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-l-xl transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold ${
            enabled ? 'text-accent-gold' : 'text-ink-on-dark hover:text-white'
          }`}
        >
          <PenLine size={16} aria-hidden="true" className={enabled ? 'text-accent-gold' : ''} />
          <span className="hidden xl:inline">{enabled ? 'Visual Edit: ON' : 'Visual Edit'}</span>
          {enabled && (
            <span aria-hidden="true" className="size-2 rounded-full bg-accent-gold animate-pulse" />
          )}
        </button>

        {/* Section Dropdown Trigger when mode is active */}
        {enabled && (
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-label="Toggle section editor menu"
            title="Browse and jump to page sections"
            className="border-l border-accent-gold/30 px-2 py-2 text-accent-gold hover:bg-accent-gold/20 rounded-r-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {/* ── Section Navigation Dropdown Popover ─────────────────────────── */}
      {enabled && isMenuOpen && (
        <div
          role="dialog"
          aria-label="Page Sections Menu"
          className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-accent-gold/40 bg-secondary/95 p-3.5 text-ink-on-dark shadow-float backdrop-blur-md z-[60] animate-in fade-in-0 zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <Layers size={14} className="text-accent-gold" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Page Sections
              </span>
              <span className="rounded-full bg-accent-gold/20 px-1.5 py-0.2 text-[10px] font-bold text-accent-gold">
                {sections.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-md"
              aria-label="Close section menu"
            >
              <X size={14} />
            </button>
          </div>

          {/* Section List */}
          {sections.length > 0 ? (
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1 no-scrollbar">
              {sections.map((sec) => (
                <div
                  key={sec.index}
                  className="group flex items-center justify-between gap-2 rounded-xl p-2 hover:bg-white/10 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectSection(sec.index, false)}
                    className="flex-1 text-left min-w-0"
                    title={`Jump to ${sec.label}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 size-4 rounded-full bg-white/10 text-[10px] font-bold text-slate-300 flex items-center justify-center">
                        {sec.index + 1}
                      </span>
                      <span className="text-xs font-medium text-white truncate">{sec.label}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectSection(sec.index, true)}
                    className="shrink-0 rounded-lg bg-accent-gold/20 px-2 py-1 text-[10px] font-bold text-accent-gold hover:bg-accent-gold/30 transition-colors"
                    title="Edit section content"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-ink-muted-on-dark">
              No addressable sections found in live document.
            </div>
          )}

          {/* Quick Actions Footer */}
          <div className="mt-3 border-t border-white/10 pt-2.5 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                window.dispatchEvent(new CustomEvent('indivisible:add-block'));
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
            >
              <Plus size={12} />
              <span>Add Block</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                window.dispatchEvent(new CustomEvent('indivisible:open-settings'));
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-muted-on-dark hover:text-white"
            >
              <Settings size={12} />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={toggle}
              className="text-[11px] font-bold text-rose-400 hover:text-rose-300"
            >
              Turn Off
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Editorial drawer section for mobile and small-screen layouts.
 *
 * Provides full mobile parity: toggle switch plus interactive section jump list.
 */
export function EditorialDrawerRow({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { loading, isAdmin, target } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');
  const [sections, setSections] = useState<PageSection[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSections([]);
      return;
    }
    const markedRoot = document.querySelector<HTMLElement>('[data-visual-edit-root]');
    const main = document.querySelector<HTMLElement>('main');
    const root =
      markedRoot ||
      (main &&
      main.children.length === 1 &&
      main.firstElementChild instanceof HTMLElement &&
      (main.firstElementChild as HTMLElement).children.length > 1
        ? (main.firstElementChild as HTMLElement)
        : main);

    if (root) {
      setSections(collectPageSections(root));
    }
  }, [enabled]);

  if (loading || !isAdmin) return null;

  return (
    <div className="rounded-xl bg-accent/15 border border-accent-gold/30 p-2 space-y-2">
      {/* Visual Edit Toggle Switch */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => {
          toggle();
        }}
        data-testid="editorial-visual-edit-row"
        className="flex w-full items-center gap-3 px-2 py-2 rounded-lg text-accent-gold transition-colors duration-300 ease-out hover:bg-accent/25 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
      >
        <PenLine size={18} aria-hidden="true" />
        <span className="flex-1 text-left">Visual editing mode</span>
        <span
          aria-hidden="true"
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 ease-out ${
            enabled ? 'bg-accent-gold' : 'bg-white/20'
          }`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-secondary transition-all duration-300 ease-out ${
              enabled ? 'left-4.5' : 'left-0.5'
            }`}
          />
        </span>
      </button>

      {/* Section List for Mobile when enabled */}
      {enabled && sections.length > 0 && (
        <div className="border-t border-accent-gold/20 pt-2 space-y-1">
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="flex w-full items-center justify-between px-2 py-1 text-xs font-bold uppercase tracking-wider text-accent-gold hover:text-white"
          >
            <span>Sections on this page ({sections.length})</span>
            <ChevronDown size={14} className={expanded ? 'rotate-180' : ''} />
          </button>

          {expanded && (
            <div className="max-h-48 overflow-y-auto space-y-1 pt-1 no-scrollbar">
              {sections.map((sec) => (
                <button
                  key={sec.index}
                  type="button"
                  onClick={() => {
                    onNavigate();
                    window.dispatchEvent(
                      new CustomEvent('indivisible:focus-section', {
                        detail: { index: sec.index, openEdit: false },
                      })
                    );
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white hover:bg-white/10"
                >
                  <span className="size-4 rounded-full bg-accent-gold/30 text-[10px] font-bold text-accent-gold flex items-center justify-center">
                    {sec.index + 1}
                  </span>
                  <span className="truncate">{sec.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Link to Full Admin */}
      {target && (
        <Link
          href={target.editUrl}
          onClick={onNavigate}
          data-testid="editorial-edit-drawer-row"
          className="flex items-center gap-3 px-2 py-2 rounded-lg text-accent-gold transition-colors duration-300 ease-out hover:bg-accent/25 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
        >
          <span className="flex-1">Edit this page in admin</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      )}
    </div>
  );
}
