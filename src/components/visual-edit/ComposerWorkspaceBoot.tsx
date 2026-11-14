'use client';

import { AlertTriangle, Check, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { setVisualEditMode } from '@/components/layout/visual-edit-store';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';

/**
 * Turn visual editing on for the dedicated composer route.
 *
 * The mode is normally an explicit choice made from the site header, and it is
 * persisted. A workspace whose whole purpose is editing should not open in a
 * read-only state and ask the operator to find a toggle first — and a link that
 * carried `?visual-edit=1` would lose the mode on a refresh that dropped the
 * query. Setting the store is the same action the header's toggle performs, so
 * leaving the workspace keeps the mode on exactly as it would after a manual
 * toggle.
 *
 * The route also needs to say whether the editor actually arrived. The overlay
 * is lazy-loaded and the CMS read happens after that, so the page used to tell
 * the operator to click blocks before there was anything listening. This strip
 * follows both steps — overlay mounted, document state published by the
 * sidebar — and reports a crash or a failure to start. It is deliberately
 * small: readiness is a status, not a second editing surface.
 */

const OVERLAY_SELECTOR = '[data-testid="visual-edit-overlay"]';
const ERROR_SELECTOR = '[data-testid="visual-edit-error"]';
const START_TIMEOUT_MS = 12_000;
/**
 * Longer than the overlay's own document timeout, so a hung read is reported
 * as a recoverable document failure before this strip calls the whole editor
 * unavailable. This is the last-resort state for an overlay that mounted but
 * never published any document state at all.
 */
const DOCUMENT_TIMEOUT_MS = 25_000;

type ReadinessState =
  | 'starting'
  | 'slow'
  | 'loading'
  | 'ready'
  | 'degraded'
  | 'unavailable'
  | 'crashed'
  | 'closed';

function overlayState(): string | null {
  return document.querySelector<HTMLElement>(OVERLAY_SELECTOR)?.getAttribute(
    'data-document-state'
  ) ?? null;
}

export function ComposerWorkspaceBoot() {
  const [state, setState] = useState<ReadinessState>('starting');
  const stateRef = useRef(state);
  stateRef.current = state;
  const seenOverlayRef = useRef(false);
  const overlayElementRef = useRef<Element | null>(null);
  const crashedRef = useRef(false);
  const lastDocumentStateRef = useRef<string | null>(null);
  const timedOutRef = useRef(false);
  const reopeningRef = useRef(false);
  const reopenTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setVisualEditMode(true);
  }, []);

  useEffect(() => {
    let documentTimeout = 0;

    const onDocumentTimeout = () => {
      if (crashedRef.current) return;
      if (!seenOverlayRef.current) {
        setState('unavailable');
        return;
      }
      const current = stateRef.current;
      if (current === 'ready' || current === 'degraded' || current === 'closed') return;
      // Remember the timeout. The body observer fires on every readiness
      // render; without this, its next "still loading" sync immediately undid
      // the unavailable state and the strip waited forever.
      timedOutRef.current = true;
      setState('unavailable');
    };

    /**
     * Start this attempt's clock when the overlay actually appears, not when
     * the page mounted. A slow auth check or lazy chunk can take longer than
     * the document timeout; charging that wait to the document made a late
     * editor look unavailable the moment it arrived.
     */
    const restartDocumentTimeout = () => {
      window.clearTimeout(documentTimeout);
      documentTimeout = window.setTimeout(onDocumentTimeout, DOCUMENT_TIMEOUT_MS);
    };

    const sync = () => {
      if (crashedRef.current) return;

      if (document.querySelector(ERROR_SELECTOR)) {
        crashedRef.current = true;
        setState('crashed');
        return;
      }

      const overlay = document.querySelector(OVERLAY_SELECTOR);
      if (!overlay) {
        overlayElementRef.current = null;
        lastDocumentStateRef.current = null;
        timedOutRef.current = false;
        // Reopening deliberately has no overlay for one commit while the store
        // update and lazy mount run. Do not turn that gap into "closed" and
        // remove the button the operator just pressed.
        if (seenOverlayRef.current && !reopeningRef.current) setState('closed');
        return;
      }

      seenOverlayRef.current = true;
      reopeningRef.current = false;
      if (reopenTimeoutRef.current !== null) {
        window.clearTimeout(reopenTimeoutRef.current);
        reopenTimeoutRef.current = null;
      }
      // A remount is a new readiness attempt. Do not let the previous
      // element's timeout suppress its first loading state.
      if (overlayElementRef.current !== overlay) {
        overlayElementRef.current = overlay;
        timedOutRef.current = false;
        restartDocumentTimeout();
      }
      const raw = overlayState();
      const previousRaw = lastDocumentStateRef.current;
      lastDocumentStateRef.current = raw;
      if (raw === 'ready') {
        timedOutRef.current = false;
        setState('ready');
      } else if (raw === 'degraded') {
        timedOutRef.current = false;
        setState('degraded');
      } else {
        // A retry moves the sidebar from degraded back to loading, and a
        // refresh moves it back from ready. Both are new read attempts, so
        // they get their own last-resort clock; charging a retry to the
        // previous attempt's deadline can call a healthy reload unavailable
        // seconds after it starts. Any other loading mutation after the
        // timeout is the same hung read and must not overwrite that timeout.
        if (previousRaw === 'ready' || previousRaw === 'degraded') {
          timedOutRef.current = false;
          restartDocumentTimeout();
        }
        if (!timedOutRef.current) setState('loading');
      }
    };

    const onCrash = () => {
      crashedRef.current = true;
      setState('crashed');
    };

    window.addEventListener(VISUAL_EDIT_EVENTS.crashed, onCrash);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-document-state'],
    });

    documentTimeout = window.setTimeout(onDocumentTimeout, DOCUMENT_TIMEOUT_MS);
    sync();

    const mountTimeout = window.setTimeout(() => {
      if (crashedRef.current || seenOverlayRef.current) return;
      // A large lazy chunk on a slow connection is not a failure yet. Keep the
      // spinner honest and let the longer timeout below make the final call.
      setState('slow');
    }, START_TIMEOUT_MS);

    return () => {
      window.removeEventListener(VISUAL_EDIT_EVENTS.crashed, onCrash);
      observer.disconnect();
      window.clearTimeout(mountTimeout);
      window.clearTimeout(documentTimeout);
      if (reopenTimeoutRef.current !== null) {
        window.clearTimeout(reopenTimeoutRef.current);
        reopenTimeoutRef.current = null;
      }
    };
  }, []);

  const busy = state === 'starting' || state === 'slow' || state === 'loading';
  const failed = state === 'unavailable' || state === 'degraded' || state === 'crashed';

  return (
    <div
      data-testid="composer-readiness"
      data-state={state}
      className={`mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-y px-0.5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] ${
        failed
          ? 'border-rose-500/30 text-rose-600 dark:text-rose-400'
          : state === 'ready'
            ? 'border-primary/25 text-primary-ink'
            : 'border-border text-muted-foreground'
      }`}
    >
      {busy ? (
        <Loader2 size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : failed ? (
        <AlertTriangle size={13} aria-hidden="true" />
      ) : state === 'ready' ? (
        <Check size={13} aria-hidden="true" />
      ) : (
        <RefreshCw size={13} aria-hidden="true" />
      )}
      <span role="status" aria-live="polite">
        {state === 'starting' && 'Starting the visual editor…'}
        {state === 'slow' && 'Still starting the visual editor…'}
        {state === 'loading' && 'Opening the saved document…'}
        {state === 'ready' && 'Editor ready'}
        {state === 'degraded' &&
          'Editor open — the saved document could not be read. Reload before editing.'}
        {state === 'unavailable' &&
          'The editor did not finish opening. The page is viewable; reload to try again.'}
        {state === 'crashed' &&
          'The editor stopped unexpectedly. The page is unaffected; reload to restore it.'}
        {state === 'closed' && 'Editor closed. Reopen it to continue editing this row.'}
      </span>
      {state === 'closed' ? (
        <button
          type="button"
          onClick={() => {
            reopeningRef.current = true;
            setState('starting');
            setVisualEditMode(true);
            if (reopenTimeoutRef.current !== null) {
              window.clearTimeout(reopenTimeoutRef.current);
            }
            reopenTimeoutRef.current = window.setTimeout(() => {
              if (document.querySelector(OVERLAY_SELECTOR)) return;
              reopeningRef.current = false;
              setState('unavailable');
            }, START_TIMEOUT_MS);
          }}
          className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-surface-muted"
        >
          Reopen editor
        </button>
      ) : failed ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1 border border-rose-500/30 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-700 transition-colors hover:bg-rose-500/10 dark:text-rose-300"
        >
          <RefreshCw size={11} aria-hidden="true" />
          Reload
        </button>
      ) : null}
    </div>
  );
}
