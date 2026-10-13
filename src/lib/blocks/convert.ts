import { stripTags } from './serialize';
import type { Block, CalloutTone, ContentBlockType, HeadingLevel } from './types';

/**
 * Extract human-readable text or inner HTML from any block for preservation across conversions.
 */
export function extractBlockContentText(block: Block): string {
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
  block: Block,
  targetType: ContentBlockType,
  options?: {
    headingLevel?: HeadingLevel;
    calloutTone?: CalloutTone;
  }
): Block {
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

  switch (targetType) {
    case 'paragraph':
      return { id: block.id, type: 'paragraph', html: fallbackHtml };

    case 'heading':
      return {
        id: block.id,
        type: 'heading',
        level: targetLevel,
        html: fallbackHtml,
      };

    case 'callout':
      return {
        id: block.id,
        type: 'callout',
        tone: targetTone,
        html: fallbackHtml,
      };

    case 'quote':
      return { id: block.id, type: 'quote', html: fallbackHtml };

    case 'code':
      return { id: block.id, type: 'code', text: plain || '// code' };

    case 'bulletList': {
      const splitItems = raw
        .split(/\n|<br\s*\/?>/i)
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        id: block.id,
        type: 'bulletList',
        items: splitItems.length > 0 ? splitItems : ['Item 1', 'Item 2'],
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
      };
    }

    case 'button':
      return {
        id: block.id,
        type: 'button',
        label: plain.slice(0, 40) || 'Action',
        href: '/',
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
      };

    case 'divider':
      return { id: block.id, type: 'divider' };

    case 'unsupported':
      return { id: block.id, type: 'unsupported', html: fallbackHtml };
  }
}
