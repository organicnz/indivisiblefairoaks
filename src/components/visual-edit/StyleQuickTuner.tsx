'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AlignCenter, AlignLeft, AlignRight, Palette, SlidersHorizontal, Type } from 'lucide-react';
import type React from 'react';
import { toast } from 'sonner';

interface StyleQuickTunerProps {
  element: HTMLElement;
  defaultOpen?: boolean;
}

const FONT_SIZES = [
  { label: 'XS', class: 'text-xs' },
  { label: 'SM', class: 'text-sm' },
  { label: 'Base', class: 'text-base' },
  { label: 'LG', class: 'text-lg' },
  { label: 'XL', class: 'text-xl' },
  { label: '2XL', class: 'text-2xl' },
  { label: '3XL', class: 'text-3xl' },
];

const FONT_WEIGHTS = [
  { label: 'Normal', class: 'font-normal' },
  { label: 'Medium', class: 'font-medium' },
  { label: 'Semi', class: 'font-semibold' },
  { label: 'Bold', class: 'font-bold' },
  { label: 'Black', class: 'font-black' },
];

const COLOR_PRESETS = [
  { label: 'Gold', class: 'text-accent-gold', bg: 'bg-amber-400' },
  { label: 'Emerald', class: 'text-emerald-500', bg: 'bg-emerald-500' },
  { label: 'Sky', class: 'text-sky-400', bg: 'bg-sky-400' },
  { label: 'Purple', class: 'text-purple-400', bg: 'bg-purple-400' },
  { label: 'Rose', class: 'text-rose-500', bg: 'bg-rose-500' },
  { label: 'Default', class: 'text-foreground', bg: 'bg-white/90' },
];

export const StyleQuickTuner: React.FC<StyleQuickTunerProps> = ({ element, defaultOpen }) => {
  const toggleClass = (classesToRemove: string[], classToAdd: string) => {
    for (const c of classesToRemove) {
      element.classList.remove(c);
    }
    if (classToAdd && classToAdd !== 'normal-case') {
      element.classList.add(classToAdd);
    }
    toast.success(`Updated style (${classToAdd || 'reset'})`);
  };

  const handleAlign = (alignment: 'left' | 'center' | 'right') => {
    element.classList.remove('text-left', 'text-center', 'text-right');
    element.classList.add(`text-${alignment}`);
    toast.success(`Aligned ${alignment}`);
  };

  const handleFontFamily = (family: 'sans' | 'mono' | 'serif') => {
    element.classList.remove('font-sans', 'font-mono', 'font-serif');
    element.classList.add(`font-${family}`);
    toast.success(`Font set to ${family}`);
  };

  return (
    <DropdownMenu.Root defaultOpen={defaultOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title="Adjust element typography & colors in real-time"
          aria-label="Style quick tuner"
          className="inline-flex items-center gap-1 rounded px-2 py-1 font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors text-[11px] cursor-pointer"
        >
          <SlidersHorizontal size={12} />
          <span className="hidden md:inline">Style</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 w-72 rounded-2xl border border-white/15 bg-secondary p-3 shadow-float text-white text-xs animate-in fade-in-0 zoom-in-95 space-y-3"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-ink-muted-on-dark flex items-center gap-1">
              <Type size={12} className="text-accent-gold" />
              <span>In-Place Style Tuner</span>
            </span>
          </div>

          {/* Size */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Size
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {FONT_SIZES.map((sz) => (
                <button
                  key={sz.class}
                  type="button"
                  onClick={() =>
                    toggleClass(
                      FONT_SIZES.map((s) => s.class),
                      sz.class
                    )
                  }
                  className="rounded px-2 py-1 text-[10px] font-bold bg-white/5 border border-white/10 hover:bg-white/15 text-slate-200 transition-colors cursor-pointer"
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          {/* Weight */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Weight
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {FONT_WEIGHTS.map((w) => (
                <button
                  key={w.class}
                  type="button"
                  onClick={() =>
                    toggleClass(
                      FONT_WEIGHTS.map((fw) => fw.class),
                      w.class
                    )
                  }
                  className="rounded px-2 py-1 text-[10px] font-semibold bg-white/5 border border-white/10 hover:bg-white/15 text-slate-200 transition-colors cursor-pointer"
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Alignment & Family */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Align
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAlign('left')}
                  className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/15 text-slate-300 cursor-pointer"
                  title="Align left"
                  aria-label="Align left"
                >
                  <AlignLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlign('center')}
                  className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/15 text-slate-300 cursor-pointer"
                  title="Align center"
                  aria-label="Align center"
                >
                  <AlignCenter size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlign('right')}
                  className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/15 text-slate-300 cursor-pointer"
                  title="Align right"
                  aria-label="Align right"
                >
                  <AlignRight size={13} />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Font
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleFontFamily('sans')}
                  className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-white/5 border border-white/10 hover:bg-white/15 cursor-pointer"
                >
                  Sans
                </button>
                <button
                  type="button"
                  onClick={() => handleFontFamily('mono')}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 hover:bg-white/15 cursor-pointer"
                >
                  Mono
                </button>
                <button
                  type="button"
                  onClick={() => handleFontFamily('serif')}
                  className="px-1.5 py-0.5 rounded text-[10px] font-serif bg-white/5 border border-white/10 hover:bg-white/15 cursor-pointer"
                >
                  Serif
                </button>
              </div>
            </div>
          </div>

          {/* Color Palettes */}
          <div className="space-y-1 pt-1 border-t border-white/10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Palette size={11} />
              <span>Accent Color</span>
            </span>
            <div className="flex items-center gap-2">
              {COLOR_PRESETS.map((col) => (
                <button
                  key={col.label}
                  type="button"
                  onClick={() =>
                    toggleClass(
                      COLOR_PRESETS.map((c) => c.class),
                      col.class
                    )
                  }
                  title={col.label}
                  aria-label={`Color ${col.label}`}
                  className="size-5 rounded-full border border-white/30 hover:scale-110 transition-transform flex items-center justify-center p-0.5 cursor-pointer"
                >
                  <span className={`size-full rounded-full ${col.bg}`} />
                </button>
              ))}
            </div>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
