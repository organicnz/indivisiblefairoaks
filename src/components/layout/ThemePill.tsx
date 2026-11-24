'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';

const ThemePillMotion = dynamic(
  () => import('./ThemePillMotion').then((mod) => mod.ThemePillMotion),
  { ssr: false }
);

/**
 * Module-scoped once the Motion chunk has loaded. A later pill mount (for
 * example after switching theme modes) then starts with the animated version
 * instead of flashing the static fallback for one frame.
 */
let motionLoaded = false;

/**
 * The active theme pill: a static backdrop is always safe to render, while the
 * spring animation is an enhancement loaded separately. Keeping the fallback
 * in the initial markup means the control never paints without its active
 * state, even if the Motion chunk is slow or blocked.
 */
export function ThemePill({ layoutId, className }: { layoutId: string; className: string }) {
  const [isMotionReady, setIsMotionReady] = useState(motionLoaded);
  const handleReady = useCallback(() => {
    motionLoaded = true;
    setIsMotionReady(true);
  }, []);

  return (
    <>
      {!isMotionReady ? (
        <span aria-hidden="true" className={`absolute inset-0 ${className}`} />
      ) : null}
      <ThemePillMotion layoutId={layoutId} className={className} onReady={handleReady} />
    </>
  );
}
