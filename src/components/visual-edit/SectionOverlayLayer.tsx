'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ArrowDown,
  ArrowUp,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  LayoutTemplate,
  PenLine,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import type { Block, CalloutTone, HeadingLevel, LeafBlockType } from '@/lib/blocks';
import { canMoveSection, type VisualSection } from '@/lib/visual-sections';
import type { VisualSectionOverlayItem } from '@/types/unified';
import { RovingToolbar } from './RovingToolbar';

const CONVERT_BLOCK_OPTIONS: ReadonlyArray<{
  type: LeafBlockType;
  label: string;
  headingLevel?: HeadingLevel;
  calloutTone?: CalloutTone;
}> = [
  { type: 'heading', label: 'Heading 2 (H2)', headingLevel: 2 },
  { type: 'heading', label: 'Heading 3 (H3)', headingLevel: 3 },
  { type: 'paragraph', label: 'Paragraph Text' },
  { type: 'callout', label: 'Callout (Info)', calloutTone: 'info' },
  { type: 'callout', label: 'Callout (Action)', calloutTone: 'action' },
  { type: 'callout', label: 'Callout (Warning)', calloutTone: 'warning' },
  { type: 'quote', label: 'Quote Block' },
  { type: 'bulletList', label: 'Bullet List' },
  { type: 'code', label: 'Code Snippet' },
];

