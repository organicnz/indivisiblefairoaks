'use client';

import type { ReactNode } from 'react';

export interface StudioSectionProps {
  title: string;
  badge?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function StudioSection({
  title,
  badge,
  description,
  children,
  className = '',
  action,
}: StudioSectionProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="block text-slate-300 font-bold text-xs">{title}</span>
          {badge && (
            <span className="text-[9px] font-bold text-accent-gold uppercase tracking-wider bg-accent-gold/10 px-1.5 py-0.5 rounded border border-accent-gold/20">
              {badge}
            </span>
          )}
        </div>
        {action}
      </div>
      {description && <p className="text-[11px] text-slate-400">{description}</p>}
      {children}
    </div>
  );
}
