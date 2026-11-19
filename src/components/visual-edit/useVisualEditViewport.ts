'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

/**
 * The overlay's viewport simulator.
 *
 * The sidebar owns the controls, but the effect has to reach the page's
 * `<main>` element: the editor is fixed chrome over the real page, so
 * constraining the page is the only way the admin can judge a mobile layout.
 * Keeping that DOM effect beside the state it depends on makes the hook the
 * single owner of the simulator.
 */
export function useVisualEditViewport(enabled: boolean, isAdmin: boolean) {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [deviceOrientation, setDeviceOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const handleRotateOrientation = useCallback(() => {
    setDeviceOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'));
    toast.info(`Orientation: ${deviceOrientation === 'portrait' ? 'Landscape' : 'Portrait'}`);
  }, [deviceOrientation]);

  // Responsive Viewport Simulation effect: smoothly constrain <main>
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;

    if (!enabled || !isAdmin || viewportMode === 'desktop') {
      main.style.maxWidth = '';
      main.style.marginLeft = '';
      main.style.marginRight = '';
      main.style.boxShadow = '';
      main.style.borderLeft = '';
      main.style.borderRight = '';
      main.style.transition = 'max-width 300ms ease-out';
    } else if (viewportMode === 'mobile') {
      main.style.maxWidth = deviceOrientation === 'portrait' ? '390px' : '844px';
      main.style.marginLeft = 'auto';
      main.style.marginRight = 'auto';
      main.style.boxShadow = '0 25px 60px -15px rgba(0, 0, 0, 0.7)';
      main.style.borderLeft = '1px solid rgba(255, 255, 255, 0.15)';
      main.style.borderRight = '1px solid rgba(255, 255, 255, 0.15)';
      main.style.transition = 'max-width 300ms ease-out';
    } else if (viewportMode === 'tablet') {
      main.style.maxWidth = deviceOrientation === 'portrait' ? '768px' : '1024px';
      main.style.marginLeft = 'auto';
      main.style.marginRight = 'auto';
      main.style.boxShadow = '0 25px 60px -15px rgba(0, 0, 0, 0.5)';
      main.style.borderLeft = '1px solid rgba(255, 255, 255, 0.12)';
      main.style.borderRight = '1px solid rgba(255, 255, 255, 0.12)';
      main.style.transition = 'max-width 300ms ease-out';
    }

    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 320);

    return () => {
      clearTimeout(timer);
    };
  }, [enabled, isAdmin, viewportMode, deviceOrientation]);

  // Clean up viewport simulation styles on unmount
  useEffect(() => {
    return () => {
      const main = document.querySelector('main');
      if (main) {
        main.style.maxWidth = '';
        main.style.marginLeft = '';
        main.style.marginRight = '';
        main.style.boxShadow = '';
        main.style.borderLeft = '';
        main.style.borderRight = '';
      }
    };
  }, []);

  return {
    viewportMode,
    deviceOrientation,
    setViewportMode,
    handleRotateOrientation,
  };
}
