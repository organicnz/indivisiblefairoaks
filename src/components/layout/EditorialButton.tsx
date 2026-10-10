'use client';

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  History,
  Layers,
  PenLine,
  Plus,
  Settings,
  X,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { discoverPageSections, type PublishedSection } from '@/lib/visual-sections';
import type { VisualSectionsPublishedDetail } from '@/types/visual-edit';
import { useEditContext } from './useEditContext';
import { useVisualEditMode } from './visual-edit-store';

/**
 * The editorial control in the site header and the navigation drawer.
 *
 * One press turns visual editing on for the whole site; the popover then lists
 * the sections on the current page with a switch each, so an admin turns the
 * frame on for the part of the page they are working on rather than for every
 * heading at once.
 *
 * **The section list is published by the overlay, not derived here.** This
 * component used to run its own `collectPageSections` over the DOM and its own
 * enablement set, which produced a second list that agreed with the overlay's
 * only while nothing had been sanitized out of the page. It could therefore
 * offer to edit an element that was a different section — and the edit went to
 * the wrong block. Now `indivisible:page-sections-updated` is the only source,
 * with a DOM-only discovery as the fallback for the moment before the overlay
 * has published anything.
 */

export function EditorialButton() {
  const pathname = usePathname();
  const { loading, isAdmin, target } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sections, setSections] = useState<PublishedSection[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * The overlay's own list, adopted per pathname.
   *
   * A stale publication from the previous page would list sections that are not
   * on this one, so the pathname is part of the comparison — a section list
   * that outlived its page is a list of links that jump nowhere.
   */
  useEffect(() => {
    if (!enabled) {
      setSections([]);
      return;
    }

    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<VisualSectionsPublishedDetail>).detail;
      if (!detail || !Array.isArray(detail.sections)) {
        setSections(discoverPageSections(document.querySelector('main')));
        return;
      }
      if (detail.pathname && detail.pathname !== pathname) return;
      setSections(detail.sections);
    };

    window.addEventListener('indivisible:page-sections-updated', handleUpdate);
    handleUpdate(new CustomEvent('indivisible:page-sections-updated'));
    return () => {
      window.removeEventListener('indivisible:page-sections-updated', handleUpdate);
    };
  }, [enabled, pathname]);

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

  if (loading) {
    return (
      <span aria-hidden="true" className="hidden sm:inline-block size-11 rounded-lg bg-white/10" />
    );
  }

  if (!isAdmin) return null;

  const tooltip = enabled
    ? `Visual editing is ON${target ? ` for ${target.label}` : ''} — click to configure sections`
    : `Turn on visual editing${target ? ` for ${target.label}` : ' for this page'}`;

  // Dynamic label for the toggle button
  const buttonLabel =
    enabled && target ? `Edit · ${target.label}` : enabled ? 'Visual Edit: ON' : 'Visual Edit';

  const framedCount = sections.filter((section) => section.enabled).length;
  const allActive = sections.length > 0 && framedCount === sections.length;

  /**
   * Ask the overlay to turn every section's frame on or off.
   *
   * Dispatched, not applied locally: the overlay owns the frames, and a local
   * set that the overlay does not share is a switch that moves and changes
   * nothing.
   */
  const toggleAll = (next: boolean) => {
    window.dispatchEvent(
      new CustomEvent('indivisible:toggle-section-visual', { detail: { all: next } })
    );
  };

  return (
    <div ref={containerRef} className="relative hidden sm:inline-flex items-center">
      <div
        className={`inline-flex items-center rounded-xl transition-all duration-300 ease-out ${
          enabled
            ? 'bg-accent-gold/20 ring-2 ring-accent-gold shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse'
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
          <span className="hidden xl:inline">{buttonLabel}</span>
          {enabled && sections.length > 0 && (
            <span
              aria-hidden="true"
              className="hidden xl:inline-flex items-center justify-center rounded-full bg-accent-gold/30 px-1.5 py-0.5 text-[10px] font-black text-accent-gold min-w-[18px]"
            >
              {framedCount}/{sections.length}
            </span>
          )}
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
            title="Browse and configure visual sections"
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
          className="absolute right-0 top-full mt-2 w-88 rounded-2xl border border-accent-gold/40 bg-secondary/95 p-3.5 text-ink-on-dark shadow-float backdrop-blur-md z-[60] animate-in fade-in-0 zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <Layers size={14} className="text-accent-gold" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Page Sections
              </span>
              <span className="rounded-full bg-accent-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-accent-gold">
                {framedCount}/{sections.length} Active
              </span>
            </div>
            <div className="flex items-center gap-2">
              {sections.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleAll(!allActive)}
                  className="text-[10px] font-bold uppercase tracking-wider text-accent-gold hover:text-white transition-colors"
                >
                  {allActive ? 'Mute All' : 'Turn On All'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
                aria-label="Close section menu"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Section List with Individual Visual Activation Switches */}
          {sections.length > 0 ? (
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
              {sections.map((sec, position) => {
                const isSecActive = sec.enabled;
                const blockIndex = sec.blockIndex;
                /**
                 * `null` until the overlay has published its model.
                 *
                 * Every control here addresses a block, so a section the overlay
                 * has not described cannot be edited, moved or deleted from the
                 * header. Rendering them live anyway would dispatch an event the
                 * overlay has to guess at — which is exactly the failure this
                 * whole model exists to prevent.
                 */
                const unaddressed = blockIndex === null;
                const unaddressedTitle = 'Waiting for the editor to describe this page';
                return (
                  <div
                    key={`${sec.blockIndex ?? 'd'}:${sec.index ?? position}`}
                    className={`group flex items-center justify-between gap-1.5 rounded-xl p-2 transition-all border ${
                      isSecActive
                        ? 'bg-accent-gold/10 border-accent-gold/30 hover:bg-accent-gold/15'
                        : 'bg-white/5 border-transparent hover:bg-white/10'
                    }`}
                  >
                    {/* Per-section Visual Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSecActive}
                      aria-label={`Toggle visual editing for ${sec.label || `Section ${position + 1}`}`}
                      disabled={unaddressed}
                      onClick={() => {
                        if (blockIndex === null) return;
                        window.dispatchEvent(
                          new CustomEvent('indivisible:toggle-section-visual', {
                            detail: { blockIndex, enabled: !isSecActive },
                          })
                        );
                      }}
                      title={
                        isSecActive
                          ? 'Visual frame active — click to hide'
                          : 'Turn on visual section frame'
                      }
                      className={`shrink-0 rounded-lg p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold ${
                        isSecActive
                          ? 'bg-accent-gold/30 text-accent-gold ring-1 ring-accent-gold/50'
                          : 'bg-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {isSecActive ? (
                        <Eye size={13} className="text-accent-gold" />
                      ) : (
                        <EyeOff size={13} />
                      )}
                    </button>

                    {/* Section Label / Jump */}
                    <button
                      type="button"
                      disabled={unaddressed}
                      title={unaddressed ? unaddressedTitle : `Jump to ${sec.label}`}
                      onClick={() => {
                        if (blockIndex === null) return;
                        setIsMenuOpen(false);
                        window.dispatchEvent(
                          new CustomEvent('indivisible:focus-section', {
                            detail: { blockIndex, openEdit: false },
                          })
                        );
                      }}
                      className="flex-1 text-left min-w-0 disabled:opacity-50"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 size-4 rounded-full bg-white/10 text-[10px] font-bold text-slate-300 flex items-center justify-center">
                          {position + 1}
                        </span>
                        <span className="text-xs font-semibold text-white truncate max-w-[130px]">
                          {sec.label || `Section ${position + 1}`}
                        </span>
                        {sec.blockType && (
                          <span className="shrink-0 rounded bg-white/10 px-1 py-0.5 text-[8px] uppercase tracking-wider text-ink-muted-on-dark font-mono">
                            {sec.blockType}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Section Controls */}
                    <div className="flex items-center gap-1">
                      {/* Edit button — dispatches focus-section with openEdit: true */}
                      <button
                        type="button"
                        disabled={unaddressed}
                        title={unaddressed ? unaddressedTitle : 'Edit section'}
                        onClick={() => {
                          if (blockIndex === null) return;
                          setIsMenuOpen(false);
                          window.dispatchEvent(
                            new CustomEvent('indivisible:focus-section', {
                              detail: { blockIndex, openEdit: true },
                            })
                          );
                        }}
                        className="shrink-0 rounded-lg bg-accent-gold/20 p-1.5 text-accent-gold hover:bg-accent-gold/30 transition-colors disabled:opacity-40"
                      >
                        <PenLine size={12} className="text-accent-gold" />
                      </button>

                      {/* Duplicate Section */}
                      <button
                        type="button"
                        disabled={unaddressed}
                        title={unaddressed ? unaddressedTitle : 'Duplicate section'}
                        onClick={() => {
                          if (blockIndex === null) return;
                          window.dispatchEvent(
                            new CustomEvent('indivisible:duplicate-section', {
                              detail: { blockIndex },
                            })
                          );
                        }}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
                      >
                        <Copy size={12} />
                      </button>

                      {/* Move Up */}
                      <button
                        type="button"
                        disabled={unaddressed || position === 0}
                        title={unaddressed ? unaddressedTitle : 'Move section up'}
                        onClick={() => {
                          if (blockIndex === null) return;
                          window.dispatchEvent(
                            new CustomEvent('indivisible:move-section', {
                              detail: { blockIndex, direction: 'up' },
                            })
                          );
                        }}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
                      >
                        <ArrowUp size={12} />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        disabled={unaddressed || position === sections.length - 1}
                        title={unaddressed ? unaddressedTitle : 'Move section down'}
                        onClick={() => {
                          if (blockIndex === null) return;
                          window.dispatchEvent(
                            new CustomEvent('indivisible:move-section', {
                              detail: { blockIndex, direction: 'down' },
                            })
                          );
                        }}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
                      >
                        <ArrowDown size={12} />
                      </button>

                      {/* Add Below */}
                      <button
                        type="button"
                        disabled={unaddressed}
                        title={unaddressed ? unaddressedTitle : 'Add a block below this one'}
                        onClick={() => {
                          if (blockIndex === null) return;
                          setIsMenuOpen(false);
                          window.dispatchEvent(
                            new CustomEvent('indivisible:add-block-at', {
                              detail: { insertAfterBlockIndex: blockIndex },
                            })
                          );
                        }}
                        className="shrink-0 rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                      >
                        <Plus size={12} />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        disabled={unaddressed}
                        title={unaddressed ? unaddressedTitle : 'Delete section'}
                        onClick={() => {
                          if (blockIndex === null) return;
                          window.dispatchEvent(
                            new CustomEvent('indivisible:delete-section', {
                              detail: { blockIndex },
                            })
                          );
                        }}
                        className="shrink-0 rounded-lg bg-accent-red/20 p-1.5 text-accent-red hover:bg-accent-red/30 transition-colors disabled:opacity-40"
                      >
                        <X size={12} className="text-accent-red" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-ink-muted-on-dark">
              No editable blocks on this page yet. Add one from the toolbar at the bottom of the
              screen.
            </div>
          )}

          {/* Open Supabase S3 Media Library */}
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              window.dispatchEvent(new CustomEvent('indivisible:open-media-library'));
            }}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-xl bg-accent-gold/10 border border-accent-gold/30 px-3 py-2 text-xs font-bold text-accent-gold hover:bg-accent-gold/20 transition-colors"
          >
            <FolderOpen size={13} />
            <span>Open Supabase S3 Media Library</span>
          </button>

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
                window.dispatchEvent(new CustomEvent('indivisible:open-revisions'));
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-muted-on-dark hover:text-white"
            >
              <History size={12} />
              <span>Revisions</span>
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
 * Full parity with the header button: the mode switch, the same published
 * section list, and the same per-section frame toggles.
 */
