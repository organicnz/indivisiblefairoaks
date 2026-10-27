'use client';

import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { type Block, type ContentBlockType, convertBlock } from '@/lib/blocks';
import { StudioSection } from '../ui';

export interface BlockTypeConverterProps {
  currentBlock: Block;
  setCurrentBlock: (block: Block) => void;
}

const BLOCK_TYPE_OPTIONS: readonly { type: ContentBlockType; label: string }[] = [
  { type: 'heading', label: 'Heading' },
  { type: 'paragraph', label: 'Paragraph' },
  { type: 'callout', label: 'Callout' },
  { type: 'quote', label: 'Quote' },
  { type: 'bulletList', label: 'Bullet List' },
  { type: 'orderedList', label: 'Numbered List' },
  { type: 'button', label: 'Button' },
  { type: 'code', label: 'Code' },
] as const;

export function BlockTypeConverter({ currentBlock, setCurrentBlock }: BlockTypeConverterProps) {
  return (
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
        {BLOCK_TYPE_OPTIONS.map((t) => (
          <button
            key={t.type}
            type="button"
            disabled={currentBlock.type === t.type}
            onClick={() => {
              const converted = convertBlock(currentBlock, t.type);
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
  );
}
