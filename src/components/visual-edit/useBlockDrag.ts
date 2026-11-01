'use client';

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { type BlockFrame, insertionPointForPointer, planBlockMove } from '@/lib/block-order';

export interface BlockDragState {
  fromIndex: number;
  insertion: number;
  indicator: { top: number; left: number; width: number } | null;
}

export interface UseBlockDragOptions {
  /** The section model, in block order; only the block index is read. */
  sections: readonly { blockIndex: number }[];
  /** The element rendering a block, or null when the page does not render it. */
  locate: (blockIndex: number) => HTMLElement | null;
  /** True while the composer owns the canvas; a drag must not start behind it. */
  disabled: boolean;
  /** Selection follows the block the pointer lifted. */
  onDragStart: (blockIndex: number) => void;
  /** Move one block to another index through the overlay's single write path. */
  onMove: (from: number, to: number) => void;
  /** The document's block count, including blocks the page does not render. */
  totalBlocks: number;
}

export interface BlockDragControls {
  /** The gesture in flight, or null; its `indicator` is where the line draws. */
  blockDrag: BlockDragState | null;
  /** The rendered blocks with the vertical extent a drop compares against. */
  blockFrames: () => BlockFrame[];
  beginBlockDrag: (event: ReactPointerEvent<HTMLButtonElement>, fromIndex: number) => void;
}

/**
 * The block drag gesture: lift on pointerdown, drop on pointerup, cancel on
 * pointercancel, window blur or Escape.
 *
 * This lives beside `@/lib/block-order`, not inside the overlay, because the
 * gesture is a self-contained protocol: it owns the listeners it installs, the
 * body styles it sets, and the drag state it publishes. The pure module below
 * it still owns the arithmetic — which gap a pointer names and which index the
 * block lands at once it is lifted out — so the off-by-one that turns a
 * downward move into a no-op stays testable without a browser.
 *
 * The overlay keeps the one write path: `onMove` is its `moveBlockTo`, so a
 * drop and the handle's arrow keys cannot grow two histories or two saves.
 */
export function useBlockDrag({
  sections,
  locate,
  disabled,
  onDragStart,
  onMove,
  totalBlocks,
}: UseBlockDragOptions): BlockDragControls {
  const [blockDrag, setBlockDrag] = useState<BlockDragState | null>(null);
  const blockDragRef = useRef<BlockDragState | null>(null);
  blockDragRef.current = blockDrag;

  /**
   * The rendered blocks, in document order, with the vertical extent a drop
   * gesture compares against.
   */
  const blockFrames = useCallback((): BlockFrame[] => {
    const frames: BlockFrame[] = [];
    for (const section of sections) {
      const element = locate(section.blockIndex);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      // A zero-height element (a hidden add-block placeholder, say) has no
      // meaningful midpoint and would steal every drop above it.
      if (rect.bottom <= rect.top) continue;
      frames.push({ blockIndex: section.blockIndex, top: rect.top, bottom: rect.bottom });
    }
    return frames;
  }, [locate, sections]);

  /** Where to draw the insertion line for a gap, in viewport coordinates. */
  const dropIndicatorFor = useCallback(
    (insertion: number): { top: number; left: number; width: number } | null => {
      const before = sections.find((section) => section.blockIndex === insertion);
      // The end of the list is drawn under the last block that is actually on
      // the page; an unrendered trailing block has no edge to point at.
      const target =
        before ?? [...sections].reverse().find((section) => locate(section.blockIndex));
      if (!target) return null;
      const element = locate(target.blockIndex);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { top: before ? rect.top : rect.bottom, left: rect.left, width: rect.width };
    },
    [locate, sections]
  );

  const finishBlockDrag = useCallback(
    (drop: boolean) => {
      const drag = blockDragRef.current;
      blockDragRef.current = null;
      setBlockDrag(null);
      if (!drop || !drag) return;

      const plan = planBlockMove(totalBlocks, drag.fromIndex, drag.insertion);
      if (plan) onMove(plan.from, plan.to);
    },
    [onMove, totalBlocks]
  );

  /**
   * Lift a block. Nothing is written until the pointer is released over a
   * different gap — a click on the handle is not a move, so it must not mint a
   * revision that says the page changed when it did not.
   */
  const beginBlockDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, fromIndex: number) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (disabled) return;
      if (blockFrames().length < 2) return;
      event.preventDefault();
      event.stopPropagation();
      onDragStart(fromIndex);
      setBlockDrag({ fromIndex, insertion: fromIndex, indicator: dropIndicatorFor(fromIndex) });
    },
    [blockFrames, disabled, dropIndicatorFor, onDragStart]
  );

  const isDraggingBlock = blockDrag !== null;
  useEffect(() => {
    if (!isDraggingBlock) return;
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const onPointerMove = (event: PointerEvent) => {
      /*
       * A drag that cannot reach the edge is a drag that cannot reach the end of
       * a long page. Scroll while the pointer is held near an edge; the frames
       * are re-measured after this, so the gap under the pointer is the gap the
       * page is now showing rather than the one it showed a moment ago.
       */
      const edge = 72;
      if (typeof window.scrollBy === 'function') {
        if (event.clientY < edge) window.scrollBy({ top: -18 });
        else if (event.clientY > window.innerHeight - edge) window.scrollBy({ top: 18 });
      }

      const frames = blockFrames();
      if (frames.length === 0) return;
      const insertion = insertionPointForPointer(frames, event.clientY);
      if (insertion === null) return;
      setBlockDrag((prev) =>
        prev === null || prev.insertion === insertion
          ? prev
          : { ...prev, insertion, indicator: dropIndicatorFor(insertion) }
      );
    };
    const onPointerUp = () => finishBlockDrag(true);
    const onPointerCancel = () => finishBlockDrag(false);
    // Dragging into the browser chrome (or out of the tab) never delivers a
    // pointerup. Treat losing the window as the cancel it effectively is.
    const onWindowBlur = () => finishBlockDrag(false);
    /*
     * Escape cancels the gesture, not the page. Capturing here runs before the
     * overlay's own key handler, which would otherwise read Escape as "collapse
     * the selection" or the composer's as "close the panel" while a block is
     * mid-air.
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      finishBlockDrag(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('keydown', onKeyDown, true);
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [isDraggingBlock, blockFrames, dropIndicatorFor, finishBlockDrag]);

  return { blockDrag, blockFrames, beginBlockDrag };
}
