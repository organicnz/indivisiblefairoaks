'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';

/**
 * Error boundary for the visual editor overlay.
 *
 * The overlay is a non-essential surface: an admin tool that overlays a page
 * that renders fine without it. A render error in the overlay — a malformed
 * block, an unexpected null, a DOM mutation the overlay did not expect —
 * should not take the page down with it.
 *
 * It must still say what happened. A silent `null` in production left the
 * operator looking at a page that invited them to click blocks, with no editor
 * listening. The page is unaffected, so the fallback states that and offers the
 * one action that can restore the editor: a reload. The composer workspace
 * also listens for `VISUAL_EDIT_EVENTS.crashed` and mirrors the state in its
 * readiness strip.
 */

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class VisualEditErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    window.dispatchEvent(
      new CustomEvent(VISUAL_EDIT_EVENTS.crashed, {
        detail: { message: error.message },
      })
    );

    // Log to the console only in development — production errors are
    // reported by the Sentry instrumentation that wraps the app.
    if (process.env.NODE_ENV !== 'production') {
      console.error('Visual editor crashed:', error, info.componentStack);
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const detail =
      process.env.NODE_ENV !== 'production' ? this.state.error?.message?.trim() : null;

    return (
      <div
        role="alert"
        data-testid="visual-edit-error"
        className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[10000] mx-auto max-w-md border border-rose-500/40 bg-surface-card p-4 text-foreground shadow-float sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0 text-rose-500"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold leading-tight">
              Visual editor stopped unexpectedly
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              The page is unaffected. Reload to try the editor again, or use the content editor at{' '}
              <a href="/admin/content" className="font-bold text-foreground underline underline-offset-2">
                Pages &amp; Posts
              </a>
              .
            </p>
            {detail ? (
              <p className="mt-2 break-words font-mono text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">
                {detail}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 inline-flex items-center gap-1.5 border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-surface-card"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Reload editor
            </button>
          </div>
        </div>
      </div>
    );
  }
}
