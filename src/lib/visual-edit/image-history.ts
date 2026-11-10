import { type Block, parseHtml, serializeBlocks } from '@/lib/blocks';
import type { History, HistoryEntry } from '@/lib/editor-history';

/**
 * The stable, serializable part of an image edit session.
 *
 * `blockId` is useful for the live model, where a reorder cannot retarget the
 * edit. History snapshots are serialized HTML, so IDs are regenerated when
 * parsed and can no longer be trusted; the snapshot path matches images by
 * source instead.
 */
export interface ImageHistoryTarget {
  blockId: string | null;
  blockIndex: number | null;
  imageOrdinal: number;
  historyKey: string;
}

/** One image state that a failed write installed in the live preview. */
export interface ImageHistoryFailure {
  src: string;
  alt: string;
}

/** The failed run whose optimistic entries need reconciling. */
export interface ImageHistoryRun {
  /** Prefix shared by every write in this image session. */
  historyKey: string;
  /** The first failed write; the run starts at this history entry. */
  failureKey: string;
  /** Every failed image state, not just the most recent one. */
  failedImages: ImageHistoryFailure[];
}

/** Resolve a live session's block, preferring identity over position. */
export function resolveImageBlockIndex(
  blocks: Block[],
  target: Pick<ImageHistoryTarget, 'blockId' | 'blockIndex'>
): number {
  if (target.blockId) {
    const index = blocks.findIndex((block) => block.id === target.blockId);
    if (index !== -1) return index;
  }
  return target.blockIndex ?? -1;
}

/**
 * Apply an image rollback to one block, or return null when this block does not
 * contain the failed image.
 *
 * The source is the fingerprint: a history snapshot's IDs are new, but the URL
 * the failed write installed is the same string in every state that followed
 * it. The ordinal breaks ties when the same source appears more than once.
 */
function restoreImageInBlock(
  block: Block,
  target: ImageHistoryTarget,
  nextSrc: string,
  nextAlt: string,
  failedSrc: string,
  failedAlt: string
): Block | null {
  if (block.type === 'image') {
    if (block.src !== failedSrc) return null;
    if (block.src === nextSrc && block.alt === nextAlt) return block;
    return { ...block, src: nextSrc, alt: nextAlt };
  }

  if (block.type !== 'paragraph' && block.type !== 'quote' && block.type !== 'callout') {
    return null;
  }

  const template = document.createElement('template');
  template.innerHTML = block.html;
  const images = Array.from(template.content.querySelectorAll('img'));
  const ordinalImage = images[target.imageOrdinal];
  const candidates = images.filter((image) => image.getAttribute('src') === failedSrc);
  const image =
    ordinalImage && ordinalImage.getAttribute('src') === failedSrc
      ? ordinalImage
      : (candidates.find((candidate) => (candidate.getAttribute('alt') ?? '') === failedAlt) ??
        candidates[0]);
  if (!image) return null;
  if (image.getAttribute('src') === nextSrc && (image.getAttribute('alt') ?? '') === nextAlt) {
    return block;
  }

  image.setAttribute('src', nextSrc);
  image.setAttribute('alt', nextAlt);
  const html = template.innerHTML;
  if (html === block.html) return block;
  return { ...block, html };
}

/**
 * Apply an image rollback to one snapshot.
 *
 * The recorded block position is tried first; if a later edit moved that block,
 * the scan finds the failed source wherever it landed. Returning the original
 * array when nothing changed keeps history entries that never contained the
 * failed image byte-identical.
 */
export function restoreImageInBlocks(
  blocks: Block[],
  target: ImageHistoryTarget,
  nextSrc: string,
  nextAlt: string,
  failedSrc: string,
  failedAlt: string
): Block[] {
  const preferred = target.blockIndex ?? -1;
  if (preferred >= 0 && blocks[preferred]) {
    const restored = restoreImageInBlock(
      blocks[preferred],
      target,
      nextSrc,
      nextAlt,
      failedSrc,
      failedAlt
    );
    if (restored) {
      if (restored === blocks[preferred]) return blocks;
      const next = [...blocks];
      next[preferred] = restored;
      return next;
    }
  }

  for (let index = 0; index < blocks.length; index += 1) {
    if (index === preferred) continue;
    const restored = restoreImageInBlock(
      blocks[index],
      target,
      nextSrc,
      nextAlt,
      failedSrc,
      failedAlt
    );
    if (restored && restored !== blocks[index]) {
      const next = [...blocks];
      next[index] = restored;
      return next;
    }
  }

  return blocks;
}

function isSessionEntry(entry: HistoryEntry, historyKey: string): boolean {
  return entry.key === historyKey || entry.key?.startsWith(`${historyKey}:`) === true;
}

function rewriteSnapshot(
  entry: HistoryEntry,
  target: ImageHistoryTarget,
  run: ImageHistoryRun,
  nextSrc: string,
  nextAlt: string
): HistoryEntry {
  if (run.failedImages.length === 0) return entry;
  const previous = parseHtml(entry.snapshot);
  let restored = previous;
  for (const failed of run.failedImages) {
    restored = restoreImageInBlocks(restored, target, nextSrc, nextAlt, failed.src, failed.alt);
  }
  return restored === previous ? entry : { ...entry, snapshot: serializeBlocks(restored) };
}

/**
 * Reconcile history when a failed image run ends.
 *
 * A failed image write is optimistic: it is committed before the backend
 * answers, and later edits may build on that preview. Cancelling removes the
 * failed checkpoint and every later write in the run, then rewrites later
 * snapshots to the restored image so unrelated undo steps survive. Success
 * keeps the persisted entry as the undo boundary, removes the failed
 * checkpoint and intermediate attempts, and rewrites snapshots to the last
 * saved image.
 *
 * If a retry persisted the preview already in the model, there is no new
 * history entry. In that case the checkpoint remains: the image that was
 * previously a failed preview is now real, so the checkpoint is the correct
 * undo boundary. The caller advances its saved-image baseline instead.
 *
 * Returns the same history object when there is nothing to reconcile.
 */
export function repairImageHistory(
  history: History,
  target: ImageHistoryTarget,
  run: ImageHistoryRun,
  nextSrc: string,
  nextAlt: string,
  options: { successfulKey?: string | null } = {}
): History {
  const failedIndex = history.past.findIndex((entry) => entry.key === run.failureKey);
  if (failedIndex === -1) return history;

  const successRequested = options.successfulKey != null;
  const successIndex = successRequested
    ? history.past.findIndex(
        (entry, index) => index > failedIndex && entry.key === options.successfulKey
      )
    : -1;
  if (successRequested && successIndex === -1) return history;

  const past: HistoryEntry[] = [];
  let changed = false;
  history.past.forEach((entry, index) => {
    if (index < failedIndex) {
      past.push(entry);
      return;
    }
    if (index === failedIndex) {
      changed = true;
      return;
    }
    if (successIndex !== -1 && index === successIndex) {
      const rewritten = rewriteSnapshot(entry, target, run, nextSrc, nextAlt);
      past.push(rewritten);
      if (rewritten !== entry) changed = true;
      return;
    }
    if (isSessionEntry(entry, run.historyKey)) {
      changed = true;
      return;
    }
    const rewritten = rewriteSnapshot(entry, target, run, nextSrc, nextAlt);
    past.push(rewritten);
    if (rewritten !== entry) changed = true;
  });

  const future = history.future.map((entry) =>
    rewriteSnapshot(entry, target, run, nextSrc, nextAlt)
  );
  const futureChanged = future.some((entry, index) => entry !== history.future[index]);
  return changed || futureChanged ? { past, future } : history;
}
