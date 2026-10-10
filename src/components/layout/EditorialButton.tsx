'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  History,
  LayoutTemplate,
  PenLine,
  Plus,
  Settings,
  X,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPageCopyRegions } from '@/lib/copy-regions';
import {
  discoverPageSections,
  isPublishedSectionListCurrent,
  type PublishedSection,
} from '@/lib/visual-sections';
import type { VisualSectionsPublishedDetail } from '@/types/visual-edit';
import { useEditContext } from './useEditContext';
import { useVisualEditMode } from './visual-edit-store';

/**
 * The editorial control in the site header and the navigation drawer.
 *
 * One press turns visual editing on; the menu then lists what can be edited on
 * this page — its **copy regions** and, within the active one, each **section**
 * with its own frame switch. An admin therefore turns the frame on for the part
 * of the page they are working on rather than for every heading at once, which
 * is the whole difference between a frame that helps and a page that looks
 * broken.
 *
 * Three invariants hold this together, and each one is here because its absence
 * already shipped once:
 *
 * 1. **The section list is published by the overlay, not derived here.** This
 *    component used to run its own DOM discovery and its own enablement set,
 *    which produced a second list that agreed only while nothing had been
 *    sanitized out of the page — so it offered to edit an element that was a
 *    different section, and the write went to the wrong block.
 * 2. **Region switching is an event, not local state.** The overlay owns the
 *    document; a region selected here and not there is a switch that moves and
 *    changes nothing.
 * 3. **Radix, not a hand-rolled `role="dialog"`.** The menu is keyboard
 *    navigable by construction (Escape, arrows, focus return) instead of by
 *    every call site remembering to be. It is the same primitive
 *    `AccountButton` already uses.
 */

const REGION_SELECT_EVENT = 'indivisible:select-region';
const SECTION_TOGGLE_EVENT = 'indivisible:toggle-section-visual';
const SECTION_FOCUS_EVENT = 'indivisible:focus-section';
const SECTION_MOVE_EVENT = 'indivisible:move-section';
const SECTION_DUPLICATE_EVENT = 'indivisible:duplicate-section';
const ADD_BLOCK_EVENT = 'indivisible:add-block';
const ADD_BLOCK_AT_EVENT = 'indivisible:add-block-at';
const MEDIA_LIBRARY_EVENT = 'indivisible:open-media-library';
const REVISIONS_EVENT = 'indivisible:open-revisions';
const SETTINGS_EVENT = 'indivisible:open-settings';
const SECTIONS_PUBLISHED_EVENT = 'indivisible:page-sections-updated';

/** Ask the overlay which document to load. No payload means "the whole page". */
export function selectCopyRegion(regionId: string | null): void {
  window.dispatchEvent(
    new CustomEvent(REGION_SELECT_EVENT, { detail: { regionId, at: Date.now() } })
  );
}

