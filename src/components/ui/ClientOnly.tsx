'use client';

import { type ReactNode, useEffect, useState } from 'react';

/**
 * Render children only after hydration.
 *
 * Some client chrome reads URL data (`usePathname()` / `useParams()`) to
 * highlight its own state. On a route with fallback params that value is
 * unavailable during the static prerender, and a server-layout Suspense
 * boundary around a client component does not satisfy Next's client-hook
 * check. These surfaces are nonessential overlays, analytics, or auth-only
 * navigation, so deferring the whole subtree is both correct and cheaper than
 * putting route data in the static shell.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? <>{children}</> : <>{fallback}</>;
}
