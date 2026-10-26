'use client';

import { useId } from 'react';

export interface StudioInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: 'xs' | 'sm';
  type?: 'text' | 'number' | 'url';
  prefix?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

export function StudioInput({
  id: explicitId,
  label,
  value,
  onChange,
  placeholder,
  size = 'sm',
  type = 'text',
  prefix,
  description,
  className = '',
  disabled = false,
}: StudioInputProps) {
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
      <div className="relative">
        {prefix && (
          <span className="absolute left-2.5 top-2 text-xs font-mono text-slate-400 select-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={
            isXs
              ? `w-full rounded border border-white/10 bg-slate-900 ${prefix ? 'pl-5 pr-1 py-1' : 'p-1'} text-white text-[10px] placeholder:text-white/30 focus:border-accent-gold/50 focus:outline-none transition-colors`
              : `w-full rounded-lg border border-white/10 bg-slate-900 ${prefix ? 'pl-6 pr-2.5 py-1.5' : 'px-2.5 py-1.5'} text-xs text-white placeholder:text-white/30 focus:border-accent-gold/50 focus:outline-none transition-colors`
          }
        />
      </div>
      {description && <p className="mt-1 text-[10px] text-slate-400">{description}</p>}
    </div>
  );
}
