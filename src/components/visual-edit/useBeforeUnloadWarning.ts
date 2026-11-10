'use client';

import { useEffect } from 'react';

/**
 * Ask the browser to confirm a hard reload or tab close while active.
 *
 * The browser owns the prompt copy; applications cannot customize it. This does
 * not fire for client-side navigation, so it complements the route guard rather
 * than replacing it.
 */
export function useBeforeUnloadWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers require returnValue; modern browsers show their own copy.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [active]);
}
