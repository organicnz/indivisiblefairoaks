'use client';

import { Check } from 'lucide-react';

export interface ColorSwatch {
  label: string;
  value: string;
  bgClass: string;
  borderClass?: string;
}

export interface ColorSwatchPickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  swatches?: readonly ColorSwatch[];
  className?: string;
}

export const DEFAULT_COLOR_SWATCHES: readonly ColorSwatch[] = [
  {
    label: 'Transparent',
    value: 'bg-transparent',
    bgClass: 'bg-transparent border border-dashed border-white/40',
  },
  {
    label: 'Midnight Slate',
    value: 'bg-slate-950',
    bgClass: 'bg-slate-950 border border-slate-700',
  },
  { label: 'Deep Navy', value: 'bg-blue-950', bgClass: 'bg-blue-950 border border-blue-800' },
  { label: 'Pure White', value: 'bg-white/95 text-neutral-900', bgClass: 'bg-white/95' },
  { label: 'Civic Gold', value: 'bg-amber-500/10 text-amber-500', bgClass: 'bg-amber-500' },
  {
    label: 'Emerald Green',
    value: 'bg-emerald-500/10 text-emerald-500',
    bgClass: 'bg-emerald-500',
  },
  { label: 'Crimson Alert', value: 'bg-rose-500/10 text-rose-500', bgClass: 'bg-rose-500' },
  {
    label: 'Frost Glass',
    value: 'bg-white/10 backdrop-blur-md',
    bgClass: 'bg-white/20 backdrop-blur-sm border border-white/30',
  },
] as const;

export const TYPOGRAPHY_COLOR_SWATCHES: readonly ColorSwatch[] = [
  { label: 'Default Ink', value: 'text-foreground', bgClass: 'bg-white/40' },
  { label: 'Civic Gold', value: 'text-accent-gold', bgClass: 'bg-amber-400' },
  { label: 'Bright White', value: 'text-white', bgClass: 'bg-white/95' },
  { label: 'Patriotic Sky', value: 'text-sky-300', bgClass: 'bg-sky-400' },
  { label: 'Alert Crimson', value: 'text-rose-400', bgClass: 'bg-rose-400' },
  { label: 'Success Green', value: 'text-emerald-400', bgClass: 'bg-emerald-500' },
] as const;

export function ColorSwatchPicker({
  label,
  value,
  onChange,
  swatches = DEFAULT_COLOR_SWATCHES,
  className = '',
}: ColorSwatchPickerProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <span className="text-[10px] text-slate-400 block font-medium">{label}</span>}
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl bg-slate-900 border border-white/10">
        {swatches.map((swatch) => {
          const isActive = value.includes(swatch.value);
          return (
            <button
              key={swatch.label}
              type="button"
              onClick={() => onChange(swatch.value)}
              title={`${swatch.label}: ${swatch.value}`}
              aria-label={`Select ${swatch.label}`}
              className={`h-6 w-6 rounded-lg transition-transform hover:scale-110 flex items-center justify-center cursor-pointer relative shadow-xs ${
                swatch.bgClass
              } ${isActive ? 'ring-2 ring-accent-gold ring-offset-1 ring-offset-slate-900 scale-105' : ''}`}
            >
              {isActive && (
                <Check
                  size={12}
                  className={swatch.label === 'Pure White' ? 'text-black' : 'text-accent-gold'}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
