'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { playThemeHaptic, type ThemeMode } from '@/lib/theme';

export interface ThemePreviewToggleProps {
  currentMode: ThemeMode;
  onSelectMode: (mode: ThemeMode) => void;
  compact?: boolean;
  className?: string;
}

export function ThemePreviewToggle({
  currentMode,
  onSelectMode,
  compact = false,
  className = '',
}: ThemePreviewToggleProps) {
  const modes: { mode: ThemeMode; label: string; icon: typeof Monitor }[] = [
    { mode: 'system', label: compact ? 'Sys' : 'System', icon: Monitor },
    { mode: 'light', label: compact ? 'Light' : 'Light', icon: Sun },
    { mode: 'dark', label: compact ? 'Dark' : 'Dark', icon: Moon },
  ];

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-white/10 bg-slate-900/90 p-0.5 text-xs ${className}`}
    >
      {modes.map(({ mode, label, icon: Icon }) => {
        const isActive = currentMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => {
              playThemeHaptic(mode);
              onSelectMode(mode);
            }}
            title={`Preview in ${label} mode`}
            aria-label={`Preview in ${label} mode`}
            aria-pressed={isActive}
            className={`flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-all duration-200 cursor-pointer ${
              isActive
                ? 'bg-accent-gold text-ink-strong font-bold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            } ${compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px]'}`}
          >
            <Icon size={compact ? 10 : 12} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
