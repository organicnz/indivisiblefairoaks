'use client';

import {
  Activity,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  FolderOpen,
  History,
  PenLine,
  Plus,
  Settings,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getPageCopyRegions } from '@/lib/copy-regions';
import {
  addBlockVisual,
  deleteSectionVisual,
  duplicateSectionVisual,
  focusSectionVisual,
  moveSectionVisual,
  openCRMVisual,
  openDiagnosticsVisual,
  openMediaLibraryVisual,
  openRevisionsVisual,
  openSettingsVisual,
  selectCopyRegion,
  toggleSectionVisual,
} from '@/lib/visual-edit-events';
import { useEditContext } from './useEditContext';
import { useActiveRegion, usePublishedSections } from './usePublishedSections';
import { useVisualEditMode } from './visual-edit-store';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary';

export function EditorialButton() {
  const pathname = usePathname();
  const { loading, isAdmin } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');

  // ⌘E / Ctrl-E toggles the mode from anywhere on the page. The overlay and the
  // drawer already own per-section controls; this is the one keyboard shortcut
  // that reaches them without hunting for a button, and it mirrors ⌘K (search)
  // and ⌘S (save) instead of inventing a new shape.
  //
  // Above the early returns on purpose: hooks must run in the same order on
  // every render, and a return for a non-admin must not unschedule them.
  // The guard inside preserves the old behaviour — only a resolved admin
  // subscribes — so a visitor never toggles a mode nothing renders.
  useEffect(() => {
    if (loading || !isAdmin) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'e') return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle, loading, isAdmin]);

  if (loading) {
    return (
      <span
        aria-hidden="true"
        className="inline-block size-11 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 animate-pulse"
      />
    );
  }

  if (!isAdmin) return null;

  return (
    <>
      {/* The mode change is a screen-reader event, not a toast: the button's
          aria-pressed already says "on", but nothing announces the transition,
          so a keyboard user who pressed ⌘E gets silence. */}
      <span role="status" aria-live="polite" className="sr-only">
        {enabled ? 'Editorial mode is now on' : 'Editorial mode is now off'}
      </span>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        data-testid="editorial-edit-button"
        aria-label={
          enabled ? 'Disable editorial mode' : 'Enable editorial mode — plan and edit sections (⌘E)'
        }
        title={enabled ? 'Editorial mode is on (⌘E)' : 'Plan and edit sections (⌘E)'}
        className={`
        group relative inline-flex items-center justify-center size-11 rounded-2xl
        border transition-all duration-300 ease-out shadow-sm
        ${FOCUS_RING}
        ${
          enabled
            ? 'bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-amber-600/20 border-amber-300/60 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_30px_rgba(245,158,11,0.35)] hover:-translate-y-0.5'
            : 'bg-gradient-to-br from-slate-800/80 to-slate-900/90 border-white/10 text-slate-200 hover:text-white hover:border-white/25 hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]'
        }
      `}
      >
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-xl transition-colors ${enabled ? 'bg-amber-400/20 text-amber-300' : 'bg-white/5 text-slate-300 group-hover:text-white group-hover:bg-white/10'}`}
        >
          <PenLine size={18} aria-hidden="true" strokeWidth={2.5} />
        </span>
        {enabled && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)] animate-pulse ring-2 ring-[#0f172a]"
          />
        )}
      </button>
    </>
  );
}

export function EditorialDrawerRow({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { loading, isAdmin } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');
  const regions = getPageCopyRegions(pathname ?? '/');
  const { activeRegionId, setActiveRegionId } = useActiveRegion(enabled);
  const { sections } = usePublishedSections({ enabled, pathname: pathname ?? '/', activeRegionId });

  if (loading || !isAdmin) return null;

  const framedCount = sections.filter((section) => section.enabled).length;

  const selectRegion = (regionId: string | null) => {
    setActiveRegionId(regionId);
    selectCopyRegion(regionId);
    onNavigate();
  };

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-gradient-to-b from-slate-800/60 to-slate-900/80 p-3 space-y-3 shadow-[0_10px_40px_-15px_rgba(245,158,11,0.15)]">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        data-testid="editorial-visual-edit-row"
        aria-label={
          enabled
            ? 'Visual editing is on — click to turn off'
            : 'Turn on visual editing to plan sections'
        }
        className={`
          relative flex w-full items-center gap-3 rounded-xl px-4 py-3.5
          transition-all duration-300 ease-out shadow-sm
          ${FOCUS_RING}
          ${
            enabled
              ? 'text-amber-200 bg-gradient-to-r from-amber-500/15 to-amber-400/10 hover:from-amber-500/25 hover:to-amber-400/15 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
              : 'text-slate-100 hover:text-white bg-gradient-to-r from-white/5 to-white/[0.03] hover:from-white/10 hover:to-white/[0.05]'
          }
        `}
      >
        <span
          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${enabled ? 'bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]' : 'bg-white/10 text-slate-300'}`}
        >
          <PenLine size={18} aria-hidden="true" strokeWidth={2} />
        </span>
        <div className="flex-1 text-left">
          <span className="block text-sm font-bold">Visual editing</span>
          <span className="block text-[10px] font-medium text-slate-400">
            Plan and edit sections on this page
          </span>
        </div>
        {enabled && (
          <span
            aria-hidden="true"
            className="absolute -top-2 -right-2 h-3.5 w-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-pulse ring-2 ring-[#0f172a]"
          />
        )}
      </button>

      {enabled && regions.length > 0 && (
        <div className="border-t border-amber-300/10 pt-3 space-y-2">
          <p className="px-1 text-[10px] font-black uppercase tracking-[0.15em] text-amber-300/80">
            Editable region
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectRegion(null)}
              className={`rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                activeRegionId === null
                  ? 'bg-amber-400/20 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              Whole page
            </button>
            {regions.map((region) => (
              <button
                key={region.id}
                type="button"
                onClick={() => selectRegion(region.id)}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  region.id === activeRegionId
                    ? 'bg-amber-400/20 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {region.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {enabled && (
        <div className="border-t border-amber-300/10 pt-3 space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-300/80">
              Sections {sections.length > 0 ? `(${framedCount}/${sections.length})` : ''}
            </p>
            {sections.length > 0 && (
              <button
                type="button"
                onClick={() => toggleSectionVisual({ all: framedCount !== sections.length })}
                className="text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:text-amber-200 transition-colors"
              >
                {framedCount === sections.length ? 'Mute all' : 'Frame all'}
              </button>
            )}
          </div>

          {sections.length === 0 ? (
            <p className="px-1 py-2 text-xs text-slate-400">
              No editable sections in this document yet.
            </p>
          ) : (
            <div className="space-y-1.5 pt-1 max-h-60 overflow-y-auto no-scrollbar">
              {sections.map((section, position) => {
                const unaddressed = section.blockIndex === null;
                const label = section.label || `Section ${position + 1}`;
                const unaddressedTitle = 'Waiting for the editor to describe this page';
                return (
                  <div
                    key={`${section.blockIndex ?? 'd'}:${section.index ?? position}`}
                    className={`flex items-center gap-2 rounded-xl border p-2 transition-all ${
                      section.enabled
                        ? 'border-amber-300/30 bg-gradient-to-r from-amber-400/10 to-amber-500/5 shadow-[0_0_10px_rgba(245,158,11,0.08)]'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={section.enabled}
                      disabled={unaddressed}
                      aria-label={`Toggle visual editing for ${label}`}
                      title={unaddressed ? unaddressedTitle : undefined}
                      onClick={() => {
                        if (section.blockIndex === null) return;
                        toggleSectionVisual({
                          blockIndex: section.blockIndex,
                          enabled: !section.enabled,
                        });
                        onNavigate();
                      }}
                      className={`p-1.5 rounded-xl transition-all ${
                        section.enabled
                          ? 'text-amber-300 bg-amber-400/20 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {section.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      type="button"
                      disabled={unaddressed}
                      title={unaddressed ? unaddressedTitle : `Jump to ${label}`}
                      onClick={() => {
                        if (section.blockIndex === null) return;
                        onNavigate();
                        focusSectionVisual({ blockIndex: section.blockIndex, openEdit: false });
                      }}
                      className="flex-1 text-left text-xs font-semibold text-white truncate disabled:opacity-40 hover:text-amber-200 transition-colors"
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
                          onNavigate();
                          focusSectionVisual({ blockIndex: section.blockIndex, openEdit: true });
                        }}
                        className="p-1.5 rounded-xl bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 disabled:opacity-40 transition-colors shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                      >
                        <PenLine size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={unaddressed}
                        aria-label={`Duplicate ${label}`}
                        title="Duplicate section"
                        onClick={() => {
                          if (section.blockIndex === null) return;
                          duplicateSectionVisual({ blockIndex: section.blockIndex });
                          onNavigate();
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40 transition-colors"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={unaddressed || position === 0}
                        aria-label={`Move ${label} up`}
                        onClick={() => {
                          if (section.blockIndex === null) return;
                          moveSectionVisual({ blockIndex: section.blockIndex, direction: 'up' });
                          onNavigate();
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={unaddressed || position === sections.length - 1}
                        aria-label={`Move ${label} down`}
                        onClick={() => {
                          if (section.blockIndex === null) return;
                          moveSectionVisual({ blockIndex: section.blockIndex, direction: 'down' });
                          onNavigate();
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={unaddressed}
                        aria-label={`Delete ${label}`}
                        title="Delete section"
                        onClick={() => {
                          if (section.blockIndex === null) return;
                          deleteSectionVisual({ blockIndex: section.blockIndex });
                          onNavigate();
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-amber-300/10 pt-2 space-y-2">
            <button
              type="button"
              onClick={() => {
                const last = sections[sections.length - 1];
                addBlockVisual(
                  activeRegionId && last?.blockIndex != null
                    ? { insertAfterBlockIndex: last.blockIndex, type: 'paragraph' }
                    : {}
                );
                onNavigate();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 transition-all bg-gradient-to-r from-emerald-500/5 to-transparent"
            >
              <Plus size={14} aria-hidden="true" />
              Add block
              {activeRegionId && <span className="text-[10px] text-emerald-300/70">to region</span>}
            </button>
            <button
              type="button"
              onClick={() => {
                openMediaLibraryVisual();
                onNavigate();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-amber-200 hover:text-amber-100 hover:bg-amber-400/10 transition-all bg-gradient-to-r from-amber-400/5 to-transparent"
            >
              <FolderOpen size={14} aria-hidden="true" />
              Supabase media library
            </button>
            <button
              type="button"
              onClick={() => {
                openCRMVisual();
                onNavigate();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 transition-all bg-gradient-to-r from-emerald-500/5 to-transparent"
            >
              <UsersRound size={14} aria-hidden="true" />
              Civic CRM & Content
            </button>
            <Link
              href="/admin/content/new?type=post"
              onClick={() => onNavigate()}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-sky-300 hover:text-sky-200 hover:bg-sky-500/10 transition-all bg-gradient-to-r from-sky-500/5 to-transparent"
            >
              <FilePlus2 size={14} aria-hidden="true" />
              Write new post
            </Link>
            <button
              type="button"
              onClick={() => {
                openDiagnosticsVisual();
                onNavigate();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-accent-gold hover:text-white hover:bg-amber-400/10 transition-all bg-gradient-to-r from-amber-400/5 to-transparent"
            >
              <Activity size={14} aria-hidden="true" />
              System diagnostics
            </button>
            <button
              type="button"
              onClick={() => {
                openRevisionsVisual();
                onNavigate();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all bg-gradient-to-r from-white/5 to-transparent"
            >
              <History size={14} aria-hidden="true" />
              Revisions
            </button>
            <button
              type="button"
              onClick={() => {
                openSettingsVisual();
                onNavigate();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all bg-gradient-to-r from-white/5 to-transparent"
            >
              <Settings size={14} aria-hidden="true" />
              Document settings
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRegionId(null);
                selectCopyRegion(null);
                toggle();
                onNavigate();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 transition-all bg-gradient-to-r from-rose-500/5 to-transparent"
            >
              <X size={14} aria-hidden="true" />
              Turn off visual editing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