export function EditorialButton() {
  const pathname = usePathname();
  const { loading, isAdmin, target } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');
  const [open, setOpen] = useState(false);

  const regions = getPageCopyRegions(pathname ?? '/');
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [sections, setSections] = useState<PublishedSection[]>([]);

  /**
   * The overlay's own list, adopted per pathname and per region.
   *
   * A stale publication from the previous page — or the previous region — would
   * list sections that are not here, so both the pathname and the region are
   * part of the comparison. A section list that outlives its document is a list
   * of controls that address nothing.
   */
  useEffect(() => {
    if (!enabled) {
      setSections([]);
      setActiveRegionId(null);
      return;
    }

    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<VisualSectionsPublishedDetail>).detail;
      if (!detail || !Array.isArray(detail.sections)) {
        setSections(discoverPageSections(document.querySelector('main')));
        return;
      }
      // One place decides whether a publication is still about the document this
      // menu is on — page *and* region. Two copies of that comparison is how the
      // header ends up listing a region it has already left.
      if (!isPublishedSectionListCurrent(detail, pathname ?? '/', activeRegionId)) return;
      setSections(detail.sections);
    };

    window.addEventListener(SECTIONS_PUBLISHED_EVENT, handleUpdate);
    handleUpdate(new CustomEvent(SECTIONS_PUBLISHED_EVENT));
    return () => {
      window.removeEventListener(SECTIONS_PUBLISHED_EVENT, handleUpdate);
    };
  }, [activeRegionId, enabled, pathname]);

  if (loading) {
    return (
      <span aria-hidden="true" className="hidden sm:inline-block size-11 rounded-lg bg-white/10" />
    );
  }

  if (!isAdmin) return null;

  const framedCount = sections.filter((section) => section.enabled).length;
  const allFramed = sections.length > 0 && framedCount === sections.length;

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        {/*
          Two controls inside one pill, deliberately: the main button is the
          fast path (one press turns editing on or off — the action that happens
          hundreds of times more often than opening the menu), and the chevron
          opens the menu where regions and sections live. Collapsing them into
          one control would make the common action take two clicks.
        */}
        <span className="inline-flex items-center">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={enabled}
            data-testid="editorial-edit-button"
            aria-label={
              enabled ? 'Visual editing is on — click to turn off' : 'Turn on visual editing'
            }
            title={enabled ? 'Visual editing is on' : 'Turn on visual editing'}
            className={`inline-flex items-center gap-2 rounded-l-xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold ${
              enabled ? 'text-accent-gold' : 'text-ink-on-dark hover:text-white'
            } ${open ? 'rounded-bl-none' : ''}`}
          >
            <PenLine size={16} aria-hidden="true" />
            <span className="hidden xl:inline">{enabled ? 'Editing' : 'Edit Page'}</span>
            {enabled && (
              <>
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-accent-gold animate-pulse"
                />
                {sections.length > 0 && (
                  <span
                    aria-hidden="true"
                    className="hidden xl:inline-flex items-center justify-center rounded-full bg-accent-gold/30 px-1.5 py-0.5 text-[10px] font-black text-accent-gold min-w-[18px]"
                  >
                    {framedCount}/{sections.length}
                  </span>
                )}
              </>
            )}
          </button>
          <button
            type="button"
            aria-label="Toggle section editor menu"
            title="Browse and configure sections"
            aria-expanded={open}
            data-state={open ? 'open' : 'closed'}
            onClick={(event) => {
              // The trigger's own pointerdown opens the menu; this is the
              // keyboard/AT path to the same state, and the one an automated
              // test drives.
              event.stopPropagation();
              setOpen((prev) => !prev);
            }}
            className={`inline-flex items-center rounded-r-xl px-2 py-2 text-accent-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold ${
              enabled
                ? 'hover:bg-accent-gold/20'
                : 'text-ink-muted-on-dark hover:bg-white/10 hover:text-white'
            } ${open ? 'rounded-br-none' : ''}`}
          >
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          </button>
        </span>
      </DropdownMenu.Trigger>

      {/*
        Deliberately not portalled. `AccountButton` renders its menu inline in
        the header too, and this control sits in the same place with the same
        `z-[110]` layer: the header's own `z-50` is the stacking context, so a
        portal would not raise the menu above the drawer — it would only move the
        DOM out from under the trigger that owns it.
      */}
      <DropdownMenu.Content
        align="end"
        sideOffset={8}
        aria-label="Page Sections Menu"
        className="absolute right-0 top-full z-[110] mt-2 max-h-[70vh] w-88 overflow-y-auto rounded-2xl border border-accent-gold/40 bg-secondary/95 p-2 text-ink-on-dark shadow-float backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        {/* ── Master switch ───────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => {
            if (enabled) selectCopyRegion(null);
            toggle();
          }}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
            enabled
              ? 'bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30'
              : 'text-ink-on-dark hover:bg-white/10 hover:text-white'
          }`}
        >
          <PenLine size={14} aria-hidden="true" />
          <span className="flex-1 text-left">
            {enabled ? 'Visual editing on' : 'Turn on visual editing'}
          </span>
          <span
            aria-hidden="true"
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
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

        {enabled && (
          <>
            {/* ── Regions ────────────────────────────────────────────── */}
            {regions.length > 0 && (
              <div className="mt-2 border-t border-white/10 pt-2">
                <p className="px-2 pb-1.5 text-[10px] font-black uppercase tracking-widest text-ink-muted-on-dark">
                  Editable region
                </p>
                <button
                  type="button"
                  onClick={() => selectCopyRegion(null)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    activeRegionId === null
                      ? 'bg-accent-gold/20 text-accent-gold'
                      : 'text-ink-on-dark hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <LayoutTemplate size={13} aria-hidden="true" />
                  <span className="flex-1 text-left">Whole page</span>
                  {activeRegionId === null && sections.length > 0 && (
                    <span className="text-[10px] font-bold text-accent-gold">
                      {framedCount}/{sections.length}
                    </span>
                  )}
                </button>
                {regions.map((region) => (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => selectCopyRegion(region.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      region.id === activeRegionId
                        ? 'bg-accent-gold/20 text-accent-gold'
                        : 'text-ink-on-dark hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <LayoutTemplate size={13} aria-hidden="true" />
                    <span className="flex-1 text-left">{region.label}</span>
                    {region.id === activeRegionId && sections.length > 0 && (
                      <span className="text-[10px] font-bold text-accent-gold">
                        {framedCount}/{sections.length}
                      </span>
                    )}
                  </button>
                ))}
                {target && (
                  <p className="mt-1 px-2 text-[11px] text-ink-muted-on-dark">
                    Editing: <strong className="text-white">{target.label}</strong>
                  </p>
                )}
              </div>
            )}

            {/* ── Sections ───────────────────────────────────────────── */}
            <div className="mt-2 border-t border-white/10 pt-2">
              <div className="flex items-center justify-between px-2 pb-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-ink-muted-on-dark">
                  Sections {sections.length > 0 ? `(${framedCount}/${sections.length})` : ''}
                </p>
                {sections.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent(SECTION_TOGGLE_EVENT, { detail: { all: !allFramed } })
                      )
                    }
                    className="text-[10px] font-bold uppercase tracking-wider text-accent-gold hover:text-white"
                  >
                    {allFramed ? 'Mute all' : 'Frame all'}
                  </button>
                )}
              </div>

              {sections.length > 0 ? (
                <div className="max-h-72 space-y-1 overflow-y-auto pr-0.5">
                  {sections.map((section, position) => {
                    const unaddressed = section.blockIndex === null;
                    const label = section.label || `Section ${position + 1}`;
                    // Every control here addresses a block. A section the
                    // overlay has not described cannot be addressed, so each
                    // one is inert *and* says why — a disabled control with no
                    // explanation is a control that looks broken.
                    const unaddressedTitle = 'Waiting for the editor to describe this page';
                    return (
                      <div
                        key={`${section.blockIndex ?? 'd'}:${section.index ?? position}`}
                        className={`flex items-center gap-1 rounded-xl border p-1.5 transition-colors ${
                          section.enabled
                            ? 'border-accent-gold/30 bg-accent-gold/10'
                            : 'border-transparent bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <button
                          type="button"
                          role="switch"
                          aria-checked={section.enabled}
                          disabled={unaddressed}
                          aria-label={`Toggle visual editing for ${label}`}
                          title={
                            unaddressed ? 'Waiting for the editor to describe this page' : undefined
                          }
                          onClick={() => {
                            if (section.blockIndex === null) return;
                            window.dispatchEvent(
                              new CustomEvent(SECTION_TOGGLE_EVENT, {
                                detail: {
                                  blockIndex: section.blockIndex,
                                  enabled: !section.enabled,
                                },
                              })
                            );
                          }}
                          className={`shrink-0 rounded-lg p-1.5 transition-colors disabled:opacity-40 ${
                            section.enabled
                              ? 'bg-accent-gold/30 text-accent-gold'
                              : 'bg-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {section.enabled ? (
                            <Eye size={13} aria-hidden="true" />
                          ) : (
                            <EyeOff size={13} aria-hidden="true" />
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={unaddressed}
                          title={unaddressed ? unaddressedTitle : `Jump to ${label}`}
                          onClick={() => {
                            if (section.blockIndex === null) return;
                            window.dispatchEvent(
                              new CustomEvent(SECTION_FOCUS_EVENT, {
                                detail: { blockIndex: section.blockIndex, openEdit: false },
                              })
                            );
                          }}
                          className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {label}
                        </button>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            disabled={unaddressed}
                            aria-label={`Edit ${label}`}
                            onClick={() => {
                              if (section.blockIndex === null) return;
                              window.dispatchEvent(
                                new CustomEvent(SECTION_FOCUS_EVENT, {
                                  detail: { blockIndex: section.blockIndex, openEdit: true },
                                })
                              );
                            }}
                            className="rounded-lg bg-accent-gold/20 p-1.5 text-accent-gold hover:bg-accent-gold/30 disabled:opacity-40"
                          >
                            <PenLine size={12} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={unaddressed}
                            aria-label={`Duplicate ${label}`}
                            title="Duplicate section"
                            onClick={() => {
                              if (section.blockIndex === null) return;
                              window.dispatchEvent(
                                new CustomEvent(SECTION_DUPLICATE_EVENT, {
                                  detail: { blockIndex: section.blockIndex },
                                })
                              );
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
                          >
                            <Copy size={12} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={unaddressed || position === 0}
                            aria-label={`Move ${label} up`}
                            onClick={() => {
                              if (section.blockIndex === null) return;
                              window.dispatchEvent(
                                new CustomEvent(SECTION_MOVE_EVENT, {
                                  detail: { blockIndex: section.blockIndex, direction: 'up' },
                                })
                              );
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                          >
                            <ArrowUp size={12} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={unaddressed || position === sections.length - 1}
                            aria-label={`Move ${label} down`}
                            onClick={() => {
                              if (section.blockIndex === null) return;
                              window.dispatchEvent(
                                new CustomEvent(SECTION_MOVE_EVENT, {
                                  detail: { blockIndex: section.blockIndex, direction: 'down' },
                                })
                              );
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                          >
                            <ArrowDown size={12} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="px-2 py-3 text-xs text-ink-muted-on-dark">
                  No editable sections in this document yet.
                </p>
              )}
            </div>

            {/* ── Shortcuts ──────────────────────────────────────────── */}
            <div className="mt-2 border-t border-white/10 pt-2">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    activeRegionId
                      ? new CustomEvent(ADD_BLOCK_AT_EVENT, { detail: { type: 'paragraph' } })
                      : new CustomEvent(ADD_BLOCK_EVENT)
                  );
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10"
              >
                <Plus size={13} aria-hidden="true" />
                Add block
                {activeRegionId && (
                  <span className="text-[10px] text-emerald-400/70">to region</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(MEDIA_LIBRARY_EVENT))}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-accent-gold hover:bg-accent-gold/10"
              >
                <FolderOpen size={13} aria-hidden="true" />
                Supabase media library
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(REVISIONS_EVENT))}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-ink-muted-on-dark hover:bg-white/10 hover:text-white"
              >
                <History size={13} aria-hidden="true" />
                Revisions
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(SETTINGS_EVENT))}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-ink-muted-on-dark hover:bg-white/10 hover:text-white"
              >
                <Settings size={13} aria-hidden="true" />
                Document settings
              </button>
              <button
                type="button"
                onClick={() => {
                  selectCopyRegion(null);
                  toggle();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/10"
              >
                <X size={13} aria-hidden="true" />
                Turn off visual editing
              </button>
            </div>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

/**
 * Editorial drawer section for mobile and small-screen layouts.
 *
 * Full parity with the header button: the mode switch, the region list and the
 * same published section list. A drawer entry that offered less than the header
 * would be a second, weaker editor on the small screens that need one most.
 */
export function EditorialDrawerRow({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { loading, isAdmin } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');
  const [sections, setSections] = useState<PublishedSection[]>([]);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const regions = getPageCopyRegions(pathname ?? '/');

  useEffect(() => {
    if (!enabled) {
      setSections([]);
      setActiveRegionId(null);
      return;
    }
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<VisualSectionsPublishedDetail>).detail;
      if (!detail || !Array.isArray(detail.sections)) {
        setSections(discoverPageSections(document.querySelector('main')));
        return;
      }
      // One place decides whether a publication is still about the document this
      // menu is on — page *and* region. Two copies of that comparison is how the
      // header ends up listing a region it has already left.
      if (!isPublishedSectionListCurrent(detail, pathname ?? '/', activeRegionId)) return;
      setSections(detail.sections);
    };
    window.addEventListener(SECTIONS_PUBLISHED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(SECTIONS_PUBLISHED_EVENT, handleUpdate);
    };
  }, [activeRegionId, enabled, pathname]);

  if (loading || !isAdmin) return null;

  return (
    <div className="rounded-xl border border-accent-gold/30 bg-accent/15 p-2 space-y-2">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        data-testid="editorial-visual-edit-row"
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-accent-gold transition-colors duration-300 ease-out hover:bg-accent/25 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
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

      {enabled && regions.length > 0 && (
        <div className="border-t border-accent-gold/20 pt-2 space-y-1">
          <p className="px-2 text-[10px] font-black uppercase tracking-widest text-ink-muted-on-dark">
            Region
          </p>
          <div className="flex flex-wrap gap-1 px-1">
            <button
              type="button"
              onClick={() => {
                selectCopyRegion(null);
                onNavigate();
              }}
              className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                activeRegionId === null
                  ? 'bg-accent-gold/20 text-accent-gold'
                  : 'text-ink-muted-on-dark hover:text-white'
              }`}
            >
              Whole page
            </button>
            {regions.map((region) => (
              <button
                key={region.id}
                type="button"
                onClick={() => {
                  selectCopyRegion(region.id);
                  onNavigate();
                }}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  region.id === activeRegionId
                    ? 'bg-accent-gold/20 text-accent-gold'
                    : 'text-ink-muted-on-dark hover:text-white'
                }`}
              >
                {region.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {enabled && sections.length > 0 && (
        <div className="border-t border-accent-gold/20 pt-2 space-y-1">
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="flex w-full items-center justify-between px-2 py-1 text-xs font-bold uppercase tracking-wider text-accent-gold hover:text-white"
          >
            <span>
              Sections ({sections.filter((s) => s.enabled).length}/{sections.length})
            </span>
            <ChevronDown
              size={14}
              className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          </button>

          {expanded && (
            <div className="space-y-1 pt-1 max-h-52 overflow-y-auto no-scrollbar">
              {sections.map((section, position) => {
                const unaddressed = section.blockIndex === null;
                return (
                  <div
                    key={`${section.blockIndex ?? 'd'}:${section.index ?? position}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/5 p-1.5"
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={section.enabled}
                      disabled={unaddressed}
                      aria-label={`Toggle visual editing for ${
                        section.label || `Section ${position + 1}`
                      }`}
                      onClick={() => {
                        if (section.blockIndex === null) return;
                        window.dispatchEvent(
                          new CustomEvent(SECTION_TOGGLE_EVENT, {
                            detail: { blockIndex: section.blockIndex, enabled: !section.enabled },
                          })
                        );
                      }}
                      className={`p-1 rounded disabled:opacity-40 ${
                        section.enabled ? 'text-accent-gold bg-accent-gold/20' : 'text-slate-400'
                      }`}
                    >
                      {section.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button
                      type="button"
                      disabled={unaddressed}
                      onClick={() => {
                        if (section.blockIndex === null) return;
                        onNavigate();
                        window.dispatchEvent(
                          new CustomEvent(SECTION_FOCUS_EVENT, {
                            detail: { blockIndex: section.blockIndex, openEdit: false },
                          })
                        );
                      }}
                      className="flex-1 text-left text-xs text-white truncate disabled:opacity-50"
                    >
                      {section.label || `Section ${position + 1}`}
                    </button>
                    <button
                      type="button"
                      disabled={unaddressed}
                      aria-label={`Edit ${section.label || `Section ${position + 1}`}`}
                      onClick={() => {
                        if (section.blockIndex === null) return;
                        onNavigate();
                        window.dispatchEvent(
                          new CustomEvent(SECTION_FOCUS_EVENT, {
                            detail: { blockIndex: section.blockIndex, openEdit: true },
                          })
                        );
                      }}
                      className="p-1 rounded bg-accent-gold/20 text-accent-gold disabled:opacity-40"
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
