'use client';

import { Component, type ReactNode } from 'react';

/**
 * Error boundary for the visual editor overlay.
 *
 * The overlay is a non-essential surface: an admin tool that overlays a page
 * that renders fine without it. A render error in the overlay — a malformed
 * block, an unexpected null, a DOM mutation the overlay did not expect —
 * should not take the page down with it.
 *
 * In production the fallback is silent (nothing renders). In development the
 * error message is shown so the developer can see what happened without
 * opening the console.
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
    // Log to the console only in development — production errors are
    // reported by the Sentry instrumentation that wraps the app.
    if (process.env.NODE_ENV !== 'production') {
      console.error('Visual editor crashed:', error, info.componentStack);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (process.env.NODE_ENV !== 'production') {
        return (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-rose-500/40 bg-rose-950/95 px-4 py-2 text-xs font-bold text-rose-300 shadow-float">
            Visual editor failed to load — the page works fine without it. Check the console for
            details.
          </div>
        );
      }
      return null;
    }
    return this.props.children;
  }
}
