'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { VisualComposerMode, VisualComposerThemeMode } from '@/types/unified';

/**
 * The composer's draft, painted onto the live page.
 *
 * The panel used to describe a design in a miniature frame and leave the page
 * alone until Save. That is a preview of the *controls*, not of the page: a
 * heading that wraps differently at the real column width, a callout whose
 * shadow meets the section behind it, a badge that collides with a neighbouring
 * element — none of those are visible in a 380px facsimile. WordPress's visual
 * composers are remembered for the opposite: you tune, and the page answers.
 *
 * So the draft is applied to the block's real wrapper while the composer is
 * open. Three rules keep that from being dangerous:
 *
 *  1. **Nothing is written.** The DOM is the only thing touched; the block
 *     model, the autosave and the dirty flag are unchanged, so closing with
 *     "Discard" leaves no trace.
 *  2. **The original attributes are captured first.** Class, inline style and
 *     theme are stored exactly as they were and put back byte-for-byte on
 *     discard, close, navigation, or unmount. A preview that "cleans up" by
 *     removing classes it added would still lose a class it failed to notice;
 *     restoring the captured string cannot.
 *  3. **A successful apply converts the preview into the page's state.** The
 *     captured attributes are replaced with the applied ones and the entry is
 *     marked committed, so closing no longer reverts a design that was just
 *     saved. Without that, the page would snap back to its old look for the two
 *     seconds between Apply and the autosave's refresh.
 *
 * Structural `cw-*` classes are preserved on purpose. They are how the block
 * parser recognises a callout or a table; they belong to the page, not to the
 * design, and the overlay's save path reattaches them for the same reason.
 */

export interface ComposerDraftPreview {
  mode: VisualComposerMode;
  blockIndexes: readonly number[];
  /** The compiled class list for the draft, without structural classes. */
  classes: string;
  /** Inline CSS from the Code tab, or an empty string. */
  style: string;
  themeMode: VisualComposerThemeMode;
}

interface AppliedPreview {
  index: number;
  element: HTMLElement;
  classAttr: string | null;
  styleAttr: string | null;
  themeAttr: string | null;
  themeModeAttr: string | null;
  /** Tokens this preview added on top of the element's own markup. */
  paintedClasses: string[];
  /** True once the design was applied for real; the saved attrs are then the
   *  applied ones, so restoring them is a no-op rather than a rollback. */
  committed: boolean;
}

/**
 * How the save path will attach the design to a block.
 *
 * `replace` is a block already wrapped in its own `<div>`: the overlay rewrites
 * that wrapper's `class`, so the preview does exactly the same thing.
 *
 * `wrap` is a plain `<h2>` or `<p>`: the save leaves the element's own classes
 * alone and wraps a new `<div>` around it. Wrapping live DOM nodes would move
 * the element out from under `locate()` and the section list, so the preview
 * adds the design tokens to the element instead and never removes what the site
 * put there. It is the closest faithful shape that is also non-destructive.
 */
type PreviewShell = 'replace' | 'wrap';

interface SavedAttrs {
  classAttr: string | null;
  styleAttr: string | null;
  themeAttr: string | null;
  themeModeAttr: string | null;
}

const PREVIEW_ATTR = 'data-vc-draft-preview';

function readAttrs(element: HTMLElement): SavedAttrs {
  return {
    classAttr: element.getAttribute('class'),
    styleAttr: element.getAttribute('style'),
    themeAttr: element.getAttribute('data-theme'),
    themeModeAttr: element.getAttribute('data-theme-mode'),
  };
}

