'use client';

import { Code2, Eraser } from 'lucide-react';
import type { Block } from '@/lib/blocks';
import { StudioSection } from '../ui';

export interface CodeHtmlStudioProps {
  currentBlock: Block;
  setCurrentBlock: (block: Block) => void;
  rawHtmlInputId?: string;
}

export function CodeHtmlStudio({
  currentBlock,
  setCurrentBlock,
  rawHtmlInputId = 'raw-html-editor-input',
}: CodeHtmlStudioProps) {
  const isHtmlBlock = 'html' in currentBlock && typeof currentBlock.html === 'string';
  const htmlContent = isHtmlBlock ? currentBlock.html : JSON.stringify(currentBlock, null, 2);

  /*
   * A row has no raw HTML to edit. Its markup is the columns and the blocks in
   * them, and the serializer writes it on save. The generic fallback below used
   * to show the block as JSON in a textarea whose change handler ignored every
   * keystroke — a field that accepted typing and discarded it, under a
   * description promising that changes persist.
   */
  if (currentBlock.type === 'row') {
    return (
      <StudioSection
        title="Raw Block HTML Markup"
        badge="Generated"
        description="A row's markup is generated from its columns, so there is no raw field to edit here."
      >
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
          Edit the row's columns and the blocks inside them in the <strong>Content</strong> tab. The
          save writes that structure as the row's markup, exactly as the live preview shows it.
        </p>
      </StudioSection>
    );
  }

  const handleCleanHtml = () => {
    if (!isHtmlBlock) return;
    // Normalize extraneous whitespace and linebreaks
    const cleaned = currentBlock.html.replace(/>\s+</g, '><').trim();
    setCurrentBlock({ ...currentBlock, html: cleaned });
  };

  return (
    <StudioSection
      title="Raw Block HTML Markup"
      badge="Direct HTML"
      description="Directly inspect and customize raw HTML markup. Changes persist directly into Supabase CMS."
      action={
        isHtmlBlock ? (
          <button
            type="button"
            onClick={handleCleanHtml}
            title="Clean extraneous whitespace"
            className="text-[9px] text-accent-gold flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Eraser size={10} />
            <span>Minify Spaces</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-2">
        <label htmlFor={rawHtmlInputId} className="sr-only">
          Raw Block HTML
        </label>
        <div className="relative">
          <textarea
            id={rawHtmlInputId}
            rows={8}
            value={htmlContent}
            onChange={(e) => {
              if (isHtmlBlock) {
                setCurrentBlock({ ...currentBlock, html: e.target.value });
              }
            }}
            placeholder="<div>Enter raw HTML markup here...</div>"
            className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-white font-mono text-[11px] focus:border-accent-gold/50 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
          <span className="flex items-center gap-1">
            <Code2 size={11} className="text-accent-gold" />
            <span>
              Target: {currentBlock.type} (#{currentBlock.id})
            </span>
          </span>
          <span>{htmlContent.length} chars</span>
        </div>
      </div>
    </StudioSection>
  );
}
