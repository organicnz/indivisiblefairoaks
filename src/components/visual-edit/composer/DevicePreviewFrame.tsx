'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { Block } from '@/lib/blocks';
import type { ThemeMode } from '@/lib/theme';
import type { VisualComposerDevice, VisualComposerMode } from '@/types/unified';
import { ThemePreviewToggle } from './ui/ThemePreviewToggle';

export interface DevicePreviewFrameProps {
  inspectorMode: VisualComposerMode;
  previewDevice: VisualComposerDevice;
  setPreviewDevice: (device: VisualComposerDevice) => void;
  compiledClassNames: string;
  currentBlock: Block;
  previewTheme?: ThemeMode;
  setPreviewTheme?: (theme: ThemeMode) => void;
}

export function DevicePreviewFrame({
  inspectorMode,
  previewDevice,
  setPreviewDevice,
  compiledClassNames,
  currentBlock,
  previewTheme: propTheme,
  setPreviewTheme: propSetTheme,
}: DevicePreviewFrameProps) {
  const [internalTheme, setInternalTheme] = useState<ThemeMode>('system');
  const activeTheme = propTheme ?? internalTheme;
  const handleSetTheme = propSetTheme ?? setInternalTheme;

  return (
    <div className="border-b border-white/10 bg-slate-900/40 px-5 py-2.5">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          <Sparkles size={11} className="text-accent-gold" />
          <span>Live Mini-Preview ({inspectorMode})</span>
          <span className="text-[9px] text-accent-gold/90 font-mono ml-1">Real-time</span>
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
        data-theme={activeTheme !== 'system' ? activeTheme : undefined}
        className={`rounded-xl border transition-all duration-300 p-2.5 overflow-hidden ${
          activeTheme === 'light'
            ? 'bg-white/95 text-ink-strong border-white/20'
            : activeTheme === 'dark'
              ? 'bg-slate-950 text-white border-white/10'
              : 'bg-black/40 text-white border-white/10'
        }`}
      >
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
              (activeTheme === 'light' ? 'p-2 text-ink-strong text-xs' : 'p-2 text-white text-xs')
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
