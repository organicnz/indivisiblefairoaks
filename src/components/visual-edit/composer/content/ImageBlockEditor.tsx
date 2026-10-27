'use client';

import type { Block } from '@/lib/blocks';
import { StudioInput } from '../ui';

export interface ImageBlockEditorProps {
  currentBlock: Extract<Block, { type: 'image' }>;
  setCurrentBlock: (block: Block) => void;
  imageSrcId?: string;
  imageAltId?: string;
  imageCaptionId?: string;
}

export function ImageBlockEditor({
  currentBlock,
  setCurrentBlock,
  imageSrcId,
  imageAltId,
  imageCaptionId,
}: ImageBlockEditorProps) {
  return (
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
      <div className="grid grid-cols-2 gap-2">
        <StudioInput
          type="number"
          label="Intrinsic Width (px)"
          value={currentBlock.width != null ? String(currentBlock.width) : ''}
          onChange={(val) =>
            setCurrentBlock({
              ...currentBlock,
              width: val ? Number(val) : null,
            })
          }
          placeholder="e.g. 1200"
        />
        <StudioInput
          type="number"
          label="Intrinsic Height (px)"
          value={currentBlock.height != null ? String(currentBlock.height) : ''}
          onChange={(val) =>
            setCurrentBlock({
              ...currentBlock,
              height: val ? Number(val) : null,
            })
          }
          placeholder="e.g. 630"
        />
      </div>
    </div>
  );
}
