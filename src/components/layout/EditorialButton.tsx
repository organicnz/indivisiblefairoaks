'use client';

import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  History,
  PenLine,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { getPageCopyRegions } from '@/lib/copy-regions';
import {
  addBlockVisual,
  deleteSectionVisual,
  duplicateSectionVisual,
  focusSectionVisual,
  moveSectionVisual,
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

/**
 * The editorial control in the site header.
 *
 * One press turns visual editing on and off. That is the whole control.
 *
 * It used to be a two-part button — an icon plus a chevron opening a menu of
 * regions and per-section switches — and the split had a cost that was not
 * visible in review: two controls of two sizes for one intent, a 44px target
 * achieved by stacking 36px and 24px, and a menu that duplicated a list the
 * overlay already publishes. So the header control is now only the master
 * switch.
 *
 * Per-section visual editing is not lost, because it was never really here:
 * - **On the page** — each framed section carries its own action pill with
 *   frame / jump / edit / duplicate / move / add / delete
 *   (`SectionFrames` in `components/visual-edit/`).
 * - **In the drawer** — `EditorialDrawerRow` below keeps the full editorial
 *   card: regions, every per-section control, and the block shortcuts.
 *
 * One invariant still holds and is the reason this component stays small: it
 * **never derives a section list of its own**. The overlay publishes the real
 * list (`VISUAL_EDIT_EVENTS.sectionsPublished`) and the drawer renders that,
 * because a second list agreed only while nothing had been sanitized out of the
 * page — and then offered to edit an element that was a different section.
 */
export function EditorialButton() {
  const pathname = usePathname();
  const { loading, isAdmin } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');

  if (loading) {
    return (
      <span aria-hidden="true" className="hidden sm:inline-block size-11 rounded-xl bg-white/10" />
    );
  }

  if (!isAdmin) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      data-testid="editorial-edit-button"
      aria-label={enabled ? 'Disable editorial mode' : 'Enable editorial mode'}
      title={enabled ? 'Editorial mode is on' : 'Editorial mode'}
      className={`
        relative size-11 rounded-xl flex items-center justify-center
        border transition-all duration-300 ease-out
        ${FOCUS_RING}
        ${
          enabled
            ? 'bg-accent-gold/15 border-accent-gold/40 text-accent-gold ring-2 ring-accent-gold/30 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
            : 'bg-white/8 border-white/15 text-slate-300 hover:text-white hover:bg-white/15'
        }
      `}
    >
      <PenLine size={18} aria-hidden="true" />
      {enabled && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 size-2 rounded-full bg-accent-gold animate-pulse"
        />
      )}
    </button>
  );
}

