'use client';

import { useId } from 'react';

export interface StudioOption {
  value: string;
  label: string;
}

export interface StudioSelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (string | StudioOption)[];
  size?: 'xs' | 'sm';
  description?: string;
  className?: string;
  disabled?: boolean;
}

export function StudioSelect({
  id: explicitId,
  label,
  value,
  onChange,
  options,
  size = 'sm',
  description,
  className = '',
  disabled = false,
}: StudioSelectProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const isXs = size === 'xs';

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className={
            isXs
              ? 'text-[9px] text-slate-400 block mb-0.5'
              : 'text-[10px] text-slate-400 mb-1 block'
          }
        >
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={
          isXs
            ? 'w-full rounded border border-white/10 bg-slate-900 p-1 text-white text-[10px] focus:border-accent-gold/50 focus:outline-none transition-colors'
            : 'w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-white focus:border-accent-gold/50 focus:outline-none transition-colors'
        }
      >
        {options.map((opt) => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lbl = typeof opt === 'string' ? opt : opt.label;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
      {description && <p className="mt-1 text-[10px] text-slate-400">{description}</p>}
    </div>
  );
}
