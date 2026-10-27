'use client';

import type { Block } from '@/lib/blocks';
import { StudioInput } from '../ui';

export interface ButtonBlockEditorProps {
  currentBlock: Extract<Block, { type: 'button' }>;
  setCurrentBlock: (block: Block) => void;
  buttonLabelId?: string;
  buttonHrefId?: string;
}

export function ButtonBlockEditor({
  currentBlock,
  setCurrentBlock,
  buttonLabelId,
  buttonHrefId,
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
    </div>
  );
}
