'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { subscribeThemeHud, type ThemeHudEvent } from './theme-store';

const VgpuThemeCanvas = dynamic(
  () => import('./VgpuThemeCanvas').then((mod) => mod.VgpuThemeCanvas),
  { ssr: false }
);

function canRenderVgpu(): boolean {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;

  return !(
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Theme transitions are a decorative enhancement. The WebGPU canvas, its
 * shader and the `vgpu` runtime are only needed once a palette transition
 * starts, but mounting the canvas eagerly made every page download that
 * ~268 KB chunk after hydration even when the visitor never changed theme.
 *
 * Wait for the first theme event, then load the chunk. The event is passed
 * through so the canvas can replay the transition that triggered the load
 * instead of dropping it. After that the canvas stays mounted and handles
 * subsequent transitions through its own subscription.
 *
 * Browsers without WebGPU and readers who prefer reduced motion would leave
 * the canvas invisible, so they do not pay for the download at all.
 */
export function VgpuThemeCanvasLazy() {
  const [firstEvent, setFirstEvent] = useState<ThemeHudEvent | null>(null);

  useEffect(() => {
    if (!canRenderVgpu()) return;
    return subscribeThemeHud(setFirstEvent);
  }, []);

  return firstEvent ? <VgpuThemeCanvas initialEvent={firstEvent} /> : null;
}
