import { describe, expect, it } from 'vitest';
import {
  COALESCE_WINDOW_MS,
  canRedo,
  canUndo,
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  type History,
  record,
  redo,
  undo,
} from '@/lib/editor-history';

/**
 * `undo`/`redo` return null when the stack is empty, which is a real outcome
 * the tests above check separately. Here the outcome is assumed, so it is
 * asserted — which is the point of the non-null operator, done honestly.
 */
function undoOrFail(history: History, current: string) {
  const result = undo(history, current);
  if (!result) throw new Error('expected something to undo');
  return result;
}

function redoOrFail(history: History, current: string) {
  const result = redo(history, current);
  if (!result) throw new Error('expected something to redo');
  return result;
}

describe('editor history', () => {
  describe('undo', () => {
    it('is unavailable on a fresh history', () => {
      expect(canUndo(EMPTY_HISTORY)).toBe(false);
      expect(undo(EMPTY_HISTORY, 'a')).toBeNull();
    });

    it('restores the state before the last change', () => {
      const h1 = record(EMPTY_HISTORY, 'a', 'b', null);
      expect(undoOrFail(h1, 'b').restore).toBe('a');
    });

    it('walks all the way back to the start', () => {
      let h = EMPTY_HISTORY;
      h = record(h, 'a', 'b', null);
      h = record(h, 'b', 'c', null);
      h = record(h, 'c', 'd', null);

      // Three discrete changes, so three steps back — no coalescing to collapse.
      const first = undoOrFail(h, 'd');
      expect(first.restore).toBe('c');
      const second = undoOrFail(first.history, 'c');
      expect(second.restore).toBe('b');
      const third = undoOrFail(second.history, 'b');
      expect(third.restore).toBe('a');

      // Exhausted: the stack is empty, and undo says so rather than throwing.
      expect(undo(third.history, 'a')).toBeNull();
    });

    it('does not record a change that changed nothing', () => {
      // A block editor emits model updates for no-op DOM mutations. Without this
      // guard, undo walks through a stack of identical documents and appears to
      // do nothing at all.
      const h = record(EMPTY_HISTORY, 'same', 'same', null);
      expect(canUndo(h)).toBe(false);
    });
  });

  describe('redo', () => {
    it('is unavailable until something is undone', () => {
      const h = record(EMPTY_HISTORY, 'a', 'b', null);
      expect(canRedo(h)).toBe(false);
      expect(redo(h, 'a')).toBeNull();
    });

    it('replays an undone change', () => {
      const h = record(EMPTY_HISTORY, 'a', 'b', null);
      const undone = undoOrFail(h, 'b');
      expect(canRedo(undone.history)).toBe(true);
      expect(redoOrFail(undone.history, 'a').restore).toBe('b');
    });

    it('replays several undone changes in order', () => {
      let h = record(EMPTY_HISTORY, 'a', 'b', null);
      h = record(h, 'b', 'c', null);

      h = undoOrFail(h, 'c').history;
      h = undoOrFail(h, 'b').history;
      expect(h.past).toHaveLength(0);
      expect(h.future.map((e) => e.snapshot)).toEqual(['b', 'c']);

      expect(redoOrFail(h, 'a').restore).toBe('b');
      h = redoOrFail(h, 'a').history;
      expect(redoOrFail(h, 'b').restore).toBe('c');
      h = redoOrFail(h, 'c').history;
      expect(canRedo(h)).toBe(false);
    });

    it('discards the redo stack once a new change is made', () => {
      // The alternative is a redo that silently discards the work done since
      // the undo, which is the worst possible behaviour for an author who
      // changed their mind and then changed it back.
      let h = record(EMPTY_HISTORY, 'a', 'b', null);
      h = undoOrFail(h, 'b').history;
      expect(canRedo(h)).toBe(true);

      h = record(h, 'a', 'z', null);
      expect(canRedo(h)).toBe(false);
    });
  });

  describe('coalescing', () => {
    it('treats a burst of typing as one step', () => {
      // Without this, undo walks one character at a time, which does not feel
      // like undo.
      let h = EMPTY_HISTORY;
      h = record(h, 'a', 'ab', 'type:a', 1000);
      h = record(h, 'ab', 'abc', 'type:a', 1100);
      h = record(h, 'abc', 'abcd', 'type:a', 1200);

      expect(h.past).toHaveLength(1);
      expect(undoOrFail(h, 'abcd').restore).toBe('a');
    });

    it('starts a new step after a pause, so undo lands where thinking paused', () => {
      let h = EMPTY_HISTORY;
      h = record(h, 'a', 'ab', 'type:a', 1000);
      h = record(h, 'ab', 'abc', 'type:a', 1000 + COALESCE_WINDOW_MS + 1);

      expect(h.past).toHaveLength(2);
      expect(undoOrFail(h, 'abc').restore).toBe('ab');
    });

    it('starts a new step when the key differs', () => {
      // Typing in the body, then typing in the title, are two intents even if
      // they happen back to back.
      let h = EMPTY_HISTORY;
      h = record(h, 'a', 'ab', 'type:body', 1000);
      h = record(h, 'ab', 'title', 'type:title', 1050);

      expect(h.past).toHaveLength(2);
    });

    it('never coalesces a discrete operation', () => {
      // Deleting two blocks in a row is two things to take back.
      let h = EMPTY_HISTORY;
      h = record(h, 'a', 'b', null, 1000);
      h = record(h, 'b', 'c', null, 1010);
      expect(h.past).toHaveLength(2);
    });

    it('keeps discrete operations out of a typing group', () => {
      let h = EMPTY_HISTORY;
      h = record(h, 'a', 'ab', 'type:a', 1000);
      h = record(h, 'ab', 'ac', null, 1050);
      h = record(h, 'ac', 'acd', 'type:a', 1060);

      // The discrete edit closed the typing group, so the trailing keystroke
      // opens a new one rather than joining the interrupted run.
      expect(h.past).toHaveLength(3);
    });
  });

  describe('bounds', () => {
    it('caps the stack so a long session cannot grow without limit', () => {
      let h = EMPTY_HISTORY;
      for (let i = 0; i < HISTORY_LIMIT + 25; i += 1) {
        h = record(h, `v${i}`, `v${i + 1}`, null, 1000 + i);
      }
      expect(h.past).toHaveLength(HISTORY_LIMIT);
      // 125 changes record v0..v124; the 100 kept are the newest, so v25 leads.
      expect(h.past[0].snapshot).toBe(`v${25}`);
    });
  });

  describe('sequences', () => {
    it('survives an undo-then-retype-then-undo round trip', () => {
      // The burst coalesced into one entry, so a single undo returns to 'a'.
      let h = record(EMPTY_HISTORY, 'a', 'ab', 'type:a', 1000);
      h = record(h, 'ab', 'abc', 'type:a', 1100);
      h = undoOrFail(h, 'abc').history;
      expect(canUndo(h)).toBe(false);
      expect(redoOrFail(h, 'a').restore).toBe('abc');

      // Retype after the undo, then undo again: the new run supersedes the
      // redo, and undo still lands on the original document.
      h = record(h, 'a', 'axyz', 'type:a', 1200);
      expect(canRedo(h)).toBe(false);
      h = undoOrFail(h, 'axyz').history;
      expect(redoOrFail(h, 'a').restore).toBe('axyz');
    });

    it('keeps undo and redo balanced', () => {
      let h = EMPTY_HISTORY;
      h = record(h, 'a', 'b', null, 1000);
      h = record(h, 'b', 'c', null, 2000);

      const back = undoOrFail(h, 'c');
      const forward = redoOrFail(back.history, 'b');
      expect(forward.history.past).toHaveLength(h.past.length);
      expect(forward.history.future).toHaveLength(0);
    });
  });
});
