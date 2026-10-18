'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  applyThemeAttribute,
  type EffectiveTheme,
  isThemeMode,
  nextThemeMode,
  playThemeHaptic,
  prevThemeMode,
  readThemeMode,
  resolveEffectiveTheme,
  THEME_STORAGE_KEY,
  type ThemeMode,
  writeThemeMode,
} from '@/lib/theme';

/**
 * The shared, persisted theme mode.
 *
 * An external store rather than context for the same reason the visual-edit
 * store is one: the state is written by the header toggle, read by the drawer
 * toggle and read by the toaster, whose only common ancestor is the root
 * layout — a Server Component. Threading a client provider through the whole
 * app for one enum is a poor trade for what it buys.
 *
 * `useSyncExternalStore` gives a snapshot that is consistent within a render,
 * so the two toggles cannot disagree about which mode is active.
 *
 * **The document attribute is applied here and in the bootstrap script, and
 * neither is the source of truth for the other.** The script (see
 * `lib/theme.ts`) runs before first paint to prevent a flash; this store keeps
 * the attribute current as the mode or the OS setting changes. They agree by
 * construction because both resolve through `resolveEffectiveTheme`.
 */

interface ThemeState {
  mode: ThemeMode;
  effective: EffectiveTheme;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  try {
    return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * Module initialization reads the real preference on the client and defaults
 * on the server. `useSyncExternalStore` uses the server snapshot during
 * hydration and this value afterwards, so an SSR pass in a dark-OS browser
 * hydrates without a mismatch while still converging on the right palette the
 * moment it mounts — the reader has seen the correct palette since the
 * bootstrap script ran, so nothing they can see ever flickers.
 */
function readInitialState(): ThemeState {
  const mode = readThemeMode(storage());
  return { mode, effective: resolveEffectiveTheme(mode, prefersDark()) };
}

let state: ThemeState = readInitialState();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function replaceState(next: ThemeState): void {
  if (next.mode === state.mode && next.effective === state.effective) return;
  state = next;
  emit();
}

/**
 * Reconcile storage against the current state and apply the palette.
 *
 * Storage wins when it holds a valid value — the URL-independent counterpart
 * of the visual-edit store's rule, so a preference left by another tab is
 * adopted rather than silently overwritten by this one's default.
 */
export function syncTheme(): ThemeState {
  if (typeof window === 'undefined') return state;
  const mode = readThemeMode(storage());
  const next: ThemeState = { mode, effective: resolveEffectiveTheme(mode, prefersDark()) };
  applyThemeAttribute(document.documentElement, next.effective, next.mode);
  replaceState(next);
  return next;
}

export interface ThemeCoords {
  x?: number;
  y?: number;
}

export interface ThemeHudEvent {
  mode: ThemeMode;
  effective: EffectiveTheme;
  timestamp: number;
  coords?: ThemeCoords;
  txId?: number;
}

const hudListeners = new Set<(event: ThemeHudEvent) => void>();

export function subscribeThemeHud(listener: (event: ThemeHudEvent) => void): () => void {
  hudListeners.add(listener);
  return () => {
    hudListeners.delete(listener);
  };
}

export function emitThemeHud(
  mode: ThemeMode,
  effective: EffectiveTheme,
  coords?: ThemeCoords,
  txId?: number
): void {
  const event: ThemeHudEvent = { mode, effective, timestamp: Date.now(), coords, txId };
  for (const listener of hudListeners) {
    listener(event);
  }
}

export const THEME_BROADCAST_CHANNEL = 'indivisible:theme-broadcast';

export interface ThemeBroadcastPayload {
  type: 'THEME_SYNC';
  mode: ThemeMode;
  effective: EffectiveTheme;
  coords?: ThemeCoords;
  txId: number;
  sourceId: string;
  timestamp: number;
}

const TAB_INSTANCE_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function broadcastThemeSync(
  mode: ThemeMode,
  effective: EffectiveTheme,
  coords?: ThemeCoords,
  txId?: number
): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(THEME_BROADCAST_CHANNEL);
    const payload: ThemeBroadcastPayload = {
      type: 'THEME_SYNC',
      mode,
      effective,
      coords,
      txId: txId ?? ++currentTxId,
      sourceId: TAB_INSTANCE_ID,
      timestamp: Date.now(),
    };
    channel.postMessage(payload);
    channel.close();
  } catch {
    // Suppress cross-tab communication failures
  }
}

/** Atomic sequence counter to prevent race conditions during rapid theme cycling. */
let currentTxId = 0;
let activeViewAnimation: Animation | null = null;

