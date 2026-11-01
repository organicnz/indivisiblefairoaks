import { stripTags } from './serialize';
import type { CalloutTone, ContentBlock, HeadingLevel, LeafBlockType } from './types';

/**
 * Extract human-readable text or inner HTML from any block for preservation across conversions.
 */
export function extractBlockContentText(block: ContentBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
    case 'quote':
    case 'callout':
    case 'unsupported':
      return block.html;
    case 'code':
      return block.text;
    case 'bulletList':
    case 'orderedList':
      return block.items.join('\n');
    case 'button':
      return block.label;
    case 'image':
      return block.caption || block.alt || '';
    case 'table':
      return [block.head.join(' | '), ...block.rows.map((r) => r.join(' | '))].join('\n');
    case 'divider':
      return '';
  }
}

/**
 * Intelligent conversion between block types while preserving author content.
 *
 * For example:
 * - Converting Paragraph -> Heading preserves the authored copy.
 * - Converting Heading -> Callout wraps or keeps the copy with tone.
 * - Converting BulletList -> Paragraph joins list items.
 * - Converting Paragraph -> BulletList splits paragraphs/lines into list items.
 */
export function convertBlock(
  block: ContentBlock,
  targetType: LeafBlockType,
  options?: {
    headingLevel?: HeadingLevel;
    calloutTone?: CalloutTone;
  }
): ContentBlock {
  const currentLevel = block.type === 'heading' ? block.level : undefined;
  const currentTone = block.type === 'callout' ? block.tone : undefined;

  const targetLevel = options?.headingLevel ?? currentLevel ?? 2;
  const targetTone = options?.calloutTone ?? currentTone ?? 'info';

  if (
    block.type === targetType &&
    (targetType !== 'heading' || currentLevel === targetLevel) &&
    (targetType !== 'callout' || currentTone === targetTone)
  ) {
    return block;
  }

  const raw = extractBlockContentText(block);
  const plain = stripTags(raw).trim();
  const fallbackHtml = raw.trim() || 'Content';
  /*
   * The design survives a conversion. It lives in the shell rather than the
   * markup now, so a conversion that rebuilt only the content would silently
   * strip a block's look — and the parser would read the new type as unstyled.
   * Structural classes change with the type; the serializer re-emits them.
   */
  const carried = block.shell ? { shell: block.shell } : {};

  switch (targetType) {
    case 'paragraph':
      return { id: block.id, type: 'paragraph', html: fallbackHtml, ...carried };

    case 'heading':
      return {
        id: block.id,
        type: 'heading',
        level: targetLevel,
        html: fallbackHtml,
        ...carried,
      };

    case 'callout':
      return {
        id: block.id,
        type: 'callout',
        tone: targetTone,
        html: fallbackHtml,
        ...carried,
      };

    case 'quote':
      return { id: block.id, type: 'quote', html: fallbackHtml, ...carried };

    case 'code':
      return { id: block.id, type: 'code', text: plain || '// code', ...carried };

    case 'bulletList': {
      const splitItems = raw
        .split(/\n|<br\s*\/?>/i)
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        id: block.id,
        type: 'bulletList',
        items: splitItems.length > 0 ? splitItems : ['Item 1', 'Item 2'],
        ...carried,
      };
    }

    case 'orderedList': {
      const splitItems = raw
        .split(/\n|<br\s*\/?>/i)
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        id: block.id,
        type: 'orderedList',
        items: splitItems.length > 0 ? splitItems : ['Step 1', 'Step 2'],
        ...carried,
      };
    }

    case 'button':
      return {
        id: block.id,
        type: 'button',
        label: plain.slice(0, 40) || 'Action',
        href: '/',
        ...carried,
      };

    case 'image':
      return {
        id: block.id,
        type: 'image',
        src: '',
        alt: plain.slice(0, 60),
        caption: plain.slice(0, 100),
        width: null,
        height: null,
        ...carried,
      };

    case 'table':
      return {
        id: block.id,
        type: 'table',
        head: ['Column A', 'Column B'],
        rows: [
          [plain.slice(0, 30) || 'Row 1', 'Data'],
          ['Row 2', 'Data'],
        ],
        ...carried,
      };

    case 'divider':
      return { id: block.id, type: 'divider', ...carried };

    case 'unsupported':
      return { id: block.id, type: 'unsupported', html: fallbackHtml, ...carried };
  }
}
