'use client';

import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';

/**
 * Clears a selection when the key identifying the applied result set changes.
 * The key deliberately excludes pagination, so paging keeps selections; the
 * first render does not clear.
 */
export function useClearSelectionOnKeyChange(
  selectionKey: string,
  setSelection: Dispatch<SetStateAction<Set<string>>>
): void {
  const previousKey = useRef(selectionKey);
  useEffect(() => {
    if (previousKey.current === selectionKey) return;
    previousKey.current = selectionKey;
    setSelection(new Set<string>());
  }, [selectionKey, setSelection]);
}
