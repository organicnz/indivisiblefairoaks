'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEditContext } from '@/components/layout/useEditContext';
import { useVisualEditMode } from '@/components/layout/visual-edit-store';

const VisualEditOverlay = dynamic(
  () => import('./VisualEditOverlay').then((mod) => mod.VisualEditOverlay),
  { ssr: false }
);

/**
 * Lazy-mount wrapper for VisualEditOverlay.
 *
 * Visual editing is an administrative tool with an extensive runtime
 * (studios, modals, Radix dialogs, Lucide icons, inspector controls).
 * Public visitors who are not admins and have not enabled visual editing
 * should not download, parse, or evaluate this bundle.
 *
 * This wrapper checks edit context and visual edit mode:
 * - If visual edit mode is disabled AND the visitor is not an admin, returns null.
 * - If enabled OR the visitor is an authenticated admin, dynamically loads VisualEditOverlay.
 */
export function VisualEditLazyMount() {
  const rawPathname = usePathname();
  const pathname = rawPathname ?? '/';
  const { enabled } = useVisualEditMode(pathname);
  const { isAdmin } = useEditContext(pathname);

  if (!enabled && !isAdmin) return null;

  return <VisualEditOverlay />;
}

