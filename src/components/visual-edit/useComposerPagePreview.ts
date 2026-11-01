'use client';

import { useCallback, useEffect, useRef } from 'react';
import { isStructuralBlockClass } from '@/lib/blocks/structural';
import { themeAttributesFor } from '@/lib/blocks/theme';
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
 * So the draft is applied to the block's own root while the composer is open. Three rules keep that from being dangerous:
 *
 *  1. **Nothing is written.** The DOM is the only thing touched; the block
 *     model, the autosave and the dirty flag are unchanged, so closing with
 *     "Discard" leaves no trace.
 *  2. **The original markup is captured first.** Class, inline style, theme and
 *     the element's inner HTML are stored exactly as they were and put back
 *     byte-for-byte on discard, close, navigation, or unmount. A preview that
 *     "cleans up" by removing classes it added would still lose a class it
 *     failed to notice; restoring the captured string cannot.
 *  3. **A successful apply converts the preview into the page's state.** The
 *     captured attributes and markup are replaced with the applied ones and the
 *     entry is marked committed, so closing no longer reverts a design or a
 *     sentence that was just saved. Without that, the page would snap back for
 *     the two seconds between Apply and the autosave's refresh.
 *
 * Copy is painted too. A heading's text and a badge live in the block's HTML,
 * so a composer that only previewed the design would let an operator retype a
 * headline in the panel while the page, and the banner claiming the page is the
 * preview, went on showing the old one. WPBakery-class editors edit and see the
 * real thing; so does this one.
 *
 * Structural `cw-*` classes are preserved on purpose. They are how the block
 * parser recognises a callout or a table; they belong to the page, not to the
 * design, and the overlay's save path reattaches them for the same reason.
 */

export interface ComposerDraftPreview {
  mode: VisualComposerMode;
  blockIndexes: readonly number[];
  /**
   * The design to paint, or null when only the copy changed.
   *
   * A copy edit is not a design edit: opening a block and retyping its text
   * must not restyle it with the editor's defaults. The split is what lets the
   * page show the new sentence without also showing a design nobody chose.
   */
  design: {
    /** The compiled class list for the draft, without structural classes. */
    classes: string;
    /** Inline CSS from the Code tab, or an empty string. */
    style: string;
    themeMode: VisualComposerThemeMode;
  } | null;
  /**
   * The block's copy as the save would write it, or null when this draft does
   * not touch copy — a batch styles many blocks and must not copy one block's
   * text onto the rest, and section mode has no content fields.
   */
  contentHtml: string | null;
}

interface AppliedPreview {
  index: number;
  element: HTMLElement;
  classAttr: string | null;
  styleAttr: string | null;
  themeAttr: string | null;
  themeModeAttr: string | null;
  /** The element's markup before the first copy preview. */
  innerHtml: string;
  /** True while this entry's copy, not the page's, is inside the element. */
  paintedContent: boolean;
  /** True once the design was applied for real; the saved attrs are then the
   *  applied ones, so restoring them is a no-op rather than a rollback. */
  committed: boolean;
}

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
function restorePreview(entry: AppliedPreview) {
  if (entry.paintedContent) {
    entry.element.innerHTML = entry.innerHtml;
    entry.paintedContent = false;
  }
  restoreDesign(entry);
  entry.element.removeAttribute(PREVIEW_ATTR);
}

/** Dedupe while keeping the first occurrence; class order is not semantic. */
function uniqueTokens(tokens: readonly string[]): string[] {
  return [...new Set(tokens.filter(Boolean))];
}

