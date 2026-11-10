/**
 * The elements a Tab press can reach inside a contained surface.
 *
 * Keep this list in one place: the composer and the modal confirmations must
 * agree on what counts as a keyboard stop, or focus can escape through a
 * control one of them forgot.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

export const EDITOR_FOCUS_FALLBACK_ATTR = 'data-editor-focus-fallback';

/**
 * Put focus on the editor's stable fallback when the element that opened a
 * surface has been detached. Returns whether focus actually moved.
 */
export function focusEditorFallback(): boolean {
  const fallback = document.querySelector<HTMLElement>(`[${EDITOR_FOCUS_FALLBACK_ATTR}]`);
  if (!fallback?.isConnected) return false;
  fallback.focus({ preventScroll: true });
  return document.activeElement === fallback;
}

/** Visible, keyboard-reachable descendants of `root`, in document order. */
export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element.tabIndex !== -1 && !element.closest('[aria-hidden="true"], [hidden]')
  );
}
