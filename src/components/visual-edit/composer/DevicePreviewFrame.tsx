'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Block } from '@/lib/blocks';
import { resolveEffectiveTheme, type ThemeMode } from '@/lib/theme';
import type {
  VisualComposerDevice,
  VisualComposerMode,
  VisualComposerStyles,
} from '@/types/unified';
import { ThemePreviewToggle } from './ui/ThemePreviewToggle';

export interface DevicePreviewFrameProps {
  inspectorMode: VisualComposerMode;
  previewDevice: VisualComposerDevice;
  setPreviewDevice: (device: VisualComposerDevice) => void;
  compiledClassNames: string;
  currentBlock: Block;
  previewTheme?: ThemeMode;
  setPreviewTheme?: (theme: ThemeMode) => void;
  styles?: VisualComposerStyles;
}

export function DevicePreviewFrame({
  inspectorMode,
  previewDevice,
  setPreviewDevice,
  compiledClassNames,
  currentBlock,
  previewTheme: propTheme,
  setPreviewTheme: propSetTheme,
  styles,
}: DevicePreviewFrameProps) {
  const [internalTheme, setInternalTheme] = useState<ThemeMode>('system');
  const activeTheme = propTheme ?? internalTheme;
  const handleSetTheme = propSetTheme ?? setInternalTheme;

  const [osPrefersDark, setOsPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setOsPrefersDark(e.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  const hasThemeOverride =
    (styles?.themeMode && styles.themeMode !== 'inherit') ||
    (styles?.section?.themeMode && styles.section.themeMode !== 'inherit');
  const themeOverrideTone =
    inspectorMode === 'section'
      ? styles?.section?.themeMode || styles?.themeMode
      : styles?.themeMode || styles?.section?.themeMode;

  const effectiveTheme = resolveEffectiveTheme(
    hasThemeOverride && themeOverrideTone
      ? themeOverrideTone === 'system'
        ? 'system'
        : themeOverrideTone === 'dark'
          ? 'dark'
          : 'light'
      : activeTheme,
    osPrefersDark
  );

  return (
    <div className="border-b border-white/10 bg-slate-900/40 px-5 py-2.5">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          <Sparkles size={11} className="text-accent-gold" />
          <span>Live Mini-Preview ({inspectorMode})</span>
          <span className="text-[9px] text-accent-gold/90 font-mono ml-1">Real-time</span>
          {hasThemeOverride && (
            <span className="ml-1 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-accent-gold font-mono border border-accent-gold/30">
              Tone: {themeOverrideTone}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {/* Theme Mode Selector (System / Light / Dark) */}
          <ThemePreviewToggle currentMode={activeTheme} onSelectMode={handleSetTheme} compact />

          <span className="text-white/20">|</span>

          {/* Viewport Device Width (Desk / Tab / Mob) */}
          <div className="flex items-center gap-1">
            {(['desktop', 'tablet', 'mobile'] as const).map((dev) => (
              <button
                key={dev}
                type="button"
                onClick={() => setPreviewDevice(dev)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold capitalize transition-colors cursor-pointer ${
                  previewDevice === dev
                    ? 'bg-accent-gold text-ink-strong'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
                title={`Preview on ${dev}`}
                aria-label={`Preview on ${dev}`}
              >
                {dev === 'desktop' ? 'Desk' : dev === 'tablet' ? 'Tab' : 'Mob'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        data-theme={effectiveTheme}
        data-theme-mode={themeOverrideTone || activeTheme}
        className={`rounded-xl border transition-all duration-300 p-2.5 overflow-hidden relative ${
          effectiveTheme === 'light'
            ? 'bg-white/95 text-ink-strong border-white/20 shadow-xs'
            : 'bg-slate-950 text-white border-white/10 shadow-inner'
        }`}
      >
        {/* Real-time Badge Ribbon Preview */}
        {styles?.badgeText?.trim() && (
          <span
            data-testid="preview-badge-ribbon"
            className={`pointer-events-none absolute z-10 ${
              styles.badgePosition === 'top-left' ? 'top-1.5 left-1.5' : 'top-1.5 right-1.5'
            } text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              styles.badgeTone === 'navy'
                ? 'bg-sky-950 text-sky-200 border border-sky-400/30'
                : styles.badgeTone === 'emerald'
                  ? 'bg-emerald-950 text-emerald-200 border border-emerald-400/30'
                  : styles.badgeTone === 'crimson'
                    ? 'bg-rose-950 text-rose-200 border border-rose-400/30'
                    : styles.badgeTone === 'slate'
                      ? 'bg-slate-800 text-slate-300 border border-white/10'
                      : 'bg-accent-gold text-ink-strong shadow-xs'
            }`}
          >
            {styles.badgeText.trim()}
          </span>
        )}

        <div
          className={`transition-all duration-300 ${
            previewDevice === 'mobile'
              ? 'max-w-[220px] mx-auto'
              : previewDevice === 'tablet'
                ? 'max-w-[320px] mx-auto'
                : 'w-full'
          }`}
        >
          <div
            className={`${
              compiledClassNames ||
              (effectiveTheme === 'light'
                ? 'p-2 text-ink-strong text-xs'
                : 'p-2 text-white text-xs')
            }`}
          >
            <p className="line-clamp-2 text-xs">
              {currentBlock.type === 'heading'
                ? currentBlock.html || 'Heading Preview Text'
                : currentBlock.type === 'paragraph'
                  ? currentBlock.html || 'Paragraph preview content goes here.'
                  : currentBlock.type === 'button'
                    ? currentBlock.label || 'Action Button'
                    : currentBlock.type === 'callout'
                      ? currentBlock.html || 'Callout message box'
                      : `${currentBlock.type} element`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
