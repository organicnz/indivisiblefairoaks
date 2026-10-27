'use client';

import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { type Block, type ContentBlockType, convertBlock, type HeadingLevel } from '@/lib/blocks';
import { StudioInput, StudioSection } from './ui';

export interface BlockContentStudioProps {
  currentBlock: Block;
  setCurrentBlock: (block: Block) => void;
  headingTextId: string;
  paragraphTextId: string;
  imageSrcId: string;
  imageAltId: string;
  imageCaptionId: string;
  buttonLabelId: string;
  buttonHrefId: string;
  calloutTextId: string;
  quoteTextId: string;
  listItemsId: string;
  codeTextId: string;
  tableHeadId: string;
  tableRowsId: string;
  unsupportedHtmlId: string;
}

export function BlockContentStudio({
  currentBlock,
  setCurrentBlock,
  headingTextId,
  paragraphTextId,
  imageSrcId,
  imageAltId,
  imageCaptionId,
  buttonLabelId,
  buttonHrefId,
  calloutTextId,
  quoteTextId,
  listItemsId,
  codeTextId,
  tableHeadId,
  tableRowsId,
  unsupportedHtmlId,
}: BlockContentStudioProps) {
  return (
    <div className="space-y-4">
      {/* Element Type Morphing / Converter */}
      <StudioSection title="Element Type & Conversion" badge={currentBlock.type.toUpperCase()}>
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-2">
          <span className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-accent-gold" />
            <span>
              Element Type:{' '}
              <strong className="text-accent-gold uppercase font-mono">{currentBlock.type}</strong>
            </span>
          </span>
          <span className="text-slate-400 text-[10px] font-normal">Convert element copy</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            { type: 'heading', label: 'Heading' },
            { type: 'paragraph', label: 'Paragraph' },
            { type: 'callout', label: 'Callout' },
            { type: 'quote', label: 'Quote' },
            { type: 'bulletList', label: 'Bullet List' },
            { type: 'button', label: 'Button' },
            { type: 'code', label: 'Code' },
          ].map((t) => (
            <button
              key={t.type}
              type="button"
              disabled={currentBlock.type === t.type}
              onClick={() => {
                const converted = convertBlock(currentBlock, t.type as ContentBlockType);
                setCurrentBlock(converted);
                toast.success(`Converted to ${t.label}`);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                currentBlock.type === t.type
                  ? 'bg-accent-gold text-ink-strong font-black shadow-xs'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10 cursor-pointer'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </StudioSection>

      <StudioSection title="Element Content & Copy" badge="Content">
        {currentBlock.type === 'heading' && (
          <div className="space-y-3">
            <span className="block text-slate-300 font-bold">Heading Level</span>
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5, 6] as HeadingLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setCurrentBlock({ ...currentBlock, level: lvl })}
                  className={`flex-1 py-1.5 rounded-lg font-bold border transition-colors ${
                    currentBlock.level === lvl
                      ? 'bg-accent-gold text-ink-strong border-accent-gold font-black'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  H{lvl}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor={headingTextId} className="block text-slate-300 font-bold mb-1">
                Heading Text
              </label>
              <textarea
                id={headingTextId}
                rows={3}
                value={currentBlock.html}
                onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/40"
              />
            </div>
          </div>
        )}

        {currentBlock.type === 'paragraph' && (
          <div className="space-y-2">
            <label htmlFor={paragraphTextId} className="block text-slate-300 font-bold">
              Paragraph HTML / Content
            </label>
            <textarea
              id={paragraphTextId}
              rows={6}
              value={currentBlock.html}
              onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/40 font-mono text-[11px]"
            />
            <p className="text-[10px] text-slate-400">Supports rich inline HTML tags.</p>
          </div>
        )}

        {currentBlock.type === 'image' && (
          <div className="space-y-3">
            <StudioInput
              id={imageSrcId}
              type="url"
              label="Image URL"
              value={currentBlock.src}
              onChange={(val) => setCurrentBlock({ ...currentBlock, src: val })}
              placeholder="https://..."
            />
            <StudioInput
              id={imageAltId}
              label="Alt Text"
              value={currentBlock.alt}
              onChange={(val) => setCurrentBlock({ ...currentBlock, alt: val })}
              placeholder="Describe image for accessibility"
            />
            <StudioInput
              id={imageCaptionId}
              label="Caption"
              value={currentBlock.caption}
              onChange={(val) => setCurrentBlock({ ...currentBlock, caption: val })}
              placeholder="Optional image caption"
            />
          </div>
        )}

        {currentBlock.type === 'button' && (
          <div className="space-y-3">
            <StudioInput
              id={buttonLabelId}
              label="Button Label"
              value={currentBlock.label}
              onChange={(val) => setCurrentBlock({ ...currentBlock, label: val })}
            />
            <StudioInput
              id={buttonHrefId}
              label="Destination URL"
              value={currentBlock.href}
              onChange={(val) => setCurrentBlock({ ...currentBlock, href: val })}
            />
          </div>
        )}

        {currentBlock.type === 'callout' && (
          <div className="space-y-3">
            <span className="block text-slate-300 font-bold">Callout Tone</span>
            <div className="flex gap-2">
              {(['info', 'action', 'warning'] as const).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setCurrentBlock({ ...currentBlock, tone })}
                  className={`flex-1 py-1.5 rounded-lg font-bold border capitalize transition-colors ${
                    currentBlock.tone === tone
                      ? 'bg-accent-gold text-ink-strong border-accent-gold font-black'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor={calloutTextId} className="block text-slate-300 font-bold mb-1">
                Callout Text
              </label>
              <textarea
                id={calloutTextId}
                rows={4}
                value={currentBlock.html}
                onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none"
              />
            </div>
          </div>
        )}

        {currentBlock.type === 'quote' && (
          <div>
            <label htmlFor={quoteTextId} className="block text-slate-300 font-bold mb-1">
              Quote Content
            </label>
            <textarea
              id={quoteTextId}
              rows={4}
              value={currentBlock.html}
              onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none"
            />
          </div>
        )}

        {(currentBlock.type === 'bulletList' || currentBlock.type === 'orderedList') && (
          <div>
            <label htmlFor={listItemsId} className="block text-slate-300 font-bold mb-1">
              List Items (one per line)
            </label>
            <textarea
              id={listItemsId}
              rows={6}
              value={currentBlock.items.join('\n')}
              onChange={(e) =>
                setCurrentBlock({ ...currentBlock, items: e.target.value.split('\n') })
              }
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono"
            />
          </div>
        )}

        {currentBlock.type === 'code' && (
          <div className="space-y-2">
            <label htmlFor={codeTextId} className="block text-slate-300 font-bold">
              Code Snippet
            </label>
            <textarea
              id={codeTextId}
              rows={6}
              value={currentBlock.text}
              onChange={(e) => setCurrentBlock({ ...currentBlock, text: e.target.value })}
              placeholder="console.log('Civic action');"
              className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-emerald-400 placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
            />
          </div>
        )}

        {currentBlock.type === 'table' && (
          <div className="space-y-3">
            <StudioInput
              id={tableHeadId}
              label="Table Columns (comma-separated headers)"
              value={currentBlock.head.join(', ')}
              onChange={(val) =>
                setCurrentBlock({
                  ...currentBlock,
                  head: val
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Date, Action, Organizer"
            />
            <div>
              <label htmlFor={tableRowsId} className="block text-slate-300 font-bold mb-1">
                Table Data Rows (one row per line, comma-separated cells)
              </label>
              <textarea
                id={tableRowsId}
                rows={5}
                value={currentBlock.rows.map((r) => r.join(', ')).join('\n')}
                onChange={(e) =>
                  setCurrentBlock({
                    ...currentBlock,
                    rows: e.target.value
                      .split('\n')
                      .filter((line) => line.trim())
                      .map((line) => line.split(',').map((s) => s.trim())),
                  })
                }
                placeholder="Nov 5, General Election, Fair Oaks\nDec 12, Organizing Rally, Carmichael"
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-xs"
              />
            </div>
          </div>
        )}

        {currentBlock.type === 'divider' && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center space-y-2">
            <span className="block text-slate-300 font-bold">Horizontal Section Divider</span>
            <p className="text-xs text-slate-400">
              This divider cleanly separates major sections. Customize margins, thickness, and
              borders in the Box Model tab.
            </p>
            <hr className="my-2 border-t border-accent-gold/40" />
          </div>
        )}

        {currentBlock.type === 'unsupported' && (
          <div className="space-y-2">
            <label htmlFor={unsupportedHtmlId} className="block text-slate-300 font-bold">
              Raw HTML Markup
            </label>
            <textarea
              id={unsupportedHtmlId}
              rows={8}
              value={currentBlock.html}
              onChange={(e) => setCurrentBlock({ ...currentBlock, html: e.target.value })}
              placeholder="<div>...</div>"
              className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sky-400 placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none font-mono text-[11px]"
            />
          </div>
        )}
      </StudioSection>
    </div>
  );
}
