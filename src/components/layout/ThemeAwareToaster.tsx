'use client';

import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import { useThemeMode } from './theme-store';
import { useVisualEditMode } from './visual-edit-store';

/**
 * Toasts sit under the editor's chrome while visual editing is on.
 *
 * The visual editor owns the right edge of the viewport: the block dock from
 * 9998 and the inspector from 10010. Sonner renders its layer at 999999999, so
 * a single toast at bottom-right covers the dock's per-block controls — and it
 * does not merely hide them, it wins the hit test, so a click on "Visual
 * Composer for …" lands on the toast and the panel never opens. That is how a
 * toast from an unrelated navigation turned the composer into a button that did
 * nothing.
 *
 * So while editing, the layer moves to the free left edge and drops below the
 * editor's own z-index. On the narrow viewports where the dock spans much of
 * the screen, the z-index is the part that matters: the editor still wins the
 * click, and the toast stays visible wherever it is not covered.
 */
const VISUAL_EDIT_TOAST_Z_INDEX = 9000;

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
  const pathname = usePathname();
  const { enabled: visualEditing } = useVisualEditMode(pathname ?? '/');

  return (
    <Toaster
      position={visualEditing ? 'bottom-left' : 'bottom-right'}
      richColors
      theme={effective}
      style={visualEditing ? { zIndex: VISUAL_EDIT_TOAST_Z_INDEX } : undefined}
    />
  );
}
