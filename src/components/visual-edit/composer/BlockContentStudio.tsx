'use client';

import { useId } from 'react';
import type { Block } from '@/lib/blocks';
import {
  BlockTypeConverter,
  ButtonBlockEditor,
  CalloutBlockEditor,
  CodeBlockEditor,
  DividerBlockEditor,
  HeadingBlockEditor,
  ImageBlockEditor,
  ListBlockEditor,
  ParagraphBlockEditor,
  QuoteBlockEditor,
  TableBlockEditor,
  UnsupportedBlockEditor,
} from './content';
import { StudioSection } from './ui';

export {
  BlockTypeConverter,
  ButtonBlockEditor,
  CalloutBlockEditor,
  CodeBlockEditor,
  DividerBlockEditor,
  HeadingBlockEditor,
  ImageBlockEditor,
  ListBlockEditor,
  ParagraphBlockEditor,
  QuoteBlockEditor,
  TableBlockEditor,
  UnsupportedBlockEditor,
};

export interface BlockContentStudioProps {
  currentBlock: Block;
  setCurrentBlock: (block: Block) => void;
  headingTextId?: string;
  paragraphTextId?: string;
  imageSrcId?: string;
  imageAltId?: string;
  imageCaptionId?: string;
  buttonLabelId?: string;
  buttonHrefId?: string;
  calloutTextId?: string;
  quoteTextId?: string;
  listItemsId?: string;
  codeTextId?: string;
  tableHeadId?: string;
  tableRowsId?: string;
  unsupportedHtmlId?: string;
}

export function BlockContentStudio({
  currentBlock,
  setCurrentBlock,
  headingTextId: explicitHeadingTextId,
  paragraphTextId: explicitParagraphTextId,
  imageSrcId: explicitImageSrcId,
  imageAltId: explicitImageAltId,
  imageCaptionId: explicitImageCaptionId,
  buttonLabelId: explicitButtonLabelId,
  buttonHrefId: explicitButtonHrefId,
  calloutTextId: explicitCalloutTextId,
  quoteTextId: explicitQuoteTextId,
  listItemsId: explicitListItemsId,
  codeTextId: explicitCodeTextId,
  tableHeadId: explicitTableHeadId,
  tableRowsId: explicitTableRowsId,
  unsupportedHtmlId: explicitUnsupportedHtmlId,
}: BlockContentStudioProps) {
  const autoHeadingId = useId();
  const autoParagraphId = useId();
  const autoImageSrcId = useId();
  const autoImageAltId = useId();
  const autoImageCaptionId = useId();
  const autoButtonLabelId = useId();
  const autoButtonHrefId = useId();
  const autoCalloutTextId = useId();
  const autoQuoteTextId = useId();
  const autoListItemsId = useId();
  const autoCodeTextId = useId();
  const autoTableHeadId = useId();
  const autoTableRowsId = useId();
  const autoUnsupportedHtmlId = useId();

  const headingTextId = explicitHeadingTextId || autoHeadingId;
  const paragraphTextId = explicitParagraphTextId || autoParagraphId;
  const imageSrcId = explicitImageSrcId || autoImageSrcId;
  const imageAltId = explicitImageAltId || autoImageAltId;
  const imageCaptionId = explicitImageCaptionId || autoImageCaptionId;
  const buttonLabelId = explicitButtonLabelId || autoButtonLabelId;
  const buttonHrefId = explicitButtonHrefId || autoButtonHrefId;
  const calloutTextId = explicitCalloutTextId || autoCalloutTextId;
  const quoteTextId = explicitQuoteTextId || autoQuoteTextId;
  const listItemsId = explicitListItemsId || autoListItemsId;
  const codeTextId = explicitCodeTextId || autoCodeTextId;
  const tableHeadId = explicitTableHeadId || autoTableHeadId;
  const tableRowsId = explicitTableRowsId || autoTableRowsId;
  const unsupportedHtmlId = explicitUnsupportedHtmlId || autoUnsupportedHtmlId;

  return (
    <div className="space-y-4">
      {/* Element Type Morphing / Converter */}
      <BlockTypeConverter currentBlock={currentBlock} setCurrentBlock={setCurrentBlock} />

      {/* Element Content & Copy Sub-Studio */}
      <StudioSection title="Element Content & Copy" badge="Content">
        {currentBlock.type === 'heading' && (
          <HeadingBlockEditor
            currentBlock={currentBlock}
            setCurrentBlock={setCurrentBlock}
            headingTextId={headingTextId}
          />
        )}

        {currentBlock.type === 'paragraph' && (
          <ParagraphBlockEditor
            currentBlock={currentBlock}
            setCurrentBlock={setCurrentBlock}
            paragraphTextId={paragraphTextId}
          />
        )}

        {currentBlock.type === 'image' && (
          <ImageBlockEditor
            currentBlock={currentBlock}
            setCurrentBlock={setCurrentBlock}
            imageSrcId={imageSrcId}
            imageAltId={imageAltId}
            imageCaptionId={imageCaptionId}
          />
        )}

        {currentBlock.type === 'button' && (
          <ButtonBlockEditor
            currentBlock={currentBlock}
            setCurrentBlock={setCurrentBlock}
            buttonLabelId={buttonLabelId}
            buttonHrefId={buttonHrefId}
          />
        )}

        {currentBlock.type === 'callout' && (
          <CalloutBlockEditor
            currentBlock={currentBlock}
            setCurrentBlock={setCurrentBlock}
            calloutTextId={calloutTextId}
          />
        )}

        {currentBlock.type === 'quote' && (
          <QuoteBlockEditor
            currentBlock={currentBlock}
            setCurrentBlock={setCurrentBlock}
            quoteTextId={quoteTextId}
          />
        )}

        {(currentBlock.type === 'bulletList' || currentBlock.type === 'orderedList') && (
          <ListBlockEditor
            currentBlock={currentBlock}
            setCurrentBlock={setCurrentBlock}
            listItemsId={listItemsId}
          />
        )}

        {currentBlock.type === 'code' && (
          <CodeBlockEditor
            currentBlock={currentBlock}
            setCurrentBlock={setCurrentBlock}
            codeTextId={codeTextId}
          />
        )}

        {currentBlock.type === 'table' && (
          <TableBlockEditor
            currentBlock={currentBlock}
            setCurrentBlock={setCurrentBlock}
            tableHeadId={tableHeadId}
            tableRowsId={tableRowsId}
          />
        )}

        {currentBlock.type === 'divider' && <DividerBlockEditor />}

        {currentBlock.type === 'unsupported' && (
          <UnsupportedBlockEditor
            currentBlock={currentBlock}
            setCurrentBlock={setCurrentBlock}
            unsupportedHtmlId={unsupportedHtmlId}
          />
        )}
      </StudioSection>
    </div>
  );
}
