'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

const DOCK_COLLAPSED_KEY = 'visual_edit_dock_collapsed';
const INSPECTOR_KEY = 'visual_edit_inspector';

function readDockCollapsed(): boolean {
  try {
    return (
      typeof window !== 'undefined' && window.localStorage?.getItem(DOCK_COLLAPSED_KEY) === 'true'
    );
  } catch {
    return false;
  }
}

function readInspectorEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem(INSPECTOR_KEY) !== 'false';
  } catch {
    return true;
  }
}

/**
 * Persistent chrome preferences for the in-page editor.
 *
 * The overlay can be remounted by a route change, so both switches are restored
 * from localStorage on mount. A storage failure falls back to the same defaults
 * the editor has always used: dock expanded, inspector visible.
 */
export function useVisualEditChrome() {
  const [dockCollapsed, setDockCollapsed] = useState(readDockCollapsed);
  const [showInspector, setShowInspector] = useState(readInspectorEnabled);

  const toggleInspector = useCallback(() => {
    setShowInspector((prev) => {
      const next = !prev;
      try {
        window.localStorage?.setItem(INSPECTOR_KEY, String(next));
      } catch {}
      toast.info(`Inspector HUD ${next ? 'enabled' : 'disabled'}`);
      return next;
    });
  }, []);

  const toggleDockCollapsed = useCallback(() => {
    setDockCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage?.setItem(DOCK_COLLAPSED_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  return {
    dockCollapsed,
    setDockCollapsed,
    showInspector,
    toggleDockCollapsed,
    toggleInspector,
  };
}
