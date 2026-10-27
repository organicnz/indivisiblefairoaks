'use client';

import { Layers, Monitor, Moon, Sun } from 'lucide-react';
import { useId } from 'react';
import { playThemeHaptic } from '@/lib/theme';
import type { VisualComposerThemeMode } from '@/types/unified';

export interface ThemeModeSelectorProps {
  id?: string;
  label?: string;
  value: VisualComposerThemeMode | string;
  onChange: (value: VisualComposerThemeMode) => void;
  description?: string;
  className?: string;
}

const THEME_OPTIONS: readonly {
  mode: VisualComposerThemeMode;
  label: string;
  shortLabel: string;
  desc: string;
  icon: typeof Monitor;
}[] = [
  {
    mode: 'inherit',
    label: 'Inherit Site Theme',
    shortLabel: 'Inherit',
    desc: 'Inherits global reader & site theme preferences dynamically.',
    icon: Layers,
  },
  {
    mode: 'system',
    label: 'System Adaptive',
    shortLabel: 'System',
    desc: 'Reacts automatically to user OS / device dark or light mode setting.',
    icon: Monitor,
  },
  {
    mode: 'light',
    label: 'Light Mode Pin',
    shortLabel: 'Light',
    desc: 'Forces crisp light canvas surface with high-contrast ink text.',
    icon: Sun,
  },
  {
    mode: 'dark',
    label: 'Dark Mode Pin',
    shortLabel: 'Dark',
    desc: 'Forces sleek midnight slate canvas with luminous typography.',
    icon: Moon,
  },
] as const;

export function ThemeModeSelector({
  id: explicitId,
  label = 'Theme Tone Mode Override',
  value = 'inherit',
  onChange,
  description,
  className = '',
}: ThemeModeSelectorProps) {
  const generatedId = useId();
  const selectId = explicitId || generatedId;
  const currentMode = (value as VisualComposerThemeMode) || 'inherit';

  const handleSelect = (mode: VisualComposerThemeMode) => {
    if (mode === 'light' || mode === 'dark' || mode === 'system') {
      playThemeHaptic(mode);
    }
    onChange(mode);
  };

  const activeOption = THEME_OPTIONS.find((o) => o.mode === currentMode) || THEME_OPTIONS[0];

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={selectId} className="text-[10px] text-slate-400 block font-semibold">
            {label}
          </label>
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-accent-gold border border-accent-gold/30">
            {activeOption.shortLabel}
          </span>
        </div>
      )}

      {/* Visual Pill Buttons */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-900 border border-white/10">
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = currentMode === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => handleSelect(opt.mode)}
              title={opt.label}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-accent-gold text-ink-strong shadow-sm font-black'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={12} />
              <span className="truncate max-w-full text-[9px]">{opt.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Native Select element for accessibility & tests querying select#id */}
      <select
        id={selectId}
        value={currentMode}
        onChange={(e) => handleSelect(e.target.value as VisualComposerThemeMode)}
        className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-[11px] text-white focus:border-accent-gold/50 focus:outline-none transition-colors"
      >
        {THEME_OPTIONS.map((opt) => (
          <option key={opt.mode} value={opt.mode}>
            {opt.label}
          </option>
        ))}
      </select>

      <p className="text-[10px] text-slate-400 leading-normal">
        {description || activeOption.desc}
      </p>
    </div>
  );
}
