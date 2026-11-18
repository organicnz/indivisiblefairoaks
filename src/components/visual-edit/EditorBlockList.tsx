'use client';

import {
  ArrowDown,
  ArrowUp,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FilePlus2,
  GripVertical,
  LayoutTemplate,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { sectionLabelForBlock } from '@/lib/visual-sections';
import type { VisualEditorSidebarProps } from './VisualEditorSidebar';

export function EditorBlockList({ props }: { props: VisualEditorSidebarProps }) {
  const [draggingBlockIndex, setDraggingBlockIndex] = useState<number | null>(null);
  const [dragOverBlockIndex, setDragOverBlockIndex] = useState<number | null>(null);
  const documentLoadState = props.documentLoadState ?? 'idle';
  const canMutateDocument = documentLoadState === 'ready' && !props.unsaveableReason;
  const { blocks, sections, enabledSectionKeys, unsaveableReason } = props;

  return (
    <>
    {/* ── Block list ────────────────────────────────────────────────── */}
    {blocks.length > 0 && (
      <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-ink-muted-on-dark">
          Blocks
        </span>
        <div className="flex flex-col gap-1">
          {blocks.map((block, idx) => {
            const label = sectionLabelForBlock(block);
            const section = sections.find((item) => item.blockIndex === idx);
            const framed = section ? enabledSectionKeys.has(section.key) : false;
            const isDragging = draggingBlockIndex === idx;
            const isDragOver = dragOverBlockIndex === idx;
            return (
              <section
                key={block.id}
                aria-label={`Block #${idx + 1}: ${label}`}
                data-testid="sidebar-block-item"
                onDragOver={(e) => {
                  if (
                    !canMutateDocument ||
                    !props.onReorderSection ||
                    draggingBlockIndex === null ||
                    draggingBlockIndex === idx
                  )
                    return;
                  e.preventDefault();
                  if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                  }
                  if (dragOverBlockIndex !== idx) setDragOverBlockIndex(idx);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  if (dragOverBlockIndex === idx) setDragOverBlockIndex(null);
                }}
                onDrop={(e) => {
                  if (!canMutateDocument || !props.onReorderSection) return;
                  const dragFrom =
                    draggingBlockIndex ?? Number(e.dataTransfer?.getData('text/plain'));
                  if (Number.isNaN(dragFrom) || dragFrom === idx) return;
                  e.preventDefault();
                  props.onReorderSection(dragFrom, idx);
                  setDraggingBlockIndex(null);
                  setDragOverBlockIndex(null);
                }}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-ink-on-dark transition-[border-color,background-color,opacity,box-shadow] duration-150 ${
                  isDragOver
                    ? 'border-accent-gold/80 bg-accent-gold/20 shadow-md ring-1 ring-accent-gold/50'
                    : isDragging
                      ? 'opacity-40 border-white/10 bg-white/5'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {props.onReorderSection && (
                  <span
                    draggable={canMutateDocument}
                    aria-hidden="true"
                    title={
                      canMutateDocument
                        ? `Drag block #${idx + 1} (${label}) to reorder`
                        : 'Editing is locked until the saved document is ready'
                    }
                    onDragStart={(e) => {
                      setDraggingBlockIndex(idx);
                      if (e.dataTransfer) {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(idx));
                      }
                    }}
                    onDragEnd={() => {
                      setDraggingBlockIndex(null);
                      setDragOverBlockIndex(null);
                    }}
                    className={`select-none p-0.5 text-slate-400 hover:text-white touch-manipulation ${canMutateDocument ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-40'}`}
                  >
                    <GripVertical size={11} />
                  </span>
                )}
                <button
                  type="button"
                  disabled={!canMutateDocument}
                  onClick={() => {
                    props.onJumpToBlock(idx);
                    props.onOpenVisualComposer('block', idx);
                  }}
                  className="flex-1 truncate font-semibold text-left text-ink-on-dark hover:text-accent-gold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-on-dark"
                  title={`Edit ${label} in sidebar`}
                >
                  {label}
                </button>
                {section && (
                  <button
                    type="button"
                    onClick={() => props.onToggleSectionFrame(idx)}
                    aria-pressed={framed}
                    aria-label={framed ? `Hide frame for ${label}` : `Show frame for ${label}`}
                    title={framed ? 'Hide visual frame' : 'Show visual frame'}
                    className={`p-0.5 transition-colors ${
                      framed
                        ? 'text-accent-gold hover:text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {framed ? <Eye size={11} /> : <EyeOff size={11} />}
                  </button>
                )}
                <button
                  type="button"
                  disabled={!canMutateDocument}
                  onClick={() => props.onOpenVisualComposer('block', idx)}
                  title="Visual Composer: Element Design & Box Model (⌘E)"
                  aria-label={`Visual Composer for ${label}`}
                  className="p-0.5 text-accent-gold hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SlidersHorizontal size={11} />
                </button>
                <button
                  type="button"
                  disabled={!canMutateDocument}
                  onClick={() => props.onOpenVisualComposer('section', idx)}
                  title="Row / Section Settings (Containers, Dividers & Grid)"
                  aria-label={`Row settings for ${label}`}
                  className="p-0.5 text-sky-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LayoutTemplate size={11} />
                </button>
                <button
                  type="button"
                  disabled={!canMutateDocument}
                  onClick={() => props.onDuplicateSection(idx)}
                  title="Duplicate block"
                  aria-label={`Duplicate block ${label}`}
                  className="p-0.5 text-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Copy size={11} />
                </button>
                {props.onDeleteSection && (
                  <ConfirmAction
                    label={`Delete block ${label}`}
                    message={`Delete ${label}?`}
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    danger
                    disabled={!canMutateDocument}
                    idleClassName="p-0.5 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    onConfirm={() => props.onDeleteSection?.(idx)}
                  >
                    <Trash2 size={11} />
                  </ConfirmAction>
                )}
                {idx > 0 && (
                  <button
                    type="button"
                    disabled={!canMutateDocument}
                    onClick={() => props.onMoveSection(idx, 'up')}
                    title="Move up"
                    aria-label={`Move block ${label} up`}
                    className="p-0.5 text-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUp size={11} />
                  </button>
                )}
                {idx < blocks.length - 1 && (
                  <button
                    type="button"
                    disabled={!canMutateDocument}
                    onClick={() => props.onMoveSection(idx, 'down')}
                    title="Move down"
                    aria-label={`Move block ${label} down`}
                    className="p-0.5 text-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowDown size={11} />
                  </button>
                )}
              </section>
            );
          })}
        </div>
      </div>
    )}

    {/* ── Empty document or coded-route DataPoints ───────────────────── */}
    {blocks.length === 0 &&
      (props.isComposerWorkspace ? (
        <div
          data-testid="composer-empty-document"
          className="flex flex-col gap-2 border-t border-white/10 pt-2 text-xs"
        >
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-accent-gold">
            <FilePlus2 size={11} />
            <span>Empty document</span>
          </span>
          <p className="text-[11px] leading-snug text-ink-muted-on-dark">
            This row has no blocks yet. Add the first block here, or open the content editor to
            build the page with the full block library.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => props.onOpenBlockLibrary(null)}
              disabled={!canMutateDocument}
              title={
                documentLoadState === 'loading'
                  ? 'Wait for the saved document to open before adding a block'
                  : documentLoadState === 'degraded'
                    ? 'Reload the saved document before adding a block'
                    : unsaveableReason ?? 'Add the first block to this document'
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-accent-gold/40 bg-accent-gold/15 px-2.5 py-1 text-xs font-bold text-accent-gold transition-colors hover:bg-accent-gold/25 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent-gold/15"
            >
              <Plus size={12} />
              <span>Add first block</span>
            </button>
            {props.adminEditUrl ? (
              <a
                href={props.adminEditUrl}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/10"
              >
                <ExternalLink size={12} />
                <span>Content editor</span>
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-t border-white/10 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-accent-gold">
              <Database size={11} className="text-sky-400" />
              <span>Coded Route DataPoints:</span>
            </span>
          </div>
          <p className="text-[11px] text-ink-muted-on-dark">
            This page renders dynamic database fields. Click any element on page or open the
            matrix to edit live copy.
          </p>
          <button
            type="button"
            onClick={props.onOpenDataPointDrawer}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-300 transition-colors hover:bg-sky-500/30 cursor-pointer"
          >
            <Database size={12} />
            <span>Open DataPoints Matrix</span>
          </button>
        </div>
      ))}
    </>
  );
}
