'use client';

import { type MouseEvent, type ReactNode, useRef } from 'react';
import { useFocusTrap } from './useFocusTrap';

const BACKDROP_CLASS =
  'fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in overscroll-contain touch-manipulation';
const PANEL_CLASS =
  'w-full max-w-sm rounded-2xl border border-white/20 bg-secondary p-5 shadow-2xl text-ink-on-dark space-y-4';

interface ModalDialogBaseProps {
  backdropClassName?: string;
  children: ReactNode;
  describedBy?: string;
  onDismiss: () => void;
  panelClassName?: string;
  testId: string;
}

type ModalDialogProps = ModalDialogBaseProps &
  (
    | { ariaLabel: string; labelledBy?: never }
    | { ariaLabel?: never; labelledBy: string }
  );

/**
 * A modal with a real keyboard boundary.
 *
 * Declaring `aria-modal` does not move focus or stop Tab from walking into the
 * page behind the dialog. This primitive does both: it focuses the first
 * action (or the element marked `data-autofocus`), wraps Tab at either end,
 * owns Escape, and returns focus to the opener when it closes.
 */
export function ModalDialog({
  ariaLabel,
  backdropClassName,
  children,
  describedBy,
  labelledBy,
  onDismiss,
  panelClassName,
  testId,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = useFocusTrap({ containerRef: dialogRef, onDismiss });

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onDismiss();
  };

  return (
    <div
      ref={dialogRef}
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      className={backdropClassName ?? BACKDROP_CLASS}
    >
      <div className={panelClassName ?? PANEL_CLASS}>{children}</div>
    </div>
  );
}
