'use client';

import { useEffect } from 'react';
import { setVisualEditMode } from '@/components/layout/visual-edit-store';

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
 */
export function ComposerWorkspaceBoot() {
  useEffect(() => {
    setVisualEditMode(true);
  }, []);

  return null;
}
