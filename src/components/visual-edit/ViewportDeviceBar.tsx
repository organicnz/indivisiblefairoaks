'use client';

import { Monitor, RotateCw, Smartphone, Tablet } from 'lucide-react';
import type { ViewportMode } from './VisualEditOverlay';

export interface ViewportDeviceBarProps {
  viewportMode: ViewportMode;
  deviceOrientation: 'portrait' | 'landscape';
  onRotate: () => void;
  onReset: () => void;
}

export function ViewportDeviceBar({
  viewportMode,
  deviceOrientation,
  onRotate,
  onReset,
}: ViewportDeviceBarProps) {
  if (viewportMode === 'desktop') return null;

  const isMobile = viewportMode === 'mobile';
  const deviceName = isMobile ? 'iPhone 15 Pro' : 'iPad Mini';
  const width = isMobile
    ? deviceOrientation === 'portrait'
      ? 390
      : 844
    : deviceOrientation === 'portrait'
      ? 768
      : 1024;
  const height = isMobile
    ? deviceOrientation === 'portrait'
      ? 844
      : 390
    : deviceOrientation === 'portrait'
      ? 1024
      : 768;

  return (
    <section
      aria-label="Responsive Viewport Device Simulator"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/90 px-3.5 py-1.5 text-xs text-white shadow-float backdrop-blur-xl animate-in fade-in-0 slide-in-from-top-2 duration-200"
    >
      <div className="flex items-center gap-1.5 font-bold text-accent-gold">
        {isMobile ? <Smartphone size={14} /> : <Tablet size={14} />}
        <span>{deviceName}</span>
      </div>

      <span className="text-white/30">|</span>

      <span className="font-mono text-[11px] text-slate-300">
        {width} × {height} px
      </span>

      <span className="text-[10px] uppercase font-bold text-slate-400 bg-white/10 px-1.5 py-0.5 rounded">
        {deviceOrientation}
      </span>

      <button
        type="button"
        onClick={onRotate}
        title={`Rotate orientation to ${deviceOrientation === 'portrait' ? 'Landscape' : 'Portrait'}`}
        aria-label="Rotate device orientation"
        className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold text-white hover:bg-white/20 transition-colors cursor-pointer"
      >
        <RotateCw size={12} className="text-accent-gold" />
        <span className="hidden sm:inline">Rotate</span>
      </button>

      <button
        type="button"
        onClick={onReset}
        title="Exit responsive simulation mode"
        aria-label="Exit responsive simulation mode"
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      >
        <Monitor size={12} />
        <span className="hidden sm:inline">Full</span>
      </button>
    </section>
  );
}
