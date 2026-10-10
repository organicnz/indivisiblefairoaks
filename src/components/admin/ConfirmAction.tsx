'use client';

import { type ReactNode, useState } from 'react';

interface ConfirmActionProps {
  /** Idle button content — an icon, a label, or both. */
  children: ReactNode;
  /** Accessible name (and tooltip) for the idle button. */
  label: string;
  /** What the confirm step tells the author. Keep the consequence in it. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  disabled?: boolean;
  /** An async action in flight: the whole step disables. */
  busy?: boolean;
  idleClassName?: string;
  onConfirm: () => void;
}

/**
 * A destructive action in two honest steps.
 *
 * `window.confirm()` asks a blind question — "are you sure?" about something
 * the dialog never names — and it cannot be automated, so every path behind
 * one goes untested. This renders the idle control, then replaces it with the
 * consequence and an explicit Confirm/Cancel pair. The `fieldset`/`legend`
 * grouping is what keeps Biome's a11y rule quiet without a suppression.
 */
export function ConfirmAction({
  children,
  label,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  disabled = false,
  busy = false,
  idleClassName,
  onConfirm,
}: ConfirmActionProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={disabled || busy}
        aria-label={label}
        title={label}
        className={idleClassName}
      >
        {children}
      </button>
    );
  }

  return (
    <fieldset disabled={busy} className="inline-flex flex-wrap items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <span className="text-xs font-medium text-muted-foreground">{message}</span>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 ${
          danger ? 'bg-accent-red hover:bg-red-700' : 'bg-primary hover:bg-primary-dark'
        }`}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-surface-card focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
      >
        {cancelLabel}
      </button>
    </fieldset>
  );
}
