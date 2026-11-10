'use client';

import {
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';

const ROVING_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

function toolbarButtons(container: HTMLElement | null) {
  return container ? Array.from(container.querySelectorAll<HTMLButtonElement>('button')) : [];
}

function enabledButtons(container: HTMLElement | null) {
  return toolbarButtons(container).filter((button) => !button.disabled);
}

interface RovingToolbarProps {
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * A horizontal toolbar with one tab stop and a roving focus target.
 *
 * The buttons are discovered from the DOM rather than supplied as a list
 * because toolbars such as the floating block pill add and remove controls
 * based on the selected block type. Re-syncing after every render keeps that
 * dynamic set correct without asking every call site to maintain an index.
 */
export function RovingToolbar({ label, className, children }: RovingToolbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);

  const syncTabStops = useCallback(() => {
    const buttons = enabledButtons(containerRef.current);
    if (buttons.length === 0) {
      toolbarButtons(containerRef.current).forEach((button) => {
        button.tabIndex = -1;
      });
      return;
    }
    if (activeIndexRef.current >= buttons.length) activeIndexRef.current = 0;
    const active = buttons[activeIndexRef.current];
    toolbarButtons(containerRef.current).forEach((button) => {
      button.tabIndex = button === active ? 0 : -1;
    });
  }, []);

  useLayoutEffect(() => {
    syncTabStops();
  });

  const handleFocus = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const buttons = enabledButtons(containerRef.current);
      const index = buttons.indexOf(target);
      if (index === -1) return;
      activeIndexRef.current = index;
      syncTabStops();
    },
    [syncTabStops]
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!ROVING_KEYS.has(event.key)) return;
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const buttons = enabledButtons(containerRef.current);
      const index = buttons.indexOf(target);
      if (index === -1) return;

      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else next = buttons.length - 1;

      event.preventDefault();
      event.stopPropagation();
      activeIndexRef.current = next;
      syncTabStops();
      buttons[next]?.focus();
    },
    [syncTabStops]
  );

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      className={className}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
