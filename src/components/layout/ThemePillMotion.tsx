'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';

/**
 * The spring-animated active-pill backdrop. This module is intentionally
 * separate from `ThemePill` so the Motion runtime stays out of the initial
 * layout bundle; it is loaded only after hydration (or when a pill appears).
 */
export function ThemePillMotion({
  layoutId,
  className,
  onReady,
}: {
  layoutId: string;
  className: string;
  onReady: () => void;
}) {
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    onReady();
  }, [onReady]);

  if (prefersReduced) {
    return <span aria-hidden="true" className={`absolute inset-0 ${className}`} />;
  }

  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden="true"
      className={`absolute inset-0 ${className}`}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 35,
        mass: 0.8,
      }}
      style={{ originX: 0.5, originY: 0.5 }}
    />
  );
}
