'use client';

import { Download, SlidersHorizontal, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { Block } from '@/lib/blocks';
import type { VisualComposerStyles } from '@/types/unified';
import { CIVIC_CLASS_PRESETS } from './constants';
import { StudioInput, StudioSection } from './ui';

export interface CodeStudioProps {
  currentBlock: Block;
  setCurrentBlock: (block: Block) => void;
  styles: VisualComposerStyles;
  setStyles: React.Dispatch<React.SetStateAction<VisualComposerStyles>>;
  rawHtmlInputId: string;
  blockAnchorIdInputId: string;
  customClassesInputId: string;
  customStyleInputId?: string;
  designJsonInputId: string;
  jsonConfigDraft: string;
  setJsonConfigDraft: (draft: string) => void;
  onExportJson: () => void;
  onImportJson: () => void;
}

export function CodeStudio({
  currentBlock,
  setCurrentBlock,
  styles,
  setStyles,
  rawHtmlInputId,
  blockAnchorIdInputId,
  customClassesInputId,
  customStyleInputId = 'code-custom-style-input',
  designJsonInputId,
  jsonConfigDraft,
  setJsonConfigDraft,
  onExportJson,
  onImportJson,
}: CodeStudioProps) {
  return (
    <div className="space-y-4">
      {/* Raw HTML Editor */}
      <StudioSection
        title="Raw Block HTML Markup"
        badge="Direct HTML"
        description="Directly view and edit raw HTML markup. Changes persist to Supabase CMS."
      >
        <label htmlFor={rawHtmlInputId} className="sr-only">
          Raw Block HTML
        </label>
        <textarea
          id={rawHtmlInputId}
          rows={8}
          value={
            'html' in currentBlock && typeof currentBlock.html === 'string'
              ? currentBlock.html
              : JSON.stringify(currentBlock, null, 2)
          }
          onChange={(e) => {
            if ('html' in currentBlock) {
              setCurrentBlock({ ...currentBlock, html: e.target.value });
            }
          }}
          className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-white font-mono text-[11px] focus:border-accent-gold/50 focus:outline-none"
        />
      </StudioSection>

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
        <label htmlFor={customStyleInputId} className="block text-slate-300 font-bold mb-1">
          Custom Inline CSS Styles (style="...")
        </label>
        <input
          id={customStyleInputId}
          type="text"
          value={styles.customStyle || ''}
          onChange={(e) => setStyles({ ...styles, customStyle: e.target.value })}
          placeholder="e.g. background-image: radial-gradient(...); letter-spacing: 0.05em;"
          className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          Custom inline CSS rules applied directly to the outer block element container.
        </p>
      </div>

      {/* 1-Click Design Config JSON Exchange Studio */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <SlidersHorizontal size={13} className="text-accent-gold" />
            <span>Design Config JSON Studio</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onExportJson}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Download size={11} />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={onImportJson}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border border-accent-gold/40 bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30 transition-colors cursor-pointer"
            >
              <Upload size={11} />
              <span>Import JSON</span>
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Export full design token styles as portable JSON to share across blocks or import external
          presets.
        </p>
        <label htmlFor={designJsonInputId} className="sr-only">
          Design Configuration JSON
        </label>
        <textarea
          id={designJsonInputId}
          rows={5}
          value={jsonConfigDraft}
          onChange={(e) => setJsonConfigDraft(e.target.value)}
          placeholder='Click "Export JSON" to inspect token state, or paste JSON here and click "Import JSON"...'
          className="w-full rounded-lg border border-white/10 bg-slate-950 p-2.5 text-white font-mono text-[10px] focus:border-accent-gold/50 focus:outline-none placeholder:text-white/40"
        />
      </div>
    </div>
  );
}
