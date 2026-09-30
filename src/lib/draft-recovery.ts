/**
 * A local copy of the document, so the window before autosave is not a window
 * where work is lost.
 *
 * Autosave is 2.5 seconds of typing away from durable storage, and a browser
 * crash, a closed laptop or a mis-click in another tab all fall inside that
 * window. `content_revisions` does not help: it records *persisted* states, so
 * whatever was never written is gone. This is the other half — a copy in the
 * browser, written as the author types, and offered back on return.
 *
 * Deliberately conservative about what it will restore:
 *
 * - **It never restores over newer server state.** If the stored copy is older
 *   than what the server has, the server wins. A stale local copy silently
 *   reverting a colleague's edit is worse than losing a draft.
 * - **It never restores silently.** A recovered draft is a claim that needs
 *   confirming, so the editor shows it and lets the author keep or discard it.
 * - **It is a cache, not a source of truth.** Everything here is disposable, so
 *   a malformed or stale entry is discarded rather than repaired.
 */

const PREFIX = 'ifo:content-draft:';
/** Older than this and a recovery would be archaeology, not a rescue. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface StoredDraft {
  snapshot: string;
  savedAt: number;
}

const storage = (): Storage | null => {
  try {
    // Private-mode Safari and some embedded webviews throw on access rather than
    // returning null, so this is a try/catch and not a feature check.
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const draftKey = (contentId: number | string): string => `${PREFIX}${contentId}`;

export function readDraft(
  contentId: number | string,
  now: number = Date.now()
): StoredDraft | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(draftKey(contentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (typeof parsed?.snapshot !== 'string' || typeof parsed?.savedAt !== 'number') {
      return null;
    }
    // A week-old draft is not a rescue, and offering one would be a confusing
    // thing to find in an editor.
    if (now - parsed.savedAt > DRAFT_MAX_AGE_MS) {
      clearDraft(contentId);
      return null;
    }
    return { snapshot: parsed.snapshot, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function writeDraft(
  contentId: number | string,
  snapshot: string,
  now: number = Date.now()
): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(draftKey(contentId), JSON.stringify({ snapshot, savedAt: now }));
  } catch {
    // A full quota must not break editing. The draft is a nicety; the editor is
    // the product.
  }
}

export function clearDraft(contentId: number | string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(draftKey(contentId));
  } catch {
    // Nothing useful to do; the entry is disposable.
  }
}

/**
 * Whether a stored draft is worth offering.
 *
 * The comparison is against what the server sent, not against the editor's own
 * dirty flag: a draft identical to the loaded page means the author typed and
 * undid their way back, and showing "we recovered your work" for that would be
 * noise. The age check is here rather than only in `readDraft` so the caller can
 * distinguish "nothing stored" from "stored but too old to offer".
 */
export function isWorthRecovering(
  draft: StoredDraft | null,
  serverSnapshot: string,
  now: number = Date.now()
): boolean {
  if (!draft) return false;
  if (now - draft.savedAt > DRAFT_MAX_AGE_MS) return false;
  return draft.snapshot !== serverSnapshot;
}