function resolveInteractionCoords(coords?: ThemeCoords): ThemeCoords {
  if (typeof coords?.x === 'number' && typeof coords?.y === 'number') {
    return coords;
  }
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }
  // If invoked via keyboard on an active control, center the ripple on that control
  if (
    typeof document !== 'undefined' &&
    document.activeElement &&
    document.activeElement !== document.body &&
    typeof document.activeElement.getBoundingClientRect === 'function'
  ) {
    const rect = document.activeElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
      };
    }
  }
  return {
    x: Math.round(window.innerWidth / 2),
    y: Math.round(window.innerHeight / 2),
  };
}

export function setThemeMode(
  next: ThemeMode,
  coords?: ThemeCoords,
  options?: { silent?: boolean; noHud?: boolean; noBroadcast?: boolean }
): ThemeState {
  const txId = ++currentTxId;

  // Atomically persist choice before DOM manipulation
  writeThemeMode(storage(), next);
  const resolved: ThemeState = {
    mode: next,
    effective: resolveEffectiveTheme(next, prefersDark()),
  };

  const resolvedCoords = resolveInteractionCoords(coords);

  const apply = () => {
    if (typeof window !== 'undefined') {
      applyThemeAttribute(document.documentElement, resolved.effective, resolved.mode);
    }
    replaceState(resolved);
    if (!options?.silent) {
      playThemeHaptic(next, resolved.effective, resolvedCoords);
    }
    if (!options?.noHud) {
      emitThemeHud(next, resolved.effective, resolvedCoords, txId);
    }
    if (!options?.noBroadcast) {
      broadcastThemeSync(next, resolved.effective, resolvedCoords, txId);
    }
  };

  const isReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hasViewTransition =
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition ===
      'function';

  if (hasViewTransition && !isReducedMotion) {
    // If a previous transition animation was running, cancel it atomically
    if (activeViewAnimation) {
      try {
        activeViewAnimation.cancel();
      } catch {
        // Suppress animation cancel errors
      }
      activeViewAnimation = null;
    }

    const startX = resolvedCoords.x ?? window.innerWidth / 2;
    const startY = resolvedCoords.y ?? window.innerHeight / 2;

    document.documentElement.setAttribute('data-theme-animating', 'circle');

    const cleanup = () => {
      if (currentTxId === txId) {
        document.documentElement.removeAttribute('data-theme-animating');
        activeViewAnimation = null;
      }
    };

    try {
      const transition = (
        document as unknown as {
          startViewTransition: (callback: () => void) => {
            ready?: Promise<void>;
            finished?: Promise<void>;
          };
        }
      ).startViewTransition(() => {
        apply();
      });

      if (transition?.ready) {
        transition.ready
          .then(() => {
            // Guard against stale asynchronous resolution if superseded by a newer transaction
            if (currentTxId !== txId) return;

            const endRadius = Math.hypot(
              Math.max(startX, window.innerWidth - startX),
              Math.max(startY, window.innerHeight - startY)
            );

            const anim = document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${startX}px ${startY}px)`,
                  `circle(${endRadius}px at ${startX}px ${startY}px)`,
                ],
              },
              {
                duration: 420,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                pseudoElement: '::view-transition-new(root)',
              }
            );

            activeViewAnimation = anim;
            anim.onfinish = cleanup;
            anim.oncancel = cleanup;
          })
          .catch(() => {
            cleanup();
          });
      }

      if (transition?.finished) {
        transition.finished.then(cleanup).catch(() => {
          cleanup();
        });
      } else if (!transition?.ready) {
        cleanup();
      }
    } catch {
      cleanup();
      apply();
    }
  } else {
    apply();
  }

  return resolved;
}

export function cycleThemeMode(
  directionOrCoords?: 'next' | 'prev' | ThemeCoords,
  coords?: ThemeCoords
): ThemeMode {
  let direction: 'next' | 'prev' = 'next';
  let resolvedCoords: ThemeCoords | undefined = coords;
  if (typeof directionOrCoords === 'string') {
    direction = directionOrCoords;
  } else if (directionOrCoords && typeof directionOrCoords === 'object') {
    resolvedCoords = directionOrCoords;
  }
  const next = direction === 'prev' ? prevThemeMode(state.mode) : nextThemeMode(state.mode);
  return setThemeMode(next, resolvedCoords).mode;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ThemeState {
  return state;
}

/** Server render: no storage, no OS preference, no flash to prevent. */
function getServerSnapshot(): ThemeState {
  return { mode: 'system', effective: 'light' };
}

/**
 * The current mode, the palette it resolved to, and the two ways to change it.
 *
 * The effect is what makes the attribute authoritative after mount: reading
 * the resolved value without it would leave the document on whatever the
 * bootstrap script last wrote until the next toggle.
 */
export function useThemeMode(): {
  mode: ThemeMode;
  effective: EffectiveTheme;
  setMode: (
    mode: ThemeMode,
    eventOrCoords?:
      | React.MouseEvent
      | MouseEvent
      | { clientX?: number; clientY?: number; x?: number; y?: number }
  ) => void;
  cycle: (
    directionOrEvent?:
      | 'next'
      | 'prev'
      | React.MouseEvent
      | MouseEvent
      | { clientX?: number; clientY?: number; x?: number; y?: number },
    eventOrCoords?:
      | React.MouseEvent
      | MouseEvent
      | { clientX?: number; clientY?: number; x?: number; y?: number }
  ) => void;
} {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setMode = useCallback(
    (
      mode: ThemeMode,
      eventOrCoords?:
        | React.MouseEvent
        | MouseEvent
        | { clientX?: number; clientY?: number; x?: number; y?: number }
    ) => {
      let coords: ThemeCoords | undefined;
      if (eventOrCoords) {
        if ('clientX' in eventOrCoords && typeof eventOrCoords.clientX === 'number') {
          coords = { x: eventOrCoords.clientX, y: eventOrCoords.clientY };
        } else if ('x' in eventOrCoords && typeof eventOrCoords.x === 'number') {
          coords = { x: eventOrCoords.x, y: eventOrCoords.y };
        }
      }
      setThemeMode(mode, coords);
    },
    []
  );

  const cycle = useCallback(
    (
      directionOrEvent?:
        | 'next'
        | 'prev'
        | React.MouseEvent
        | MouseEvent
        | { clientX?: number; clientY?: number; x?: number; y?: number },
      eventOrCoords?:
        | React.MouseEvent
        | MouseEvent
        | { clientX?: number; clientY?: number; x?: number; y?: number }
    ) => {
      let direction: 'next' | 'prev' = 'next';
      let target = eventOrCoords;
      if (directionOrEvent === 'next' || directionOrEvent === 'prev') {
        direction = directionOrEvent;
      } else if (directionOrEvent) {
        target = directionOrEvent;
      }
      let coords: ThemeCoords | undefined;
      if (target) {
        if ('clientX' in target && typeof target.clientX === 'number') {
          coords = { x: target.clientX, y: target.clientY };
        } else if ('x' in target && typeof target.x === 'number') {
          coords = { x: target.x, y: target.y };
        }
      }
      cycleThemeMode(direction, coords);
    },
    []
  );

  useEffect(() => {
    // Registered per mount and removed on unmount: the store is read from
    // several places at once (header toggle, drawer toggle, toaster), and a
    // module-level "started once" flag would leave a listener bound to a
    // media query from a previous mount. The handlers are idempotent —
    // `syncTheme` re-reads storage and no-ops when nothing changed — so two
    // mounted readers cost one extra no-op, not a double application.
    const media =
      typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(DARK_QUERY) : null;
    const onMediaChange = () => {
      // A pin exists precisely to stop the OS setting from moving the palette.
      if (state.mode === 'system') syncTheme();
    };
    media?.addEventListener?.('change', onMediaChange);

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === THEME_STORAGE_KEY) syncTheme();
    };
    window.addEventListener('storage', onStorage);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel(THEME_BROADCAST_CHANNEL);
        channel.onmessage = (event: MessageEvent<ThemeBroadcastPayload>) => {
          const data = event.data;
          if (
            data &&
            data.type === 'THEME_SYNC' &&
            data.sourceId !== TAB_INSTANCE_ID &&
            isThemeMode(data.mode)
          ) {
            const next: ThemeState = {
              mode: data.mode,
              effective: data.effective,
            };
            if (typeof document !== 'undefined') {
              applyThemeAttribute(document.documentElement, next.effective, next.mode);
            }
            replaceState(next);
            emitThemeHud(data.mode, data.effective, data.coords, data.txId);
          }
        };
      } catch {
        // BroadcastChannel unavailable or restricted
      }
    }

    syncTheme();

    return () => {
      media?.removeEventListener?.('change', onMediaChange);
      window.removeEventListener('storage', onStorage);
      channel?.close();
    };
  }, []);

  return {
    mode: value.mode,
    effective: value.effective,
    setMode,
    cycle,
  };
}
