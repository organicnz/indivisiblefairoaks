'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  readVisualEditMode,
  visualEditModeFromSearchParams,
  writeVisualEditMode,
} from '@/lib/visual-edit-mode';

/**
 * The shared, persisted visual-edit mode and section state.
 *
 * An external store rather than context, because the state has to be written by
 * the header button, read by the drawer row and read by the page overlay — three
 * places whose only common ancestor is the root layout, a Server Component.
 * Threading a client provider through the whole app for one boolean is a poor
 * trade for what it buys.
 *
 * `useSyncExternalStore` is the right primitive for the reason it is right for
 * any cross-tree client state: the snapshot is consistent within a render, so
 * the button and the overlay cannot disagree about whether editing is on. A
 * context value read at two different depths can.
 */

let enabled = false;
const enabledSections = new Set<number>();
let activeSectionIndex: number | null = null;
let sectionSnapshot: number[] = [];

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function updateSectionSnapshot(): void {
  sectionSnapshot = Array.from(enabledSections).sort((a, b) => a - b);
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Reconcile the URL against the stored preference for a pathname.
 *
 * The URL wins when it has an opinion, so a shared `?visual-edit=1` link turns
 * the mode on for whoever opens it. Absence falls back to the stored preference.
 * Either way the outcome is mirrored into storage, so the mode survives the next
 * navigation and a stale value left by another tab is overwritten rather than
 * silently resurrected.
 */
export function syncVisualEditMode(_pathname?: string): void {
  if (typeof window === 'undefined') return;
  const search = globalThis.location?.search ?? '';
  const fromUrl = visualEditModeFromSearchParams(search);
  const next = fromUrl ?? readVisualEditMode(storage());
  writeVisualEditMode(storage(), next);
  if (next !== enabled) {
    enabled = next;
    emit();
  }
}

export function setVisualEditMode(next: boolean): void {
  if (next === enabled) return;
  enabled = next;
  writeVisualEditMode(storage(), next);
  emit();
}

export function toggleVisualEditMode(): void {
  setVisualEditMode(!enabled);
}

// ── Per-Section Visual Editing State ──────────────────────────────────────────

export function isSectionVisualEnabled(index: number): boolean {
  return enabledSections.has(index);
}

export function setSectionVisualEnabled(index: number, isEnabled: boolean): void {
  const had = enabledSections.has(index);
  if (isEnabled && !had) {
    enabledSections.add(index);
    updateSectionSnapshot();
    emit();
  } else if (!isEnabled && had) {
    enabledSections.delete(index);
    updateSectionSnapshot();
    emit();
  }
}

export function toggleSectionVisualEnabled(index: number): void {
  if (enabledSections.has(index)) {
    enabledSections.delete(index);
  } else {
    enabledSections.add(index);
  }
  updateSectionSnapshot();
  emit();
}

export function enableAllSectionVisuals(indices: number[]): void {
  let changed = false;
  for (const idx of indices) {
    if (!enabledSections.has(idx)) {
      enabledSections.add(idx);
      changed = true;
    }
  }
  if (changed) {
    updateSectionSnapshot();
    emit();
  }
}

export function disableAllSectionVisuals(): void {
  if (enabledSections.size > 0) {
    enabledSections.clear();
    updateSectionSnapshot();
    emit();
  }
}

export function setActiveVisualSection(index: number | null): void {
  if (activeSectionIndex === index) return;
  activeSectionIndex = index;
  emit();
}

export function getActiveVisualSection(): number | null {
  return activeSectionIndex;
}

export function getEnabledSectionIndicesSnapshot(): number[] {
  return sectionSnapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return enabled;
}

/** Server render: visual editing is a client interaction, so it starts off. */
function getServerSnapshot(): boolean {
  return false;
}

const EMPTY_INDICES: number[] = [];

function getServerSectionIndicesSnapshot(): number[] {
  return EMPTY_INDICES;
}

function getServerActiveSectionSnapshot(): number | null {
  return null;
}

/**
 * The current mode plus a toggle, reconciled against this pathname.
 *
 * The effect is what makes the mode follow an admin around the site instead of
 * resetting on the first link they click. It runs after commit rather than
 * during render: reading `location` in a render body makes the store a
 * render-phase side effect, which React reserves the right to discard.
 */
export function useVisualEditMode(pathname: string): {
  enabled: boolean;
  toggle: () => void;
} {
  const enabledNow = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    toggleVisualEditMode();
  }, []);

  useEffect(() => {
    syncVisualEditMode(pathname);
  }, [pathname]);

  return { enabled: enabledNow, toggle };
}

/**
 * Hook for per-section visual editing state.
 */
export function useVisualEditSections(): {
  enabledIndices: number[];
  isSectionEnabled: (index: number) => boolean;
  toggleSection: (index: number) => void;
  setSectionEnabled: (index: number, enabled: boolean) => void;
  enableAll: (indices: number[]) => void;
  disableAll: () => void;
  activeSection: number | null;
  setActiveSection: (idx: number | null) => void;
} {
  const enabledIndices = useSyncExternalStore(
    subscribe,
    getEnabledSectionIndicesSnapshot,
    getServerSectionIndicesSnapshot
  );

  const activeSection = useSyncExternalStore(
    subscribe,
    getActiveVisualSection,
    getServerActiveSectionSnapshot
  );

  const isSectionEnabled = useCallback((index: number) => enabledSections.has(index), []);

  const toggleSection = useCallback((index: number) => {
    toggleSectionVisualEnabled(index);
  }, []);

  const setSectionEnabled = useCallback((index: number, isEnabled: boolean) => {
    setSectionVisualEnabled(index, isEnabled);
  }, []);

  const enableAll = useCallback((indices: number[]) => {
    enableAllSectionVisuals(indices);
  }, []);

  const disableAll = useCallback(() => {
    disableAllSectionVisuals();
  }, []);

  const setActiveSection = useCallback((idx: number | null) => {
    setActiveVisualSection(idx);
  }, []);

  return {
    enabledIndices,
    isSectionEnabled,
    toggleSection,
    setSectionEnabled,
    enableAll,
    disableAll,
    activeSection,
    setActiveSection,
  };
}
