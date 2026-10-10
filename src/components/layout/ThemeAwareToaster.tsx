'use client';

import { Toaster } from 'sonner';
import { useThemeMode } from './theme-store';

/**
 * The toast surface, following the reader's palette.
 *
 * Sonner takes the theme as a prop and does not watch the document, so a
 * hardcoded `theme="light"` would keep painting light toasts over a dark page.
 * The wrapper reads the same store the toggle writes; the server pass renders
 * `light` (there is no OS preference to consult there) and the client pass
 * corrects it on mount, before any toast exists.
 */
export function ThemeAwareToaster() {
  const { effective } = useThemeMode();
  return <Toaster position="bottom-right" richColors theme={effective} />;
}
