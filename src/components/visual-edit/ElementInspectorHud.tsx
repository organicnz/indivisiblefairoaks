'use client';

import { Camera, Database, Layers, SlidersHorizontal, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface ElementInspectorHudProps {
  enabled: boolean;
  inlineActive: boolean;
  onOpenStudio?: () => void;
}

interface ContrastResult {
  ratio: number;
  rating: 'AAA' | 'AA' | 'FAIL';
}

/**
 * Calculates the relative luminance of an sRGB color.
 * WCAG 2.1 formula: https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
}

function parseRgb(colorStr: string): [number, number, number] | null {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function getEffectiveBackgroundColor(el: HTMLElement): [number, number, number] {
  let curr: HTMLElement | null = el;
  while (curr) {
    const style = window.getComputedStyle(curr);
    const bg = style.backgroundColor;
    const parsed = parseRgb(bg);
    if (parsed && !bg.includes('rgba(0, 0, 0, 0)') && !bg.includes('transparent')) {
      return parsed;
    }
    curr = curr.parentElement;
  }
  return [255, 255, 255];
}

export function computeContrastRatio(el: HTMLElement): ContrastResult | null {
  if (typeof window === 'undefined' || !window.getComputedStyle) return null;
  const style = window.getComputedStyle(el);
  const textRgb = parseRgb(style.color);
  if (!textRgb) return null;
  const bgRgb = getEffectiveBackgroundColor(el);

  const l1 = getLuminance(...textRgb);
  const l2 = getLuminance(...bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const rawRatio = (lighter + 0.05) / (darker + 0.05);
  const ratio = Math.round(rawRatio * 10) / 10;

  const rawFontSize = parseFloat(style.fontSize || '16');
  const isBold = parseInt(style.fontWeight || '400', 10) >= 700;
  const isLargeText = rawFontSize >= 24 || (rawFontSize >= 18.5 && isBold);

  let rating: 'AAA' | 'AA' | 'FAIL' = 'FAIL';
  if (isLargeText) {
    if (ratio >= 4.5) rating = 'AAA';
    else if (ratio >= 3.0) rating = 'AA';
  } else {
    if (ratio >= 7.0) rating = 'AAA';
    else if (ratio >= 4.5) rating = 'AA';
  }

  return { ratio, rating };
}

interface HoveredElementInfo {
  tagName: string;
  dataPointKey: string | null;
  copyRegionId: string | null;
  width: number;
  height: number;
  top: number;
  left: number;
  rectTop: number;
  rectLeft: number;
  fontSize?: string;
  contrast?: ContrastResult;
  placement: 'top' | 'bottom';
}

export function ElementInspectorHud({
  enabled,
  inlineActive,
  onOpenStudio,
}: ElementInspectorHudProps) {
  const [hovered, setHovered] = useState<HoveredElementInfo | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || inlineActive) {
      setHovered(null);
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      const target = e.target instanceof Element ? (e.target as HTMLElement) : null;
      if (!target || typeof target.closest !== 'function') return;

      // Ignore overlay chrome, toolbars, dialogs, radices
      if (
        target.closest('[data-testid="visual-edit-overlay"]') ||
        target.closest('[data-section-overlay="true"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('[role="toolbar"]') ||
        target.closest('[data-inline-toolbar="true"]') ||
        target.closest('header') ||
        target.closest('nav') ||
        target.closest('footer') ||
        target.closest('[data-no-inline-edit]')
      ) {
        setHovered(null);
        return;
      }

      const main = target.closest('main');
      if (!main) {
        setHovered(null);
        return;
      }

      const dataPointEl = target.closest<HTMLElement>('[data-data-point]');
      const copyRegionEl = target.closest<HTMLElement>('[data-copy-region]');
      const tagEl = target.closest<HTMLElement>(
        'h1, h2, h3, h4, h5, h6, p, blockquote, li, dt, dd, [data-copy-region] span, a, button, img, table, pre, code'
      );

      const el =
        dataPointEl || copyRegionEl || tagEl || (target.textContent?.trim() ? target : null);
      if (!el || el === main) {
        setHovered(null);
        return;
      }

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          setHovered(null);
          return;
        }

        const dataPointKey =
          el.getAttribute('data-data-point') ||
          el.closest('[data-data-point]')?.getAttribute('data-data-point') ||
          null;
        const copyRegionId =
          el.getAttribute('data-copy-region') ||
          el.closest('[data-copy-region]')?.getAttribute('data-copy-region') ||
          null;

        const placement = rect.top < 40 ? 'bottom' : 'top';
        const top = placement === 'top' ? rect.top - 28 : rect.bottom + 4;
        const left = Math.max(8, Math.min(window.innerWidth - 300, rect.left));

        const computed =
          typeof window !== 'undefined' && window.getComputedStyle
            ? window.getComputedStyle(el)
            : null;
        const rawFontSize = computed?.fontSize ? parseFloat(computed.fontSize) : null;
        const fontSize =
          rawFontSize && !Number.isNaN(rawFontSize) && rawFontSize > 0
            ? `${Math.round(rawFontSize)}px`
            : undefined;

        const contrast =
          el.tagName.toLowerCase() !== 'img' ? (computeContrastRatio(el) ?? undefined) : undefined;

        setHovered({
          tagName: el.tagName.toLowerCase(),
          dataPointKey,
          copyRegionId,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top,
          left,
          rectTop: Math.round(rect.top),
          rectLeft: Math.round(rect.left),
          fontSize,
          contrast,
          placement,
        });
      });
    };

    const handlePointerLeave = () => {
      setHovered(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, inlineActive]);

  if (!hovered) return null;

  return (
    <>
      {/* Visual Bounding Box around Hovered Element */}
      <div
        data-testid="element-inspector-box"
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: `${hovered.rectTop}px`,
          left: `${hovered.rectLeft}px`,
          width: `${hovered.width}px`,
          height: `${hovered.height}px`,
          zIndex: 9997,
        }}
        className="pointer-events-none rounded-md border-2 border-sky-400/70 bg-sky-400/5 shadow-[0_0_12px_rgba(56,189,248,0.2)] transition-all duration-75 animate-in fade-in-0"
      />

      {/* Floating HUD Pill */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: `${hovered.top}px`,
          left: `${hovered.left}px`,
          zIndex: 9998,
        }}
        className="pointer-events-none select-none flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/90 px-2.5 py-1 text-[11px] font-mono text-white shadow-float backdrop-blur-md transition-all duration-75 animate-in fade-in-0 zoom-in-95"
      >
        {hovered.dataPointKey ? (
          <span className="flex items-center gap-1 font-bold text-sky-400">
            <Database size={11} className="text-sky-400" />
            <span>{hovered.dataPointKey}</span>
          </span>
        ) : hovered.copyRegionId ? (
          <span className="flex items-center gap-1 font-bold text-emerald-400">
            <Layers size={11} className="text-emerald-400" />
            <span>Region: {hovered.copyRegionId}</span>
          </span>
        ) : hovered.tagName === 'img' ? (
          <span className="flex items-center gap-1 font-bold text-purple-400">
            <Camera size={11} className="text-purple-400" />
            <span>Image Asset</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 font-bold text-accent-gold uppercase">
            <Type size={11} className="text-accent-gold" />
            <span>{hovered.tagName}</span>
          </span>
        )}

        <span className="text-white/40">·</span>
        <span className="text-slate-400 text-[10px]">
          {hovered.width}×{hovered.height}
        </span>
        {hovered.fontSize && (
          <>
            <span className="text-white/40">·</span>
            <span className="text-sky-300 text-[10px]">{hovered.fontSize}</span>
          </>
        )}
        {hovered.contrast && (
          <>
            <span className="text-white/40">·</span>
            <span
              data-testid="element-contrast-badge"
              className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold ${
                hovered.contrast.rating === 'AAA'
                  ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-300'
                  : hovered.contrast.rating === 'AA'
                    ? 'border border-accent-gold/30 bg-amber-500/20 text-accent-gold'
                    : 'border border-rose-500/30 bg-rose-500/20 text-rose-300'
              }`}
              title={`WCAG Contrast: ${hovered.contrast.ratio}:1 (${hovered.contrast.rating})`}
            >
              {hovered.contrast.ratio}:1 {hovered.contrast.rating}
            </span>
          </>
        )}
        <span className="text-white/30 hidden sm:inline">·</span>
        <span className="text-[10px] text-amber-300/80 font-sans font-semibold hidden sm:inline">
          Click to edit
        </span>
        {onOpenStudio && (
          <>
            <span className="text-white/40">·</span>
            <button
              type="button"
              data-testid="hud-open-studio-button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStudio();
              }}
              className="pointer-events-auto flex items-center gap-1 rounded-full border border-accent-gold/40 bg-accent-gold/20 px-2 py-0.5 text-[10px] font-sans font-bold text-accent-gold hover:bg-accent-gold/30 hover:scale-105 active:scale-95 transition-all"
              title="Open Visual Composer 10x Studio"
            >
              <SlidersHorizontal size={10} />
              <span>Studio</span>
            </button>
          </>
        )}
      </div>
    </>
  );
}