export function SectionOverlayLayer({
  items,
  blocks,
  sections,
  selectedBlockIndexes,
  activeBlockIndex,
  showAllSectionBorders,
  isVisualComposerOpen,
  hasCopiedStyles,
  savingBackend,
  onAddAfter,
  onBeginDrag,
  onMoveVisible,
  onSelect,
  onEdit,
  onReplaceImage,
  onOpenComposer,
  onCopyStyles,
  onPasteStyles,
  onDuplicate,
  onMove,
  onConvert,
  onToggleFrame,
  onDelete,
}: {
  items: VisualSectionOverlayItem[];
  blocks: Block[];
  sections: VisualSection[];
  selectedBlockIndexes: ReadonlySet<number>;
  activeBlockIndex: number | null;
  showAllSectionBorders: boolean;
  isVisualComposerOpen: boolean;
  hasCopiedStyles: boolean;
  savingBackend: boolean;
  onAddAfter: (blockIndex: number) => void;
  onBeginDrag: (event: ReactPointerEvent<HTMLButtonElement>, blockIndex: number) => void;
  onMoveVisible: (blockIndex: number, direction: 'up' | 'down') => void;
  onSelect: (blockIndex: number, additive: boolean) => void;
  onEdit: (blockIndex: number) => void;
  onReplaceImage: (blockIndex: number) => void;
  onOpenComposer: (mode: 'block' | 'section', blockIndex: number) => void;
  onCopyStyles: (blockIndex: number, label: string) => void;
  onPasteStyles: (blockIndex: number, label: string) => void;
  onDuplicate: (blockIndex: number) => void;
  onMove: (blockIndex: number, direction: 'up' | 'down') => void;
  onConvert: (
    blockIndex: number,
    targetType: LeafBlockType,
    options?: { headingLevel?: HeadingLevel; calloutTone?: CalloutTone }
  ) => void;
  onToggleFrame: (blockIndex: number) => void;
  onDelete: (blockIndex: number) => void;
}) {
  return (
    <div aria-hidden="false" className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {items.map((item) => (
        <div
          key={item.domIndex}
          style={{
            position: 'fixed',
            top: `${item.top}px`,
            left: `${item.left}px`,
            width: `${item.width}px`,
            height: `${item.height}px`,
          }}
          className="pointer-events-none"
        >
          {/*
            Highlight boundary. It stays pointer-events-none: this layer sits
            over the live page, and making it clickable would swallow every
            click meant for the content underneath — including the inline
            editing this overlay exists to provide. Selection happens on the
            pill chip, which is the one pointer-events-auto surface here.
          */}
          <div
            className={`w-full h-full rounded-2xl transition-[border-color,background-color,box-shadow] duration-300 ${
              selectedBlockIndexes.has(item.blockIndex)
                ? 'border-2 border-accent-gold ring-4 ring-accent-gold/30 bg-accent-gold/10 shadow-[0_0_40px_rgba(245,158,11,0.35)]'
                : activeBlockIndex === item.blockIndex
                  ? 'border-2 border-accent-gold ring-4 ring-accent-gold/20 bg-accent-gold/5 shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                  : showAllSectionBorders
                    ? 'border border-dashed border-accent-gold/40 bg-accent-gold/[0.02]'
                    : 'border border-transparent'
            }`}
          />

          {/*
            Insert after this block. The gap between two blocks is where an
            operator wants a new one, and it used to be reachable only
            through the context menu or the structure drawer. It appears on
            the block being worked on rather than on every frame, so a page
            of forty blocks does not grow forty floating buttons.
          */}
          {activeBlockIndex === item.blockIndex ? (
            <button
              type="button"
              onClick={() => {
                onAddAfter(item.blockIndex);
              }}
              aria-label={`Add a block after ${item.label}`}
              title="Add a block after this one"
              className="pointer-events-auto absolute -bottom-3 left-1/2 z-10 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-accent-gold/60 bg-secondary text-accent-gold shadow-float backdrop-blur-md transition-[transform,background-color,color] hover:scale-110 hover:bg-accent-gold hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-accent-gold"
            >
              <Plus size={13} />
            </button>
          ) : null}

          {/* Floating Action Pill */}
          <RovingToolbar
            label={`Actions for ${item.label}`}
            className="pointer-events-auto absolute -top-3.5 left-0 -translate-x-full -ml-1 max-sm:left-0 max-sm:translate-x-0 max-sm:-top-8 inline-flex items-center gap-1.5 rounded-full border border-accent-gold/50 bg-secondary/95 px-3 py-1 text-xs text-ink-on-dark shadow-float backdrop-blur-md transition-[transform,background-color,border-color] hover:scale-105"
          >
            {/*
              Drag to reorder. The handle is a button because a drag-only
              control is unusable from the keyboard: Arrow Up/Down on the
              same handle moves the block one place, which is also the
              fallback for a trackpad that cannot hold a drag.
            */}
            <button
              type="button"
              onPointerDown={(event) => onBeginDrag(event, item.blockIndex)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                event.preventDefault();
                event.stopPropagation();
                onMoveVisible(
                  item.blockIndex,
                  event.key === 'ArrowUp' ? 'up' : 'down'
                );
              }}
              disabled={isVisualComposerOpen}
              aria-label={`Reorder ${item.label}. Drag, or press Arrow Up or Arrow Down.`}
              title={
                isVisualComposerOpen
                  ? 'Close the composer to move blocks'
                  : 'Drag to reorder — or focus and press ↑ / ↓'
              }
              className="cursor-grab touch-manipulation rounded p-1 text-slate-300 transition-colors hover:bg-white/15 hover:text-accent-gold active:cursor-grabbing focus-visible:ring-1 focus-visible:ring-accent-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <GripVertical size={13} />
            </button>

            <span className="h-3 w-px bg-white/20" aria-hidden="true" />

            {/* Selection chip: click selects the block; Cmd/Ctrl/Shift+click toggles multi. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(item.blockIndex, e.metaKey || e.ctrlKey || e.shiftKey);
              }}
              aria-pressed={selectedBlockIndexes.has(item.blockIndex)}
              aria-label={
                selectedBlockIndexes.has(item.blockIndex)
                  ? `Deselect ${item.label}`
                  : `Select ${item.label}. Hold Command or Control to add to a multi-selection.`
              }
              disabled={isVisualComposerOpen}
              title={
                isVisualComposerOpen
                  ? 'Close the composer to change the block selection'
                  : 'Select this block — ⌘/Ctrl-click to add more for batch styling'
              }
              className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white/10"
            >
              <span
                className={`size-1.5 rounded-full ${
                  selectedBlockIndexes.has(item.blockIndex)
                    ? 'bg-accent-gold ring-2 ring-white'
                    : 'bg-white/20'
                }`}
                aria-hidden="true"
              />
              <span className="font-black text-accent-gold uppercase tracking-wider">
                {item.blockType}
              </span>
              <span
                className={`max-w-[120px] sm:max-w-[180px] truncate font-semibold text-[11px] ${
                  selectedBlockIndexes.has(item.blockIndex) ? 'text-white' : 'text-ink-on-dark'
                }`}
              >
                {item.label}
              </span>
              {selectedBlockIndexes.size > 1 && selectedBlockIndexes.has(item.blockIndex) && (
                <span className="ml-1 inline-flex min-w-4 shrink-0 items-center justify-center rounded-full border border-accent-gold bg-accent-gold/20 px-1 text-[9px] font-black leading-4 text-ink-strong">
                  {selectedBlockIndexes.size}×
                </span>
              )}
            </button>

            <div className="ml-1.5 flex items-center gap-1 border-l border-white/20 pl-1.5">
              {/* Edit section */}
              <button
                type="button"
                onClick={() => {
                  onEdit(item.blockIndex);
                }}
                title="Edit section content"
                aria-label="Edit section content"
                className="rounded p-1 text-accent-gold hover:bg-white/15 hover:text-white transition-colors"
              >
                <PenLine size={13} />
              </button>

              {/* Quick media picker if image block */}
              {item.blockType === 'image' && (
                <button
                  type="button"
                  onClick={() => {
                    onReplaceImage(item.blockIndex);
                  }}
                  title="Replace image from Supabase S3 storage"
                  aria-label="Replace image from Supabase S3 storage"
                  className="rounded p-1 text-sky-400 hover:bg-white/15 hover:text-sky-300 transition-colors"
                >
                  <ImageIcon size={13} />
                </button>
              )}

              {/* Visual Composer: Element Design & Box Model Inspector */}
              <button
                type="button"
                onClick={() => {
                  onOpenComposer('block', item.blockIndex);
                }}
                title="Visual Composer: Element Design &amp; Box Model Inspector (⌘E)"
                aria-label="Visual Composer Inspector"
                className="rounded p-1 text-accent-gold hover:bg-white/15 hover:text-white transition-colors"
              >
                <SlidersHorizontal size={13} />
              </button>

              {/* Visual Composer: Section / Row Customizer */}
              <button
                type="button"
                onClick={() => {
                  onOpenComposer('section', item.blockIndex);
                }}
                title="Visual Composer: Row / Section Settings (Containers, Dividers &amp; Grid)"
                aria-label="Section Row Settings"
                className="rounded p-1 text-sky-400 hover:bg-white/15 hover:text-white transition-colors"
              >
                <LayoutTemplate size={13} />
              </button>

              {/* Visual Composer: 1-Click Copy Styles */}
              <button
                type="button"
                onClick={() => {
                  onCopyStyles(item.blockIndex, item.label);
                }}
                title="Copy block styles to clipboard"
                aria-label="Copy block styles"
                className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
              >
                <ClipboardCopy size={13} />
              </button>

              {/* Visual Composer: 1-Click Paste Styles (if clipboard has styles) */}
              {hasCopiedStyles && (
                <button
                  type="button"
                  onClick={() => {
                    onPasteStyles(item.blockIndex, item.label);
                  }}
                  title="Paste styles from clipboard"
                  aria-label="Paste styles"
                  className="rounded p-1 text-emerald-400 hover:bg-white/15 hover:text-white transition-colors"
                >
                  <ClipboardPaste size={13} />
                </button>
              )}

              {/* Duplicate section */}
              <button
                type="button"
                onClick={() => onDuplicate(item.blockIndex)}
                title="Duplicate section"
                aria-label="Duplicate section"
                className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
              >
                <Copy size={13} />
              </button>

              {/* Drag section handle */}
              <button
                type="button"
                onPointerDown={(event) => onBeginDrag(event, item.blockIndex)}
                disabled={isVisualComposerOpen}
                title="Drag section to reorder"
                aria-label={`Drag section ${item.label} to reorder`}
                className="rounded p-1 text-slate-400 hover:bg-white/15 hover:text-white transition-colors cursor-grab touch-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                <GripVertical size={13} />
              </button>

              {/* Move Up */}
              {canMoveSection(sections, item.blockIndex, 'up') && (
                <button
                  type="button"
                  onClick={() => onMove(item.blockIndex, 'up')}
                  title="Move section up"
                  aria-label="Move section up"
                  className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
                >
                  <ArrowUp size={13} />
                </button>
              )}

              {/* Move Down */}
              {canMoveSection(sections, item.blockIndex, 'down') && (
                <button
                  type="button"
                  onClick={() => onMove(item.blockIndex, 'down')}
                  title="Move section down"
                  aria-label="Move section down"
                  className="rounded p-1 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
                >
                  <ArrowDown size={13} />
                </button>
              )}

              {/* Quick heading level toggles if heading */}
              {item.blockType === 'heading' && (
                <div className="flex items-center gap-0.5 border-l border-white/20 pl-1">
                  {([2, 3, 4] as const).map((lvl) => {
                    const activeBlock = blocks[item.blockIndex];
                    const isCurrentLevel =
                      activeBlock?.type === 'heading' && activeBlock.level === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() =>
                          onConvert(item.blockIndex, 'heading', {
                            headingLevel: lvl,
                          })
                        }
                        title={`Set heading to H${lvl}`}
                        aria-label={`Set heading level ${lvl}`}
                        className={`px-1 py-0.5 rounded text-[10px] font-black transition-colors ${
                          isCurrentLevel
                            ? 'bg-accent-gold text-ink-strong font-black shadow-2xs'
                            : 'text-slate-300 hover:text-white hover:bg-white/15'
                        }`}
                      >
                        H{lvl}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Quick callout tone toggles if callout */}
              {item.blockType === 'callout' && (
                <div className="flex items-center gap-0.5 border-l border-white/20 pl-1">
                  {(['info', 'action', 'warning'] as const).map((tone) => {
                    const activeBlock = blocks[item.blockIndex];
                    const isCurrentTone =
                      activeBlock?.type === 'callout' && activeBlock.tone === tone;
                    return (
                      <button
                        key={tone}
                        type="button"
                        onClick={() =>
                          onConvert(item.blockIndex, 'callout', {
                            calloutTone: tone,
                          })
                        }
                        title={`Set tone to ${tone}`}
                        aria-label={`Set callout tone ${tone}`}
                        className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase transition-colors ${
                          isCurrentTone
                            ? 'bg-accent-gold text-ink-strong font-black shadow-2xs'
                            : 'text-slate-300 hover:text-white hover:bg-white/15'
                        }`}
                      >
                        {tone}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Convert section block type. A row's layout is its content,
                  so turning it into a leaf would have to discard it; the
                  composer edits its columns instead. */}
              {item.blockType !== 'row' && (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      title="Convert section type"
                      aria-label="Convert section type"
                      className="rounded p-1 text-purple-400 hover:bg-white/15 hover:text-purple-300 transition-colors"
                    >
                      <Sparkles size={13} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      side="bottom"
                      align="start"
                      sideOffset={6}
                      aria-label="Convert section type"
                      className="z-50 w-52 rounded-xl border border-white/15 bg-secondary p-1.5 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                    >
                      <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-ink-muted-on-dark border-b border-white/10 mb-1">
                        Turn into
                      </div>
                      {CONVERT_BLOCK_OPTIONS.map((option) => (
                        <DropdownMenu.Item
                          key={`${option.type}-${option.headingLevel ?? option.calloutTone ?? 'default'}`}
                          onSelect={() =>
                            onConvert(item.blockIndex, option.type, {
                              headingLevel: option.headingLevel,
                              calloutTone: option.calloutTone,
                            })
                          }
                          className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                        >
                          <span>{option.label}</span>
                          {item.blockType === option.type && (
                            <span className="text-[10px] text-accent-gold uppercase font-mono">
                              Current
                            </span>
                          )}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              )}

              {/* Turn off visual frame for this section */}
              <button
                type="button"
                onClick={() => onToggleFrame(item.blockIndex)}
                title="Hide visual frame for this section"
                aria-label="Hide visual frame for this section"
                className="rounded p-1 text-slate-400 hover:bg-white/15 hover:text-white transition-colors"
              >
                <EyeOff size={13} />
              </button>

              {/*
                Delete asks first. It used to fire on a single click straight
                into `saveContent` — the one operation in this component with
                no way back from another tab.
              */}
              <ConfirmAction
                label="Delete section"
                message={`Delete "${item.label}"? Undo brings it back in this session, and nothing is written until you save.`}
                confirmLabel="Delete"
                danger
                busy={savingBackend}
                idleClassName="rounded p-1 text-rose-400 hover:bg-white/15 hover:text-rose-300 transition-colors"
                onConfirm={() => onDelete(item.blockIndex)}
              >
                <Trash2 size={13} />
              </ConfirmAction>
            </div>
          </RovingToolbar>
        </div>
      ))}
    </div>
  );
}
