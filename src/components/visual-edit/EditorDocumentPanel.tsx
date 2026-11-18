'use client';

import { Loader2, Redo2, Sparkles, Undo2 } from 'lucide-react';
import { canRedo, canUndo } from '@/lib/editor-history';
import type { VisualEditorSidebarProps } from './VisualEditorSidebar';

export function EditorDocumentPanel({ props }: { props: VisualEditorSidebarProps }) {
  const {
    contentRow,
    documentLoadState = 'idle',
    dirty,
    savingBackend,
    sections,
    enabledSectionKeys,
    pageRegions,
    unsaveableReason = null,
    activeRegionId,
    activeRegionLabel,
    history,
  } = props;
  const documentReady = documentLoadState === 'ready';
  const documentOpening = documentLoadState === 'idle' || documentLoadState === 'loading';
  const regionSwitchBlockedReason = documentOpening
    ? 'Wait for the saved document to open before switching regions'
    : documentLoadState === 'degraded'
      ? 'Reload the saved document before switching regions'
      : null;

  return (
    <>
    {/* ── Document info & status ─────────────────────────────────────── */}
    <div className="flex items-center gap-2">
      {contentRow ? (
        <button
          type="button"
          onClick={props.onTogglePageStatus}
          disabled={savingBackend || !documentReady}
          title={
            !documentReady
              ? documentLoadState === 'degraded'
                ? 'Reload the saved document before changing publication status'
                : 'Wait for the saved document to open before changing publication status'
              : 'Click to toggle between Published and Draft'
          }
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
            contentRow.status === 'publish'
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
          }`}
        >
          {contentRow.status === 'publish' ? 'Published' : 'Draft'}
        </button>
      ) : (
        <button
          type="button"
          onClick={props.onInitializeCMSPage}
          disabled={
            savingBackend ||
            !documentReady ||
            Boolean(unsaveableReason) ||
            props.isVisualComposerOpen ||
            Boolean(props.inlineSession) ||
            Boolean(props.imageSession)
          }
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-accent/20 text-accent-gold hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-40"
          title={
            !documentReady
              ? documentLoadState === 'degraded'
                ? 'Reload the saved document before connecting this page'
                : 'Wait for the saved document to open before connecting this page'
              : props.inlineSession
                ? 'Save or cancel the inline text edit before connecting this page'
                : props.imageSession
                  ? 'Save or cancel the image edit before connecting this page'
                  : props.isVisualComposerOpen
                    ? 'Close the composer before connecting this page'
                    : unsaveableReason ??
                  (activeRegionId
                    ? `Create the CMS row for the ${activeRegionLabel} region`
                    : 'Click to sync page into Supabase content table')
          }
        >
          Connect to Supabase
        </button>
      )}
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
          documentOpening
            ? 'bg-white/10 text-ink-muted-on-dark'
            : documentLoadState === 'degraded'
              ? 'bg-rose-500/20 text-rose-300'
              : savingBackend
                ? 'bg-sky-500/20 text-sky-300'
                : dirty || unsaveableReason || !contentRow
                  ? 'bg-amber-500/20 text-accent-gold'
                  : 'bg-emerald-500/20 text-emerald-400'
        }`}
      >
        {documentOpening
          ? 'Opening'
          : documentLoadState === 'degraded'
            ? 'Unavailable'
            : savingBackend
              ? 'Saving'
              : dirty
                ? 'Unsaved'
                : unsaveableReason
                  ? 'Region only'
                  : !contentRow
                    ? 'Not connected'
                    : 'Saved'}
      </span>
    </div>

    <p className="text-[11px] text-ink-muted-on-dark">
      {documentOpening ? (
        <span>Opening the saved document…</span>
      ) : documentLoadState === 'degraded' ? (
        <span className="font-bold text-rose-300">Saved document unavailable</span>
      ) : (
        <>
          {sections.length} {sections.length === 1 ? 'block' : 'blocks'} in the document (
          {dirty ? (
            <span className="font-bold text-accent-gold">unsaved changes</span>
          ) : unsaveableReason ? (
            <span className="text-accent-gold">page-level copy is not savable</span>
          ) : contentRow ? (
            <span>saved</span>
          ) : (
            <span className="text-accent-gold">not connected to Supabase</span>
          )}
          ) · {enabledSectionKeys.size} framed
        </>
      )}
    </p>

    {/* ── Copy region selector ───────────────────────────────────────── */}
    {unsaveableReason &&
      documentLoadState !== 'loading' &&
      documentLoadState !== 'degraded' && (
      <div
        data-testid="page-level-save-blocked"
        className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] leading-snug text-accent-gold"
      >
        <p>{unsaveableReason}</p>
        <button
          type="button"
          onClick={props.onOpenDataPointDrawer}
          className="mt-1.5 font-bold underline underline-offset-2 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent-gold/70"
        >
          Open DataPoints Matrix (⌘⇧D)
        </button>
      </div>
    )}

    {pageRegions.length > 0 && (
      <fieldset className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
        <legend className="sr-only">Editable copy region</legend>
        <button
          type="button"
          onClick={() => props.onSetRegion(null)}
          disabled={!documentReady || Boolean(unsaveableReason)}
          title={
            !documentReady
              ? regionSwitchBlockedReason ?? 'Wait for the saved document to open'
              : unsaveableReason ?? 'Edit the whole-page document'
          }
          aria-pressed={activeRegionId === null}
          className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
            activeRegionId === null
              ? 'bg-accent-gold/20 text-accent-gold'
              : 'text-ink-muted-on-dark hover:text-white'
          }`}
        >
          Whole page
        </button>
        {pageRegions.map((region) => (
          <button
            key={region.id}
            type="button"
            onClick={() => props.onSetRegion(region.id)}
            disabled={Boolean(regionSwitchBlockedReason)}
            title={
              regionSwitchBlockedReason ?? `Edit the ${region.label} copy region`
            }
            aria-pressed={region.id === activeRegionId}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              region.id === activeRegionId
                ? 'bg-accent-gold/20 text-accent-gold'
                : 'text-ink-muted-on-dark hover:text-white'
            }`}
          >
            {region.label}
          </button>
        ))}
      </fieldset>
    )}

    {/* ── Primary actions ────────────────────────────────────────────── */}
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={props.onUndo}
        disabled={!canUndo(history) || documentLoadState !== 'ready'}
        title={
          documentLoadState === 'loading'
            ? 'Wait for the saved document to open before undoing'
            : documentLoadState === 'degraded'
              ? 'Reload the saved document before undoing'
              : 'Undo the last change (⌘Z)'
        }
        aria-label="Undo the last change"
        className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${
          canUndo(history) && documentLoadState === 'ready'
            ? 'border-white/15 bg-white/10 text-ink-on-dark hover:bg-white/15'
            : 'border-white/10 bg-white/5 text-ink-muted-on-dark'
        }`}
      >
        <Undo2 size={13} />
        <span>Undo</span>
      </button>
      <button
        type="button"
        onClick={props.onRedo}
        disabled={!canRedo(history) || documentLoadState !== 'ready'}
        title={
          documentLoadState === 'loading'
            ? 'Wait for the saved document to open before redoing'
            : documentLoadState === 'degraded'
              ? 'Reload the saved document before redoing'
              : 'Redo (⌘⇧Z)'
        }
        aria-label="Redo the last undone change"
        className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${
          canRedo(history) && documentLoadState === 'ready'
            ? 'border-white/15 bg-white/10 text-ink-on-dark hover:bg-white/15'
            : 'border-white/10 bg-white/5 text-ink-muted-on-dark'
        }`}
      >
        <Redo2 size={13} />
        <span>Redo</span>
      </button>
    </div>

    <button
      type="button"
      onClick={props.onSave}
      disabled={
        savingBackend || !dirty || Boolean(unsaveableReason) || !documentReady
      }
      title={
        !documentReady
          ? documentLoadState === 'degraded'
            ? 'Reload the saved document before saving'
            : 'Wait for the saved document to open before saving'
          : unsaveableReason ??
            (contentRow
              ? 'Write this document to Supabase'
              : 'Create the Supabase CMS row for this page from what is on screen')
      }
      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider shadow-raised transition-colors disabled:opacity-50 ${
        dirty
          ? 'bg-accent text-ink-strong hover:bg-accent-gold'
          : 'bg-white/10 text-ink-muted-on-dark'
      }`}
    >
      {savingBackend ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      <span>{contentRow ? (dirty ? 'Save' : 'Saved') : 'Connect'}</span>
      <kbd className="hidden sm:inline-block ml-0.5 text-[9px] font-mono opacity-70">⌘S</kbd>
    </button>

    </>
  );
}
