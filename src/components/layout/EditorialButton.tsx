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
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PageSection } from '@/lib/visual-edit-mode';
import { collectPageSections } from '@/lib/visual-edit-mode';
import { useEditContext } from './useEditContext';
import {
  disableAllSectionVisuals,
  enableAllSectionVisuals,
  setSectionVisualEnabled,
  useVisualEditMode,
} from './visual-edit-store';

/**
 * Editorial Button in the site header and navigation menu.
 *
 * Provides a luxury sensory admin control with a live section-by-section navigator:
 * - One-click toggle of site-wide visual editing mode
 * - Live detection of all addressable sections on the current page
 * - Section navigation popover allowing admins to turn on visual section editing for each section
 * - Quick toggles for in-page frames, badges, block insertion, and page settings
 * - Full CRUD operations on visual editor sections via custom events
 */

interface SectionsUpdatePayload {
  sections?: PageSection[];
  activeIndices?: number[];
}

export function EditorialButton() {
  const pathname = usePathname();
  const { loading, isAdmin, target } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sections, setSections] = useState<PageSection[]>([]);
  const [activeIndices, setActiveIndices] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Discover sections on the current page when enabled
  const refreshSections = useCallback(() => {
    if (!enabled) {
      setSections([]);
      setActiveIndices(new Set());
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
      const discovered = collectPageSections(root);
      setSections(discovered);
      setActiveIndices(new Set(discovered.map((s) => s.index)));
    }
  }, [enabled]);

  useEffect(() => {
    refreshSections();
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<PageSection[] | SectionsUpdatePayload>;
      if (customEvent.detail) {
        if (Array.isArray(customEvent.detail)) {
          setSections(customEvent.detail);
          setActiveIndices((prev) =>
            prev.size > 0
              ? prev
              : new Set((customEvent.detail as PageSection[]).map((s) => s.index))
          );
        } else if (customEvent.detail.sections && Array.isArray(customEvent.detail.sections)) {
          setSections(customEvent.detail.sections);
          if (customEvent.detail.activeIndices) {
            setActiveIndices(new Set(customEvent.detail.activeIndices));
          }
        }
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

  const allActive = sections.length > 0 && activeIndices.size === sections.length;

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
              {activeIndices.size}/{sections.length}
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
                {activeIndices.size}/{sections.length} Active
              </span>
            </div>
            <div className="flex items-center gap-2">
              {sections.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !allActive;
                    if (nextVal) {
                      setActiveIndices(new Set(sections.map((s) => s.index)));
                      enableAllSectionVisuals(sections.map((s) => s.index));
                    } else {
                      setActiveIndices(new Set());
                      disableAllSectionVisuals();
                    }
                    window.dispatchEvent(
                      new CustomEvent('indivisible:toggle-section-visual', {
                        detail: { all: nextVal },
                      })
                    );
                  }}
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
              {sections.map((sec) => {
                const isSecActive = activeIndices.has(sec.index);
                return (
                  <div
                    key={sec.index}
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
                      aria-label={`Toggle visual editing for ${sec.label || `Section ${sec.index + 1}`}`}
                      onClick={() => {
                        const nextVal = !isSecActive;
                        setActiveIndices((prev) => {
                          const next = new Set(prev);
                          if (nextVal) next.add(sec.index);
                          else next.delete(sec.index);
                          setSectionVisualEnabled(sec.index, nextVal);
                          return next;
                        });
                        window.dispatchEvent(
                          new CustomEvent('indivisible:toggle-section-visual', {
                            detail: { index: sec.index, enabled: nextVal },
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
                      onClick={() => {
                        setIsMenuOpen(false);
                        window.dispatchEvent(
                          new CustomEvent('indivisible:focus-section', {
                            detail: { index: sec.index, openEdit: false },
                          })
                        );
                      }}
                      className="flex-1 text-left min-w-0"
                      title={`Jump to ${sec.label}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 size-4 rounded-full bg-white/10 text-[10px] font-bold text-slate-300 flex items-center justify-center">
                          {sec.index + 1}
                        </span>
                        <span className="text-xs font-semibold text-white truncate max-w-[130px]">
                          {sec.label || `Section ${sec.index + 1}`}
                        </span>
                      </div>
                    </button>

                    {/* Section Controls */}
                    <div className="flex items-center gap-1">
                      {/* Edit button — dispatches focus-section with openEdit: true */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          window.dispatchEvent(
                            new CustomEvent('indivisible:focus-section', {
                              detail: { index: sec.index, openEdit: true },
                            })
                          );
                        }}
                        className="shrink-0 rounded-lg bg-accent-gold/20 p-1.5 text-accent-gold hover:bg-accent-gold/30 transition-colors"
                        title="Edit section"
                      >
                        <PenLine size={12} className="text-accent-gold" />
                      </button>

                      {/* Duplicate Section */}
                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent('indivisible:duplicate-section', {
                              detail: { index: sec.index },
                            })
                          );
                        }}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                        title="Duplicate section"
                      >
                        <Copy size={12} />
                      </button>

                      {/* Move Up */}
                      <button
                        type="button"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent('indivisible:move-section', {
                              detail: { index: sec.index, direction: 'up' },
                            })
                          )
                        }
                        disabled={sec.index === 0}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
                        title="Move section up"
                      >
                        <ArrowUp size={12} />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent('indivisible:move-section', {
                              detail: { index: sec.index, direction: 'down' },
                            })
                          )
                        }
                        disabled={sec.index === sections.length - 1}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
                        title="Move section down"
                      >
                        <ArrowDown size={12} />
                      </button>

                      {/* Add Below */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          window.dispatchEvent(
                            new CustomEvent('indivisible:add-block-at', {
                              detail: { insertAfterIndex: sec.index },
                            })
                          );
                        }}
                        className="shrink-0 rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                        title="Add block below section"
                      >
                        <Plus size={12} />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent('indivisible:delete-section', {
                              detail: { index: sec.index },
                            })
                          )
                        }
                        className="shrink-0 rounded-lg bg-accent-red/20 p-1.5 text-accent-red hover:bg-accent-red/30 transition-colors"
                        title="Delete section"
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
              No addressable sections found in live document.
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
 * Provides full mobile parity: toggle switch plus interactive section jump and activation list.
 */
export function EditorialDrawerRow({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { loading, isAdmin } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');
  const [sections, setSections] = useState<PageSection[]>([]);
  const [activeIndices, setActiveIndices] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSections([]);
      setActiveIndices(new Set());
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
      const discovered = collectPageSections(root);
      setSections(discovered);
      setActiveIndices(new Set(discovered.map((s) => s.index)));
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
            <span>
              Page Sections ({activeIndices.size}/{sections.length})
            </span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>

          {expanded && (
            <div className="space-y-1 pt-1 max-h-52 overflow-y-auto no-scrollbar">
              {sections.map((sec) => {
                const isSecActive = activeIndices.has(sec.index);
                return (
                  <div
                    key={sec.index}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/5 border border-white/5"
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSecActive}
                      onClick={() => {
                        const nextVal = !isSecActive;
                        setActiveIndices((prev) => {
                          const next = new Set(prev);
                          if (nextVal) next.add(sec.index);
                          else next.delete(sec.index);
                          setSectionVisualEnabled(sec.index, nextVal);
                          return next;
                        });
                        window.dispatchEvent(
                          new CustomEvent('indivisible:toggle-section-visual', {
                            detail: { index: sec.index, enabled: nextVal },
                          })
                        );
                      }}
                      className={`p-1 rounded ${
                        isSecActive ? 'text-accent-gold bg-accent-gold/20' : 'text-slate-400'
                      }`}
                      title="Toggle section visual"
                    >
                      {isSecActive ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate();
                        window.dispatchEvent(
                          new CustomEvent('indivisible:focus-section', {
                            detail: { index: sec.index, openEdit: false },
                          })
                        );
                      }}
                      className="flex-1 text-left text-xs text-white truncate"
                    >
                      {sec.label || `Section ${sec.index + 1}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate();
                        window.dispatchEvent(
                          new CustomEvent('indivisible:focus-section', {
                            detail: { index: sec.index, openEdit: true },
                          })
                        );
                      }}
                      className="p-1 rounded text-accent-gold bg-accent-gold/20"
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