export function EditorialDrawerRow({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { loading, isAdmin } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');
  const [sections, setSections] = useState<PublishedSection[]>([]);
  const [expanded, setExpanded] = useState(false);

  // The overlay's own list, adopted per pathname — never re-derived here.
  useEffect(() => {
    if (!enabled) {
      setSections([]);
      return;
    }
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<VisualSectionsPublishedDetail>).detail;
      if (!detail || !Array.isArray(detail.sections)) {
        setSections(discoverPageSections(document.querySelector('main')));
        return;
      }
      if (detail.pathname && detail.pathname !== pathname) return;
      setSections(detail.sections);
    };
    window.addEventListener('indivisible:page-sections-updated', handleUpdate);
    return () => {
      window.removeEventListener('indivisible:page-sections-updated', handleUpdate);
    };
  }, [enabled, pathname]);

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
            <span>
              Page Blocks ({sections.filter((s) => s.enabled).length}/{sections.length})
            </span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>

          {expanded && (
            <div className="space-y-1 pt-1 max-h-52 overflow-y-auto no-scrollbar">
              {sections.map((sec, position) => {
                const isSecActive = sec.enabled;
                const unaddressed = sec.blockIndex === null;
                return (
                  <div
                    key={`${sec.blockIndex ?? 'd'}:${sec.index ?? position}`}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/5 border border-white/5"
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSecActive}
                      aria-label={`Toggle visual editing for ${
                        sec.label || `Section ${position + 1}`
                      }`}
                      disabled={unaddressed}
                      onClick={() => {
                        if (sec.blockIndex === null) return;
                        window.dispatchEvent(
                          new CustomEvent('indivisible:toggle-section-visual', {
                            detail: { blockIndex: sec.blockIndex, enabled: !isSecActive },
                          })
                        );
                      }}
                      className={`p-1 rounded disabled:opacity-40 ${
                        isSecActive ? 'text-accent-gold bg-accent-gold/20' : 'text-slate-400'
                      }`}
                      title="Toggle section visual"
                    >
                      {isSecActive ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button
                      type="button"
                      disabled={unaddressed}
                      onClick={() => {
                        if (sec.blockIndex === null) return;
                        onNavigate();
                        window.dispatchEvent(
                          new CustomEvent('indivisible:focus-section', {
                            detail: { blockIndex: sec.blockIndex, openEdit: false },
                          })
                        );
                      }}
                      className="flex-1 text-left text-xs text-white truncate disabled:opacity-50"
                    >
                      {sec.label || `Section ${position + 1}`}
                    </button>
                    <button
                      type="button"
                      disabled={unaddressed}
                      onClick={() => {
                        if (sec.blockIndex === null) return;
                        onNavigate();
                        window.dispatchEvent(
                          new CustomEvent('indivisible:focus-section', {
                            detail: { blockIndex: sec.blockIndex, openEdit: true },
                          })
                        );
                      }}
                      className="p-1 rounded text-accent-gold bg-accent-gold/20 disabled:opacity-40"
                      title="Edit section"
                    >
                      <PenLine size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
