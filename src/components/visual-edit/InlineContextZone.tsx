'use client';

import {
  Check,
  Copy,
  Database,
  LayoutTemplate,
  PenLine,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { InlineFormatCommand } from './InlineFormatToolbar';
import { applyInlineFormatCommand, InlineFormatToolbar } from './InlineFormatToolbar';
import { CivicGhostwriter } from './CivicGhostwriter';
import type { VisualEditorSidebarProps } from './VisualEditorSidebar';
import type { InlineEditSession } from './VisualEditOverlay';

/**
 * Every command the inline-edit pill offers, in run order. This used to live in
 * the overlay; it moved here because the pill — the only consumer — moved into
 * the sidebar's inline context zone.
 */
const INLINE_FORMAT_COMMANDS: readonly InlineFormatCommand[] = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'code',
  'highlight',
  'bulletList',
  'orderedList',
  'link',
  'unlink',
  'clear',
  'editLink',
  'h2',
  'h3',
  'paragraph',
];

export type { DocumentLoadState } from './DocumentReadBanner';

export function InlineContextZone(props: VisualEditorSidebarProps & { inlineSession: InlineEditSession }) {
  const { inlineSession } = props;
  const composerIdx = inlineSession.blockIndex ?? props.activeBlockIndex ?? 0;
  const inlineWriteBlocked = props.documentLoadState !== 'ready';
  const inlineWriteBlockedReason =
    props.documentLoadState === 'loading' || props.documentLoadState === 'idle'
      ? 'Wait for the saved document to open before saving this text'
      : props.documentLoadState === 'degraded'
        ? 'Reload the saved document before saving this text'
        : 'Wait for the visual editor to finish opening before saving this text';

  /*
   * "Edit link" is only meaningful when the edited element is, or contains, an
   * anchor. "Remove link" stays available on any element: it acts on the
   * current selection, which may contain a link even when the element does not.
   */
  const activeAnchor =
    inlineSession.element.tagName === 'A'
      ? (inlineSession.element as HTMLAnchorElement)
      : inlineSession.element.querySelector('a');
  const formatCommands = activeAnchor
    ? INLINE_FORMAT_COMMANDS
    : INLINE_FORMAT_COMMANDS.filter((command) => command !== 'editLink');

  return (
    <div
      data-inline-toolbar="true"
      role="group"
      aria-label="Direct in-place text editor controls"
      className="flex flex-1 flex-col gap-2 overflow-y-auto border-t-2 border-accent-gold/40 px-3 py-4 text-xs text-white"
    >
      <div className="flex items-center justify-between border-b border-white/15 pb-2">
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-accent-gold">
          <PenLine size={12} />
          <span>Inline Edit</span>
        </span>
      </div>

      <button
        type="button"
        disabled={inlineWriteBlocked}
        onClick={() => void props.onCommitInlineEdit(inlineSession)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-accent-gold px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-ink-strong transition-colors hover:bg-amber-400 shadow-xs disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent-gold"
        title={inlineWriteBlocked ? inlineWriteBlockedReason : 'Save changes (⌘+Enter)'}
      >
        <Check size={13} className="stroke-[3]" />
        <span>Save</span>
        <kbd className="ml-1 text-[9px] font-mono opacity-60">⌘↵</kbd>
      </button>

      <button
        type="button"
        onClick={() => props.onCancelInlineEdit(inlineSession)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        title="Cancel changes (Escape)"
      >
        <X size={12} />
        <span>Cancel</span>
        <kbd className="ml-0.5 text-[9px] font-mono opacity-50">esc</kbd>
      </button>

      {/*
        The single canonical editing surface for a block's content and style is
        the Visual Composer. This panel edits text in place, so it names the
        owner of design, spacing and history rather than shipping a second copy
        of those controls — the two copies had already drifted.
      */}
      <div
        data-canonical-editing-surface="true"
        className="rounded-xl border border-accent-gold/40 bg-accent-gold/10 p-2.5"
      >
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-accent-gold">
          <SlidersHorizontal size={12} />
          <span>Design &amp; structure</span>
        </span>
        <p className="mt-1 text-[10px] leading-snug text-ink-muted-on-dark">
          Fonts, color, spacing, effects and undo live in the Visual Composer. This panel edits the
          text in place.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => props.onOpenVisualComposer('block', composerIdx)}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border border-accent-gold/30 bg-accent-gold/15 px-2 py-1 text-[11px] font-bold text-accent-gold transition-colors hover:bg-accent-gold/25"
            title="Visual Composer: Element Box Model, Effects, Motion & Typography (⌘E)"
            aria-label="Open Visual Composer for block"
          >
            <SlidersHorizontal size={12} />
            <span>Composer</span>
          </button>
          <button
            type="button"
            onClick={() => props.onOpenVisualComposer('section', composerIdx)}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border border-sky-400/30 bg-sky-500/15 px-2 py-1 text-[11px] font-bold text-sky-400 transition-colors hover:bg-sky-500/25"
            title="Section Settings: Viewport Min-Height, Cutout Dividers & Grid Columns"
            aria-label="Open Visual Composer for section"
          >
            <LayoutTemplate size={12} />
            <span>Section</span>
          </button>
        </div>
      </div>

      {inlineSession.dataPointKey && (
        <div className="flex items-center gap-1">
          <span
            className="inline-flex select-none items-center gap-1 rounded border border-sky-400/40 bg-sky-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-sky-300 shadow-xs"
            title="Connected directly to Supabase DB public.data_points table"
          >
            <Database size={11} className="text-sky-400" />
            <span>{inlineSession.dataPointKey}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              if (inlineSession.dataPointKey) {
                void navigator.clipboard?.writeText(inlineSession.dataPointKey);
                toast.success(`Copied "${inlineSession.dataPointKey}" to clipboard`);
              }
            }}
            className="cursor-pointer rounded p-1 text-sky-300 transition-colors hover:bg-white/10 hover:text-white"
            title="Copy DataPoint key"
            aria-label="Copy DataPoint key"
          >
            <Copy size={11} />
          </button>
        </div>
      )}

      <div className="my-1 h-px w-full bg-white/15" />

      <InlineFormatToolbar
        variant="pill"
        commands={formatCommands}
        onCommand={(command) => {
          if (command === 'link') {
            props.onSetLinkModal({ textareaId: null, url: '', text: '' });
          } else if (command === 'editLink') {
            // `activeAnchor` is guaranteed non-null here: the command is only in
            // `formatCommands` when the session element is or contains an <a>.
            if (activeAnchor) {
              props.onSetLinkModal({
                textareaId: null,
                url: activeAnchor.getAttribute('href') ?? activeAnchor.href,
                text: '',
                editAnchor: activeAnchor,
              });
            }
          } else {
            applyInlineFormatCommand(command);
          }
        }}
      />

      <div className="my-1 h-px w-full bg-white/15" />

      <CivicGhostwriter
        element={inlineSession.element}
        onTextUpdated={(t) => props.onInlineTextUpdated(t)}
      />

      <span className="ml-0.5 select-none rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-ink-muted-on-dark">
        {props.inlineCounts.words}w · {props.inlineCounts.chars}c
      </span>

      <div className="my-1 h-px w-full bg-white/15" />

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={props.onToggleSlashMenu}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-accent-gold transition-colors hover:bg-accent-gold/20"
        title="Open Slash Commands (or type /)"
        aria-label="Open Slash Commands"
      >
        <span className="font-mono text-xs">/</span>
        <span className="hidden md:inline">Slash</span>
      </button>

      {(inlineSession.blockIndex !== null || props.blocks.length > 0) && (
        <>
          <div className="my-1 h-px w-full bg-white/15" />
          <button
            type="button"
            onClick={() => {
              const idx = inlineSession.blockIndex;
              if (idx !== null) {
                props.onOpenVisualComposer('block', idx);
              }
            }}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-accent-gold transition-colors hover:bg-white/10 hover:text-white"
            title="Open Full Visual Composer Editor (⌘E)"
          >
            <SlidersHorizontal size={12} />
            <span className="hidden md:inline">Full Editor</span>
          </button>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Image-edit context zone (sky)
// ══════════════════════════════════════════════════════════════════════════
