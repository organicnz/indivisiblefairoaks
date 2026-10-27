'use client';

import type { Block } from '@/lib/blocks';
import { StudioInput } from '../ui';

export interface ButtonBlockEditorProps {
  currentBlock: Extract<Block, { type: 'button' }>;
  setCurrentBlock: (block: Block) => void;
  buttonLabelId?: string;
  buttonHrefId?: string;
}

const QUICK_CIVIC_ROUTES = [
  { label: 'Events Calendar', href: '/events' },
  { label: 'Donate to Cause', href: '/donate' },
  { label: 'Contact Organizers', href: '/contact' },
  { label: 'Voter Information', href: '/voter-info' },
  { label: 'About Indivisible', href: '/about' },
  { label: 'News & Updates', href: '/news' },
] as const;

export function ButtonBlockEditor({
  currentBlock,
  setCurrentBlock,
  buttonLabelId = 'button-label-input',
  buttonHrefId = 'button-href-input',
}: ButtonBlockEditorProps) {
  return (
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

      {/* 1-Click Civic Destination Shortcuts */}
      <div className="space-y-1.5 pt-1">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Quick Destination Links
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_CIVIC_ROUTES.map((route) => (
            <button
              key={route.href}
              type="button"
              onClick={() => setCurrentBlock({ ...currentBlock, href: route.href })}
              className={`rounded-lg border px-2 py-1 text-left text-[11px] font-medium transition-colors ${
                currentBlock.href === route.href
                  ? 'border-accent-gold/50 bg-accent-gold/20 text-accent-gold'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              {route.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
