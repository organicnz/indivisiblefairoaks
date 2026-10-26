'use client';

import { Sparkles } from 'lucide-react';
import type { Block } from '@/lib/blocks';
import type { VisualComposerDevice, VisualComposerMode } from '@/types/unified';

export interface DevicePreviewFrameProps {
  inspectorMode: VisualComposerMode;
  previewDevice: VisualComposerDevice;
  setPreviewDevice: (device: VisualComposerDevice) => void;
  compiledClassNames: string;
  currentBlock: Block;
}

export function DevicePreviewFrame({
  inspectorMode,
  previewDevice,
  setPreviewDevice,
  compiledClassNames,
  currentBlock,
}: DevicePreviewFrameProps) {
  return (
    <div className="border-b border-white/10 bg-slate-900/40 px-5 py-2.5">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Sparkles size={11} className="text-accent-gold" />
          <span>Live Mini-Preview ({inspectorMode})</span>
          <span className="text-[9px] text-accent-gold/90 font-mono ml-1">Real-time</span>
        </span>
        <div className="flex items-center gap-1">
          {(['desktop', 'tablet', 'mobile'] as const).map((dev) => (
            <button
              key={dev}
              type="button"
              onClick={() => setPreviewDevice(dev)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold capitalize transition-colors ${
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
      <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 overflow-hidden transition-all duration-300">
        <div
          className={`transition-all duration-300 ${
            previewDevice === 'mobile'
              ? 'max-w-[220px] mx-auto'
              : previewDevice === 'tablet'
                ? 'max-w-[320px] mx-auto'
                : 'w-full'
          }`}
        >
          <div className={`${compiledClassNames || 'p-2 text-white text-xs'}`}>
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