function writeOrRemove(element: HTMLElement, name: string, value: string | null) {
  if (value === null || value === '') element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/** Put one element back exactly as it was captured. */
function restoreAttrs(element: HTMLElement, attrs: SavedAttrs) {
  writeOrRemove(element, 'class', attrs.classAttr);
  writeOrRemove(element, 'style', attrs.styleAttr);
  writeOrRemove(element, 'data-theme', attrs.themeAttr);
  writeOrRemove(element, 'data-theme-mode', attrs.themeModeAttr);
  element.removeAttribute(PREVIEW_ATTR);
}

/** Dedupe while keeping the first occurrence; class order is not semantic. */
function uniqueTokens(tokens: readonly string[]): string[] {
  return [...new Set(tokens.filter(Boolean))];
}

function paint(
  entry: AppliedPreview,
  draft: ComposerDraftPreview,
  structural: string,
  shell: PreviewShell
) {
  const { element } = entry;
  const draftTokens = draft.classes.split(/\s+/).filter(Boolean);
  const structuralTokens = structural.split(/\s+/).filter(Boolean);

  const classes =
    shell === 'replace'
      ? uniqueTokens([...draftTokens, ...structuralTokens])
      : uniqueTokens([
          // The element's own markup, minus whatever the previous preview added
          // to it — otherwise a second draft would leave the first one's
          // utilities stacked underneath it, and CSS order would pick the
          // winner rather than the operator.
          ...(entry.classAttr ?? '')
            .split(/\s+/)
            .filter((token) => token && !entry.paintedClasses.includes(token)),
          ...draftTokens,
          ...structuralTokens,
        ]);

  writeOrRemove(element, 'class', classes.join(' '));
  /*
   * Inline CSS belongs to the wrapper the save creates, not to the heading it
   * wraps; putting it on the element itself would change layout (`display`, a
   * transform) in a way the saved page would not. The class changes still
   * preview the design, and the Code tab's own live sample covers the rest.
   */
  writeOrRemove(element, 'style', shell === 'replace' ? draft.style.trim() : entry.styleAttr);

  entry.paintedClasses =
    shell === 'replace' ? [] : uniqueTokens([...draftTokens, ...structuralTokens]);

  // Mirror the save path: one theme attribute, and the other one clears.
  if (draft.themeMode === 'dark' || draft.themeMode === 'light') {
    element.setAttribute('data-theme', draft.themeMode);
    element.removeAttribute('data-theme-mode');
  } else if (draft.themeMode === 'system') {
    element.removeAttribute('data-theme');
    element.setAttribute('data-theme-mode', 'system');
  } else {
    element.removeAttribute('data-theme');
    element.removeAttribute('data-theme-mode');
  }

  element.setAttribute(PREVIEW_ATTR, 'true');
}

export interface UseComposerPagePreviewOptions {
  /** The block's rendered element, or null when it has none. */
  resolveElement: (blockIndex: number) => HTMLElement | null;
  /** The block's own `cw-*` classes, which the page owns. */
  structuralClassesOf: (blockIndex: number) => string;
  /** Whether the save will replace its wrapper or wrap the element. */
  shellOf: (blockIndex: number) => PreviewShell;
}

export interface ComposerPagePreviewControls {
  /** Paint a draft, or clear the preview with `null`. */
  applyDraft: (draft: ComposerDraftPreview | null) => void;
  /** The draft was applied for real: keep it, and treat it as the new base. */
  commitDraft: (blockIndexes: readonly number[]) => void;
  /** Restore every previewed element. Safe to call more than once. */
  clearDraft: () => void;
}

export function useComposerPagePreview({
  resolveElement,
  structuralClassesOf,
  shellOf,
}: UseComposerPagePreviewOptions): ComposerPagePreviewControls {
  const appliedRef = useRef<Map<HTMLElement, AppliedPreview>>(new Map());

  // The callbacks are read at call time rather than captured, so the returned
  // controls stay stable across the overlay's re-renders — the inspector holds
  // them in an effect dependency, and a new identity every render would repaint
  // on every keystroke.
  const resolveRef = useRef(resolveElement);
  resolveRef.current = resolveElement;
  const structuralRef = useRef(structuralClassesOf);
  structuralRef.current = structuralClassesOf;
  const shellRef = useRef(shellOf);
  shellRef.current = shellOf;

  const clearDraft = useCallback(() => {
    for (const entry of appliedRef.current.values()) {
      restoreAttrs(entry.element, entry);
    }
    appliedRef.current.clear();
  }, []);

  const applyDraft = useCallback(
    (draft: ComposerDraftPreview | null) => {
      const applied = appliedRef.current;

      // An element React has replaced (a refresh, a revision) is no longer the
      // page; dropping it here stops a detached node from pinning memory until
      // the panel closes.
      for (const [element] of applied) {
        if (!element.isConnected) applied.delete(element);
      }

      if (!draft) {
        clearDraft();
        return;
      }

      const keep = new Set(draft.blockIndexes);

      // A non-committed preview that is no longer in scope — the panel moved to
      // another block — goes back to the page's design.
      for (const [element, entry] of applied) {
        if (!entry.committed && !keep.has(entry.index)) {
          restoreAttrs(element, entry);
          applied.delete(element);
        }
      }

      for (const index of draft.blockIndexes) {
        const element = resolveRef.current(index);
        if (!element) continue;

        let entry = applied.get(element);
        if (entry && entry.index !== index) {
          // The same element now addresses a different block. Put the old base
          // back before recapturing, or the recapture would treat a stale
          // preview as the page's own markup.
          restoreAttrs(element, entry);
          applied.delete(element);
          entry = undefined;
        }
        if (!entry) {
          entry = {
            index,
            element,
            ...readAttrs(element),
            paintedClasses: [],
            committed: false,
          };
          applied.set(element, entry);
        }

        /*
         * Painting over a committed entry keeps its saved attributes: they are
         * the design that was applied, which is exactly what a subsequent
         * Discard should return to. The entry only becomes a draft again.
         */
        entry.committed = false;
        paint(entry, draft, structuralRef.current(index), shellRef.current(index));
      }
    },
    [clearDraft]
  );

  const commitDraft = useCallback((blockIndexes: readonly number[]) => {
    const keep = new Set(blockIndexes);
    for (const entry of appliedRef.current.values()) {
      if (!keep.has(entry.index)) continue;
      // The applied attributes become the thing a later discard restores to.
      const current = readAttrs(entry.element);
      entry.classAttr = current.classAttr;
      entry.styleAttr = current.styleAttr;
      entry.themeAttr = current.themeAttr;
      entry.themeModeAttr = current.themeModeAttr;
      entry.committed = true;
      entry.element.removeAttribute(PREVIEW_ATTR);
    }
  }, []);

  // Unmount is the last exit that has no button: the overlay can disappear with
  // the panel still open (a route change, an admin signing out). An unapplied
  // preview must not outlive it.
  useEffect(
    () => () => {
      clearDraft();
    },
    [clearDraft]
  );

  return { applyDraft, commitDraft, clearDraft };
}
