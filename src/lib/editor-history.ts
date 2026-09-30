/**
 * Undo/redo over a whole editor document, as snapshots.
 *
 * Snapshot-based rather than inverse-operation-based, and the reason is that
 * the editor's operations are not invertible in any useful sense: "merge these
 * two paragraphs" and "convert this heading to a quote" have no inverse that
 * restores what the author had. Storing the state *before* each change sidesteps
 * that entirely, and it also makes undo cheap to reason about — every entry is
 * a document that really existed, not a reconstruction.
 *
 * The unit of work is a string, not an object. The editor already computes a
 * canonical `JSON.stringify` snapshot to decide whether it is dirty, so history
 * reuses that exact representation. Two things taking the same snapshot means
 * one meaning: "same document". A second representation would eventually
 * disagree with the dirty check, and the bug would read as "undo says nothing
 * changed but the page thinks it is unsaved".
 *
 * `present` is deliberately *not* stored here. The live document is the source
 * of truth for the present; only the two directions are held, so there is no
 * second copy of the document to fall out of sync with the editor.
 */

export interface HistoryEntry {
  snapshot: string;
  /**
   * Groups consecutive edits so undo moves by intention, not by keystroke.
   *
   * A block editor emits a model change per character. Without grouping, undo
   * walks backwards one letter at a time, which is not undo, it is a way to make
   * an editor feel broken. `null` means "never coalesce" — for discrete
   * operations like deleting a block, where every one deserves its own step.
   */
  key: string | null;
  at: number;
}

export interface History {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export const EMPTY_HISTORY: History = { past: [], future: [] };

/** Bounded so a long editing session cannot grow memory without limit. */
export const HISTORY_LIMIT = 100;

/** Two edits with the same key inside this window are one intent. */
export const COALESCE_WINDOW_MS = 700;

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

/**
 * Record that the document moved from `previous` to the current one.
 *
 * `key` is the *incoming* change's coalescing key. When it matches the most
 * recent entry inside the window, nothing is pushed: the existing entry already
 * points at the state before the run of typing began, which is exactly where
 * undo should land. Only `previous` needs storing, so a run of edits costs one
 * entry rather than one per keystroke.
 *
 * Any new change clears `future`. That is what makes redo mean "redo what I
 * just undid" rather than "redo something from before the new edit", and it is
 * the behaviour every editor has, because the alternative is a redo that silently
 * discards the intervening work.
 */
export function record(
  history: History,
  previous: string,
  current: string,
  key: string | null,
  now: number = Date.now()
): History {
  // Nothing actually changed (a no-op model update). Pushing this would put an
  // entry on the stack that undoes to an identical document.
  if (previous === current) return history;

  const last = history.past[history.past.length - 1];
  const coalesce =
    key !== null && last !== undefined && last.key === key && now - last.at < COALESCE_WINDOW_MS;

  if (coalesce) {
    // Extend the group without adding an entry: refresh the timestamp so a
    // continuous run of typing stays one step, while a pause starts a new one.
    return {
      past: [...history.past.slice(0, -1), { ...last, at: now }],
      future: [],
    };
  }

  const past = [...history.past, { snapshot: previous, key, at: now }];
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    future: [],
  };
}

/**
 * Step backwards.
 *
 * Returns the snapshot to restore, or `null` when there is nothing to undo. The
 * caller applies it — this module never touches React state, so it is testable
 * without a renderer and cannot drift from the document it is describing.
 */
export function undo(
  history: History,
  current: string
): { history: History; restore: string } | null {
  const entry = history.past[history.past.length - 1];
  if (!entry) return null;
  return {
    history: {
      past: history.past.slice(0, -1),
      // `current` goes on the redo stack, not the entry being undone. They are
      // different documents: undo lands on the older state, and redo has to come
      // back to the one just left. Pushing the entry would make redo a no-op
      // that "restores" where the editor already is.
      future: [{ snapshot: current, key: null, at: Date.now() }, ...history.future].slice(
        0,
        HISTORY_LIMIT
      ),
    },
    restore: entry.snapshot,
  };
}

/** Step forwards. Mirrors `undo` exactly, for the same reason. */
export function redo(
  history: History,
  current: string
): { history: History; restore: string } | null {
  const entry = history.future[0];
  if (!entry) return null;
  const past = [...history.past, { snapshot: current, key: null, at: Date.now() }];
  return {
    history: {
      past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
      future: history.future.slice(1),
    },
    restore: entry.snapshot,
  };
}
