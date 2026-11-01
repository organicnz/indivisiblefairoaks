/**
 * Block reordering, in the coordinate the operator is actually pointing at.
 *
 * A drag happens in pixels, but a move is an operation on the block list. The
 * two meet in one place so that the arithmetic can be tested without a browser:
 * the pointer names an *insertion* — the gap between two blocks — and the plan
 * turns that gap into the index the block ends up at after it is lifted out of
 * the list. Getting that second step wrong is how a "move down" becomes a
 * no-op one row later, so it is a function rather than an inline splice.
 */

/** A rendered block, as the page reports it. */
export interface BlockFrame {
  blockIndex: number;
  top: number;
  bottom: number;
}

/** Where a dragged block came from, and where it lands once it is lifted out. */
export interface BlockMovePlan {
  from: number;
  to: number;
}

/**
 * The insertion a pointer at `y` names, in block coordinates.
 *
 * Each frame owns the half of the gap above it down to the previous frame's
 * midpoint, so dragging past the middle of the next block is what makes the
 * block move past it — the ordinary convention, and the one that lets a short
 * block be swapped with a tall neighbour without dragging the full width of the
 * tall one. Dropping below the last frame names the end of the list, which is
 * reported as `blockIndex + 1` rather than as a frame count: the frames are a
 * rendering of the list, not the list itself, and an unrendered block (one the
 * sanitizer kept and the page dropped) must not shift the address.
 */
export function insertionPointForPointer(frames: readonly BlockFrame[], y: number): number | null {
  if (frames.length === 0) return null;

  for (const frame of frames) {
    if (y < (frame.top + frame.bottom) / 2) {
      return frame.blockIndex;
    }
  }

  return frames[frames.length - 1].blockIndex + 1;
}

/**
 * The move an insertion names, or null when it names the block's own gap.
 *
 * `insertion` is a gap in the *current* list: 0 is before the first block and
 * `total` is after the last. Once the dragged block is lifted out, every gap
 * after it shifts down by one — so an insertion past the block's own position
 * is decremented, and the two gaps that bracket the block (its index and the
 * one after it) both become no-ops. Returning null rather than a plan is what
 * keeps a click-without-drag from committing an identical document and minting
 * a revision for it.
 */
export function planBlockMove(
  total: number,
  from: number,
  insertion: number
): BlockMovePlan | null {
  if (!Number.isInteger(total) || !Number.isInteger(from) || !Number.isInteger(insertion)) {
    return null;
  }
  if (total <= 0 || from < 0 || from >= total) return null;

  const gap = Math.min(Math.max(insertion, 0), total);
  const to = gap > from ? gap - 1 : gap;
  return to === from ? null : { from, to };
}

/**
 * A list with the plan applied.
 *
 * Pure and stable: the caller keeps its own array, which is what lets the
 * overlay's single `commitBlocks` path own the history entry for the move.
 */
export function moveBlockItem<T>(items: readonly T[], plan: BlockMovePlan): T[] {
  const next = [...items];
  const [item] = next.splice(plan.from, 1);
  if (item === undefined) return [...items];
  next.splice(plan.to, 0, item);
  return next;
}
