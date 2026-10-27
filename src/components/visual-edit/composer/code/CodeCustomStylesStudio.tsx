'use client';

import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { VisualComposerStyles } from '@/types/unified';
import { CIVIC_CLASS_PRESETS } from '../constants';
import { StudioInput } from '../ui';

export interface CodeCustomStylesStudioProps {
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  blockAnchorIdInputId?: string;
  customClassesInputId?: string;
  customStyleInputId?: string;
}

const INLINE_CSS_QUICK_SNIPPETS = [
  { label: 'Tracking Spacing', snippet: 'letter-spacing: 0.05em;' },
  {
    label: 'Dashed Outline',
    snippet: 'outline: 2px dashed rgba(245, 158, 11, 0.4); outline-offset: 4px;',
  },
  { label: '3D Perspective', snippet: 'perspective: 1000px; transform-style: preserve-3d;' },
  { label: 'Backdrop Contrast', snippet: 'backdrop-filter: contrast(125%) saturate(140%);' },
] as const;

export function CodeCustomStylesStudio({
  styles,
  setStyles,
  blockAnchorIdInputId = 'block-anchor-id-input',
  customClassesInputId = 'block-custom-classes-input',
  customStyleInputId = 'code-custom-style-input',
}: CodeCustomStylesStudioProps) {
  return (
    <div className="space-y-4">
      {/* Block Element Anchor ID */}
      <StudioInput
        id={blockAnchorIdInputId}
        label="Block Element Anchor ID (Deep Linking)"
        prefix="#"
        value={styles.anchorId}
        onChange={(val) =>
          setStyles({
            ...styles,
            anchorId: val.replace(/[^a-zA-Z0-9_-]/g, ''),
          })
        }
        placeholder="e.g. block-cta, hero-heading"
      />

      {/* Custom Classes & Utility Tokens */}
      <div>
        <StudioInput
          id={customClassesInputId}
          label="Custom CSS & Tailwind Utilities"
          value={styles.customClasses}
          onChange={(val) => setStyles({ ...styles, customClasses: val })}
          placeholder="e.g. shadow-2xl backdrop-blur-lg hover:rotate-1"
        />

        {/* Quick Civic Class Tokens */}
        <div className="mt-2.5">
          <span className="text-[10px] text-slate-400 block mb-1">Quick Design Tokens:</span>
          <div className="flex flex-wrap gap-1">
            {CIVIC_CLASS_PRESETS.map((token) => (
              <button
                key={token.label}
                type="button"
                onClick={() => {
                  const existing = styles.customClasses.split(/\s+/).filter(Boolean);
                  if (!existing.includes(token.value)) {
                    setStyles({
                      ...styles,
                      customClasses: [...existing, token.value].join(' '),
                    });
                    toast.success(`Appended ${token.label}`);
                  }
                }}
                className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-[10px] text-slate-300 hover:border-accent-gold/50 hover:bg-white/10 hover:text-accent-gold transition-colors cursor-pointer"
              >
                +{token.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Inline CSS Styles */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={customStyleInputId} className="block text-slate-300 font-bold text-xs">
            Custom Inline CSS Styles (style="...")
          </label>
        </div>
        <input
          id={customStyleInputId}
          type="text"
          value={styles.customStyle || ''}
          onChange={(e) => setStyles({ ...styles, customStyle: e.target.value })}
          placeholder="e.g. letter-spacing: 0.1em; outline: 1px dashed gold;"
          className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          Custom inline CSS rules applied directly to the outer block element container.
        </p>

        {/* Quick Inline CSS Snippet Chips */}
        <div className="mt-2 flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mr-1">
            <Sparkles size={10} className="text-accent-gold" />
            <span>Presets:</span>
          </span>
          {INLINE_CSS_QUICK_SNIPPETS.map((snippet) => (
            <button
              key={snippet.label}
              type="button"
              onClick={() => {
                const current = (styles.customStyle || '').trim();
                const separator = current && !current.endsWith(';') ? '; ' : current ? ' ' : '';
                setStyles({
                  ...styles,
                  customStyle: `${current}${separator}${snippet.snippet}`,
                });
                toast.success(`Added ${snippet.label}`);
              }}
              className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-[10px] text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              +{snippet.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
