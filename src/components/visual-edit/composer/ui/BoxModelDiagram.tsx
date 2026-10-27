'use client';

import { Link2, Unlink2 } from 'lucide-react';
import type { Block } from '@/lib/blocks';
import type { VisualComposerStyles } from '@/types/unified';

export interface BoxModelDiagramProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  isSidesLinked: boolean;
  setIsSidesLinked: React.Dispatch<React.SetStateAction<boolean>>;
  cycleMarginValue: (current: string, axis?: 'vertical' | 'horizontal') => string;
  cyclePaddingValue: (current: string, axis?: 'vertical' | 'horizontal') => string;
  currentBlock?: Block;
}

export function BoxModelDiagram({
  styles,
  setStyles,
  isSidesLinked,
  setIsSidesLinked,
  cycleMarginValue,
  cyclePaddingValue,
  currentBlock,
}: BoxModelDiagramProps) {
  const margin = styles?.margin || { top: '', bottom: '', left: '', right: '' };
  const padding = styles?.padding || { top: '', bottom: '', left: '', right: '' };
  const border = styles?.border || { width: '', style: '', color: '', radius: '' };
  const layout = styles?.layout || { width: '', height: '' };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-accent-gold uppercase tracking-wider">
          Interactive CSS Box Model (4-Sided)
        </span>
        <button
          type="button"
          onClick={() => setIsSidesLinked((prev) => !prev)}
          title={isSidesLinked ? 'Sides Linked (Sync)' : 'Sides Unlinked (Independent)'}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer ${
            isSidesLinked ? 'bg-accent-gold/20 text-accent-gold' : 'bg-white/10 text-slate-300'
          }`}
        >
          {isSidesLinked ? <Link2 size={10} /> : <Unlink2 size={10} />}
          <span>{isSidesLinked ? 'Linked' : 'Separate'}</span>
        </button>
      </div>

      {/* Quick Spacing Presets */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        {[
          { label: 'Default', margin: 'my-2', padding: 'p-4' },
          { label: 'Card', margin: 'my-4', padding: 'p-6' },
          { label: 'Spacious', margin: 'my-8', padding: 'p-8' },
          { label: 'Compact', margin: 'my-1', padding: 'p-2' },
          { label: 'Flush', margin: '', padding: '' },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() =>
              setStyles({
                ...styles,
                margin: { top: preset.margin, bottom: '', left: '', right: '' },
                padding: { top: preset.padding, bottom: '', left: '', right: '' },
              })
            }
            className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-slate-300 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Nested Box Model Canvas with Clickable 4 Sides */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-2 text-center relative transition-colors">
        <span className="absolute top-1 left-2 text-[8px] font-mono font-bold text-amber-400/90 tracking-widest uppercase">
          Margin (Outer)
        </span>

        {/* Top Margin Clickable Pill */}
        <div className="flex justify-center my-0.5">
          <button
            type="button"
            onClick={() => {
              const next = cycleMarginValue(margin.top, 'vertical');
              setStyles({
                ...styles,
                margin: {
                  ...margin,
                  top: next,
                  bottom: isSidesLinked ? next : margin.bottom,
                },
              });
            }}
            title="Click to cycle top margin"
            className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors cursor-pointer"
          >
            T: {margin.top || '0'}
          </button>
        </div>

        {/* Middle Row: Left Margin, Middle Border/Padding Box, Right Margin */}
        <div className="flex items-center justify-between gap-1 my-1">
          {/* Left Margin Clickable Pill */}
          <button
            type="button"
            onClick={() => {
              const next = cycleMarginValue(margin.left, 'horizontal');
              setStyles({
                ...styles,
                margin: {
                  ...margin,
                  left: next,
                  right: isSidesLinked ? next : margin.right,
                },
              });
            }}
            title="Click to cycle left margin"
            className="px-1.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors shrink-0 cursor-pointer"
          >
            L: {margin.left || '0'}
          </button>

          {/* Border (Middle) Box */}
          <div className="flex-1 rounded-lg border border-sky-500/40 bg-sky-500/5 p-1.5 relative transition-colors">
            <span className="absolute top-0.5 left-1.5 text-[8px] font-mono font-bold text-sky-400/90 tracking-widest uppercase">
              Border ({border.width || 'none'}
              {border.style && border.style !== 'none' ? ` ${border.style}` : ''})
            </span>

            {/* Padding (Inner) Box */}
            <div className="rounded border border-emerald-500/40 bg-emerald-500/5 p-1.5 mt-2 relative transition-colors">
              <span className="absolute top-0.5 left-1.5 text-[8px] font-mono font-bold text-emerald-400/90 tracking-widest uppercase">
                Padding (Inner)
              </span>

              {/* Top Padding Clickable Pill */}
              <div className="flex justify-center mb-1 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const next = cyclePaddingValue(padding.top, 'vertical');
                    setStyles({
                      ...styles,
                      padding: {
                        ...padding,
                        top: next,
                        bottom: isSidesLinked ? next : padding.bottom,
                        left: isSidesLinked ? next : padding.left,
                        right: isSidesLinked ? next : padding.right,
                      },
                    });
                  }}
                  title="Click to cycle top padding"
                  className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors cursor-pointer"
                >
                  T: {padding.top || '0'}
                </button>
              </div>

              {/* Padding Middle Row: Left, Element Core, Right */}
              <div className="flex items-center justify-between gap-1 my-1">
                {/* Left Padding Clickable Pill */}
                <button
                  type="button"
                  onClick={() => {
                    const next = cyclePaddingValue(padding.left, 'horizontal');
                    setStyles({
                      ...styles,
                      padding: {
                        ...padding,
                        left: next,
                        right: isSidesLinked ? next : padding.right,
                        top: isSidesLinked ? next : padding.top,
                        bottom: isSidesLinked ? next : padding.bottom,
                      },
                    });
                  }}
                  title="Click to cycle left padding"
                  className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors shrink-0 cursor-pointer"
                >
                  L: {padding.left || padding.top || '0'}
                </button>

                {/* Element Core Box */}
                <div className="flex-1 rounded border border-purple-500/40 bg-purple-500/10 py-1 px-2 mx-1 text-center">
                  <span className="text-[10px] font-mono font-bold text-accent-gold block truncate uppercase">
                    [ {currentBlock?.type || 'element'} ]
                  </span>
                  <span className="text-[8px] font-mono text-purple-300 block">
                    {layout.width || 'w-auto'} × {layout.height || 'h-auto'}
                  </span>
                </div>

                {/* Right Padding Clickable Pill */}
                <button
                  type="button"
                  onClick={() => {
                    const next = cyclePaddingValue(padding.right, 'horizontal');
                    setStyles({
                      ...styles,
                      padding: {
                        ...padding,
                        right: next,
                        left: isSidesLinked ? next : padding.left,
                        top: isSidesLinked ? next : padding.top,
                        bottom: isSidesLinked ? next : padding.bottom,
                      },
                    });
                  }}
                  title="Click to cycle right padding"
                  className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors shrink-0 cursor-pointer"
                >
                  R: {padding.right || padding.top || '0'}
                </button>
              </div>

              {/* Bottom Padding Clickable Pill */}
              <div className="flex justify-center mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const next = cyclePaddingValue(padding.bottom || padding.top, 'vertical');
                    setStyles({
                      ...styles,
                      padding: {
                        ...padding,
                        bottom: next,
                        top: isSidesLinked ? next : padding.top,
                        left: isSidesLinked ? next : padding.left,
                        right: isSidesLinked ? next : padding.right,
                      },
                    });
                  }}
                  title="Click to cycle bottom padding"
                  className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/30 transition-colors cursor-pointer"
                >
                  B: {padding.bottom || padding.top || '0'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Margin Clickable Pill */}
          <button
            type="button"
            onClick={() => {
              const next = cycleMarginValue(margin.right, 'horizontal');
              setStyles({
                ...styles,
                margin: {
                  ...margin,
                  right: next,
                  left: isSidesLinked ? next : margin.left,
                },
              });
            }}
            title="Click to cycle right margin"
            className="px-1.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors shrink-0 cursor-pointer"
          >
            R: {margin.right || '0'}
          </button>
        </div>

        {/* Bottom Margin Clickable Pill */}
        <div className="flex justify-center my-0.5">
          <button
            type="button"
            onClick={() => {
              const next = cycleMarginValue(margin.bottom || margin.top, 'vertical');
              setStyles({
                ...styles,
                margin: {
                  ...margin,
                  bottom: next,
                  top: isSidesLinked ? next : margin.top,
                },
              });
            }}
            title="Click to cycle bottom margin"
            className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold hover:bg-amber-500/30 transition-colors cursor-pointer"
          >
            B: {margin.bottom || margin.top || '0'}
          </button>
        </div>
      </div>
    </div>
  );
}
