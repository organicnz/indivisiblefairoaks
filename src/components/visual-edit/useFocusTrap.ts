'use client';

import { type KeyboardEvent, type RefObject, useEffect } from 'react';
import { focusEditorFallback, getFocusableElements } from './focusable';

interface FocusTrapOptions<T extends HTMLElement> {
  containerRef: RefObject<T | null>;
  onDismiss: () => void;
  /**
   * Set false when the dialog's action returns focus somewhere specific, such
   * as the editor with its captured selection. The trap still contains Tab and
   * owns Escape; it just does not pull focus back to the opener afterwards.
   */
  restoreFocus?: boolean;
}

/**
 * Keep keyboard focus inside a mounted dialog and return it when the dialog
 * closes. This is the behavior `aria-modal` promises but does not provide.
 */
export function useFocusTrap<T extends HTMLElement>({
  containerRef,
  onDismiss,
  restoreFocus = true,
}: FocusTrapOptions<T>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
    const focusable = getFocusableElements(container);
    const preferred = focusable.find((element) => element.hasAttribute('data-autofocus'));
    (preferred ?? focusable[0] ?? container).focus();

    return () => {
      if (!restoreFocus) return;
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
        return;
      }
      focusEditorFallback();
    };
  }, [containerRef, restoreFocus]);

  return (event: KeyboardEvent<T>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
      return;
    }

    if (event.key !== 'Tab') return;
    const container = containerRef.current;
    if (!container) return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (!event.shiftKey && (active === last || !container.contains(active))) {
      event.preventDefault();
      first.focus();
      return;
    }

    if (event.shiftKey && (active === first || !container.contains(active))) {
      event.preventDefault();
      last.focus();
    }
  };
}