/**
 * Editorial drawer section for mobile and small-screen layouts.
 *
 * Full parity with the header button — the mode switch, the region list, every
 * per-section control (frame, jump, edit, duplicate, move, delete) and the
 * block shortcuts. A drawer entry that offered less than the header would be a
 * second, weaker editor on the small screens that need one most.
 *
 * The lists are the header's lists, read from the same hooks; nothing here
 * re-derives a section or a region, so the two surfaces cannot disagree about
 * which document they are on.
 */
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
    <div className="rounded-xl border border-accent-gold/30 bg-accent/15 p-2 space-y-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        data-testid="editorial-visual-edit-row"
        aria-label={enabled ? 'Visual editing is on — click to turn off' : 'Turn on visual editing'}
        className={`
          relative flex w-full items-center gap-3 rounded-xl px-3 py-3
          transition-all duration-300 ease-out
          ${FOCUS_RING}
          ${
            enabled
              ? 'text-accent-gold bg-accent-gold/10 hover:bg-accent-gold/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
              : 'text-ink-on-dark hover:text-white hover:bg-white/10'
          }
        `}
      >
        <PenLine size={20} aria-hidden="true" />
        <span className="flex-1 text-left font-semibold text-sm">Visual editing</span>
        {enabled && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 size-2 rounded-full bg-accent-gold animate-pulse"
          />
        )}
      </button>

      {enabled && regions.length > 0 && (
        <div className="border-t border-accent-gold/20 pt-2 space-y-1">
          <p className="px-2 text-[10px] font-black uppercase tracking-widest text-ink-muted-on-dark">
            Editable region
          </p>
          <div className="flex flex-wrap gap-1 px-1">
            <button
              type="button"
              onClick={() => selectRegion(null)}
              className={`
                rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wider
                transition-colors
                ${
                  activeRegionId === null
                    ? 'bg-accent-gold/20 text-accent-gold'
                    : 'text-ink-muted-on-dark hover:text-white'
                }
              `}
            >
              Whole page
            </button>
            {regions.map((region) => (
              <button
                key={region.id}
                type="button"
                onClick={() => selectRegion(region.id)}
                className={`
                  rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wider
                  transition-colors
                  ${
                    region.id === activeRegionId
                      ? 'bg-accent-gold/20 text-accent-gold'
                      : 'text-ink-muted-on-dark hover:text-white'
                  }
                `}
              >
                {region.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {enabled && (
        <div className="border-t border-accent-gold/20 pt-2 space-y-1">
          <div className="flex items-center justify-between px-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-ink-muted-on-dark">
              Sections {sections.length > 0 ? `(${framedCount}/${sections.length})` : ''}
            </p>
            {sections.length > 0 && (
              <button
                type="button"
                onClick={() => toggleSectionVisual({ all: framedCount !== sections.length })}
                className="text-[10px] font-bold uppercase tracking-wider text-accent-gold hover:text-white"
              >
                {framedCount === sections.length ? 'Mute all' : 'Frame all'}
              </button>
            )}
          </div>

          {sections.length === 0 ? (
            <p className="px-2 py-2 text-xs text-ink-muted-on-dark">
              No editable sections in this document yet.
            </p>
          ) : (
            <div className="space-y-1 pt-1 max-h-52 overflow-y-auto no-scrollbar">
              {sections.map((section, position) => {
                const unaddressed = section.blockIndex === null;
                const label = section.label || `Section ${position + 1}`;
                const unaddressedTitle = 'Waiting for the editor to describe this page';
                return (
                  <div
                    key={`${section.blockIndex ?? 'd'}:${section.index ?? position}`}
                    className={`
                      flex items-center gap-1 rounded-lg border p-1.5 transition-colors
                      ${
                        section.enabled
                          ? 'border-accent-gold/30 bg-accent-gold/10'
                          : 'border-white/5 bg-white/5'
                      }
                    `}
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
                      className={`p-1 rounded disabled:opacity-40 ${
                        section.enabled ? 'text-accent-gold bg-accent-gold/20' : 'text-slate-400'
                      }`}
                    >
                      {section.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
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
                      className="flex-1 text-left text-xs text-white truncate disabled:opacity-50"
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
                        className="p-1 rounded bg-accent-gold/20 text-accent-gold disabled:opacity-40"
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
                        className="p-1 rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
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
                        className="p-1 rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
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
                        className="p-1 rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
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
                        className="p-1 rounded text-slate-400 hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-30"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-accent-gold/20 pt-1">
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
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10"
            >
              <Plus size={13} aria-hidden="true" />
              Add block
              {activeRegionId && <span className="text-[10px] text-emerald-400/70">to region</span>}
            </button>
            <button
              type="button"
              onClick={() => {
                openMediaLibraryVisual();
                onNavigate();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-accent-gold hover:bg-accent-gold/10"
            >
              <FolderOpen size={13} aria-hidden="true" />
              Supabase media library
            </button>
            <button
              type="button"
              onClick={() => {
                openRevisionsVisual();
                onNavigate();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-ink-muted-on-dark hover:bg-white/10 hover:text-white"
            >
              <History size={13} aria-hidden="true" />
              Revisions
            </button>
            <button
              type="button"
              onClick={() => {
                openSettingsVisual();
                onNavigate();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-ink-muted-on-dark hover:bg-white/10 hover:text-white"
            >
              <Settings size={13} aria-hidden="true" />
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
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/10"
            >
              <X size={13} aria-hidden="true" />
              Turn off visual editing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
