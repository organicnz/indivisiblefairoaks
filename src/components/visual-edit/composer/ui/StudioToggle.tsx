'use client';

import type { ReactNode } from 'react';

export interface StudioToggleProps {
  label: string;
  active: boolean;
  onToggle: () => void;
  description?: string;
  statusLabel?: string;
  icon?: ReactNode;
  activeTone?: 'gold' | 'rose' | 'emerald';
  className?: string;
  testId?: string;
}

export function StudioToggle({
  label,
  active,
  onToggle,
  description,
  statusLabel,
  icon,
  activeTone = 'gold',
  className = '',
  testId,
}: StudioToggleProps) {
  const activeClasses =
    activeTone === 'rose'
      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 font-bold'
      : activeTone === 'emerald'
        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
        : 'bg-accent-gold/20 border-accent-gold/40 text-accent-gold font-bold';

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-colors cursor-pointer ${
        active ? activeClasses : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
      } ${className}`}
    >
      <div>
        <span className="block text-xs">{label}</span>
        {description && <span className="block text-[10px] text-slate-400">{description}</span>}
      </div>
      {statusLabel ? <span className="text-[10px] font-mono">{statusLabel}</span> : icon}
    </button>
  );
}