function paintDesign(
  entry: AppliedPreview,
  design: NonNullable<ComposerDraftPreview['design']>,
  structural: string,
  preserveRootClasses: boolean
) {
  const { element } = entry;
  // Same split the serializer uses: a `cw-*` token is the block's type, never
  // the design, even if it was typed into the custom-class field.
  const draftTokens = design.classes
    .split(/\s+/)
    .filter((token) => token && !isStructuralBlockClass(token));
  const structuralTokens = structural.split(/\s+/).filter(Boolean);

  /*
   * The block's own root carries exactly this list when it is saved: the design
   * utilities, then the structural `cw-*` classes the type owns. Replacing the
   * root's class list is therefore not a simplification — it is the preview
   * being the save.
   *
   * `unsupported` is the one exception, and it is the honest one: its save puts
   * the design on a new wrapper around markup the model does not own, and moving
   * the live node into a wrapper would take it out from under the section
   * pairing. The preview preserves that element's own classes instead of
   * stripping them, and leaves inline CSS alone for the same reason.
   */
  const classes = preserveRootClasses
    ? uniqueTokens([
        ...(entry.classAttr ?? '').split(/\s+/).filter(Boolean),
        ...draftTokens,
        ...structuralTokens,
      ])
    : uniqueTokens([...draftTokens, ...structuralTokens]);

  writeOrRemove(element, 'class', classes.join(' '));
  // Inline CSS lives on the same root in the saved markup, so it gets the same
  // element here. Anything else would preview a layout the page will not have.
  writeOrRemove(element, 'style', preserveRootClasses ? entry.styleAttr : design.style.trim());

  // Mirror the save path from the save's own mapping: one theme attribute, and
  // the other one clears.
  const theme = themeAttributesFor(design.themeMode);
  if (theme) {
    element.setAttribute(theme.name, theme.value);
    element.removeAttribute(theme.name === 'data-theme' ? 'data-theme-mode' : 'data-theme');
  } else {
    element.removeAttribute('data-theme');
    element.removeAttribute('data-theme-mode');
  }
}

/** Put the page's own design attributes back, keeping any copy preview. */
function restoreDesign(entry: AppliedPreview) {
  writeOrRemove(entry.element, 'class', entry.classAttr);
  writeOrRemove(entry.element, 'style', entry.styleAttr);
  writeOrRemove(entry.element, 'data-theme', entry.themeAttr);
  writeOrRemove(entry.element, 'data-theme-mode', entry.themeModeAttr);
}

/**
 * Paint one entry for a draft: design if it has one, copy if it has one.
 *
 * The two are independent on purpose. A copy-only draft leaves the element's
 * classes exactly as the page has them, and a later design draft can land on
 * top of painted copy without recapturing it as the page's own markup.
 */
function paint(
  entry: AppliedPreview,
  draft: ComposerDraftPreview,
  structural: string,
  preserveRootClasses: boolean
) {
  if (draft.design) paintDesign(entry, draft.design, structural, preserveRootClasses);
  else restoreDesign(entry);

  /*
   * The copy, including the draft badge. The save writes this same markup
   * inside the block's shell, so the page, the mini preview and the eventual
   * write cannot disagree about a heading's text. Null means the draft does not
   * touch copy, and a copy preview from an earlier draft goes back first.
   */
  if (draft.contentHtml !== null) {
    entry.element.innerHTML = draft.contentHtml;
    entry.paintedContent = true;
  } else if (entry.paintedContent) {
    entry.element.innerHTML = entry.innerHtml;
    entry.paintedContent = false;
  }

  if (draft.design || draft.contentHtml !== null) entry.element.setAttribute(PREVIEW_ATTR, 'true');
  else entry.element.removeAttribute(PREVIEW_ATTR);
}

export interface UseComposerPagePreviewOptions {
  /** The block's rendered element, or null when it has none. */
  resolveElement: (blockIndex: number) => HTMLElement | null;
  /** The block's own `cw-*` classes, which the page owns. */
  structuralClassesOf: (blockIndex: number) => string;
  /**
   * Keep the element's own classes instead of substituting the saved list.
   * Only `unsupported` needs it: its save wraps markup the model cannot move.
   */
  preserveRootClasses?: (blockIndex: number) => boolean;
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
  preserveRootClasses = () => false,
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
  const preserveRef = useRef(preserveRootClasses);
  preserveRef.current = preserveRootClasses;

  const clearDraft = useCallback(() => {
    for (const entry of appliedRef.current.values()) {
      restorePreview(entry);
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
          restorePreview(entry);
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
          restorePreview(entry);
          applied.delete(element);
          entry = undefined;
        }
        if (!entry) {
          entry = {
            index,
            element,
            ...readAttrs(element),
            innerHtml: element.innerHTML,
            paintedContent: false,
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
        paint(entry, draft, structuralRef.current(index), preserveRef.current(index));
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
      entry.innerHtml = entry.element.innerHTML;
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
