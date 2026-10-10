'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  applyThemeAttribute,
  type EffectiveTheme,
  nextThemeMode,
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
  applyThemeAttribute(document.documentElement, next.effective);
  replaceState(next);
  return next;
}

export function setThemeMode(next: ThemeMode): ThemeState {
  writeThemeMode(storage(), next);
  const resolved: ThemeState = {
    mode: next,
    effective: resolveEffectiveTheme(next, prefersDark()),
  };
  if (typeof window !== 'undefined') {
    applyThemeAttribute(document.documentElement, resolved.effective);
  }
  replaceState(resolved);
  return resolved;
}

export function cycleThemeMode(): ThemeMode {
  return setThemeMode(nextThemeMode(state.mode)).mode;
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
  setMode: (mode: ThemeMode) => void;
  cycle: () => void;
} {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setMode = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
  }, []);

  const cycle = useCallback(() => {
    cycleThemeMode();
  }, []);

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

    syncTheme();

    return () => {
      media?.removeEventListener?.('change', onMediaChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return {
    mode: value.mode,
    effective: value.effective,
    setMode,
    cycle,
  };
}
