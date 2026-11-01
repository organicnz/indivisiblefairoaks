// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  type BlockFrame,
  insertionPointForPointer,
  moveBlockItem,
  planBlockMove,
} from '@/lib/block-order';

/**
 * The arithmetic between a pointer and the block list.
 *
 * A drag reports pixels; a move is an index. The translation is where an
 * off-by-one hides, and it is invisible in a browser until a block refuses to
 * move past its neighbour — so it is tested here, where a failure names the
 * case instead of a mystery in the page.
 */

const frames: BlockFrame[] = [
  { blockIndex: 0, top: 0, bottom: 100 },
  { blockIndex: 1, top: 100, bottom: 300 },
  { blockIndex: 2, top: 300, bottom: 340 },
];

describe('insertionPointForPointer', () => {
  it('names the first gap above the first midpoint', () => {
    expect(insertionPointForPointer(frames, -50)).toBe(0);
    expect(insertionPointForPointer(frames, 49)).toBe(0);
  });

  it('names the next gap once the pointer passes a midpoint', () => {
    // The first block's midpoint is 50; its neighbour's is 200.
    expect(insertionPointForPointer(frames, 51)).toBe(1);
    expect(insertionPointForPointer(frames, 199)).toBe(1);
    expect(insertionPointForPointer(frames, 201)).toBe(2);
  });

  it('names the end of the list below the last midpoint', () => {
    expect(insertionPointForPointer(frames, 1000)).toBe(3);
  });

  it('uses the block index, not the frame position', () => {
    // A block the page did not render is missing from the frames; the gap after
    // block 3 is still addressed as block 3 + 1, not as "after the second
    // frame".
    const sparse: BlockFrame[] = [
      { blockIndex: 1, top: 0, bottom: 80 },
      { blockIndex: 3, top: 80, bottom: 160 },
    ];

    expect(insertionPointForPointer(sparse, 10)).toBe(1);
    // Exactly on the midpoint is already past it; just above is not.
    expect(insertionPointForPointer(sparse, 119)).toBe(3);
    expect(insertionPointForPointer(sparse, 120)).toBe(4);
    expect(insertionPointForPointer(sparse, 400)).toBe(4);
  });

  it('has no answer when nothing is rendered', () => {
    expect(insertionPointForPointer([], 120)).toBeNull();
  });
});

describe('planBlockMove', () => {
  it('moves a block downward by removing it before inserting', () => {
    // Blocks A B C D; drag A to the gap after C (insertion 3). Once A is
    // lifted out, C sits at index 2, so the landing index is 2 — not 3.
    expect(planBlockMove(4, 0, 3)).toEqual({ from: 0, to: 2 });
    expect(planBlockMove(4, 1, 4)).toEqual({ from: 1, to: 3 });
  });

  it('moves a block upward without shifting the target', () => {
    expect(planBlockMove(4, 3, 0)).toEqual({ from: 3, to: 0 });
    expect(planBlockMove(4, 2, 1)).toEqual({ from: 2, to: 1 });
  });

  it('treats both gaps around a block as its current position', () => {
    expect(planBlockMove(4, 1, 1)).toBeNull();
    expect(planBlockMove(4, 1, 2)).toBeNull();
  });

  it('clamps an insertion outside the list', () => {
    expect(planBlockMove(3, 2, 99)).toBeNull();
    expect(planBlockMove(3, 0, 99)).toEqual({ from: 0, to: 2 });
    expect(planBlockMove(3, 2, -5)).toEqual({ from: 2, to: 0 });
  });

  it('refuses an address the list does not have', () => {
    expect(planBlockMove(0, 0, 0)).toBeNull();
    expect(planBlockMove(3, 3, 0)).toBeNull();
    expect(planBlockMove(3, -1, 0)).toBeNull();
    expect(planBlockMove(3, 0.5, 0)).toBeNull();
    expect(planBlockMove(Number.NaN, 0, 0)).toBeNull();
  });
});

describe('moveBlockItem', () => {
  const blocks = ['A', 'B', 'C', 'D'];

  it('applies a downward plan', () => {
    expect(moveBlockItem(blocks, { from: 0, to: 2 })).toEqual(['B', 'C', 'A', 'D']);
  });

  it('applies an upward plan', () => {
    expect(moveBlockItem(blocks, { from: 3, to: 0 })).toEqual(['D', 'A', 'B', 'C']);
  });

  it('leaves the input untouched', () => {
    const input = ['A', 'B'];
    moveBlockItem(input, { from: 0, to: 1 });
    expect(input).toEqual(['A', 'B']);
  });

  it('returns a copy when the plan addresses nothing', () => {
    const output = moveBlockItem(blocks, { from: 9, to: 0 });
    expect(output).toEqual(blocks);
    expect(output).not.toBe(blocks);
  });
});
