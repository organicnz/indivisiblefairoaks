/**
 * Extract structured blocks from a live rendered DOM element.
 *
 * Pure DOM → data: no React, no hooks, no state. Lives in `src/lib/` with the
 * other block-model utilities because it is the bridge between a rendered page
 * and the `Block[]` model the editor persists to Supabase.
 *
 * The order of checks matters: table before lists (a table can contain `<ul>`),
 * and the paragraph fallback is last so every child produces a block.
 */

import { type Block, type HeadingLevel, nextBlockId } from '@/lib/blocks';

export function extractBlocksFromDOM(root: HTMLElement): Block[] {
  const extracted: Block[] = [];
  const children = Array.from(root.children);

  children.forEach((child, idx) => {
    if (!(child instanceof HTMLElement)) return;
    const blockId = nextBlockId();

    // Check heading
    const heading = child.matches('h1, h2, h3, h4, h5, h6')
      ? child
      : child.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      const levelNum = Number.parseInt(heading.tagName.replace('H', ''), 10) || 2;
      const level = (levelNum >= 2 && levelNum <= 4 ? levelNum : 2) as HeadingLevel;
      extracted.push({
        id: blockId,
        type: 'heading',
        level,
        html: heading.innerHTML.trim() || heading.textContent?.trim() || `Section ${idx + 1}`,
      });
      return;
    }

    // Check image
    const img = child.matches('img') ? (child as HTMLImageElement) : child.querySelector('img');
    if (img?.src) {
      extracted.push({
        id: blockId,
        type: 'image',
        src: img.src,
        alt: img.alt || '',
        caption: '',
        width: img.naturalWidth || null,
        height: img.naturalHeight || null,
      });
      return;
    }

    // Check table (checked before lists — a table can contain <ul>/<li>)
    const table = child.matches('table')
      ? (child as HTMLTableElement)
      : child.querySelector('table');
    if (table) {
      const head = Array.from(table.querySelectorAll('thead th')).map(
        (th) => th.textContent?.trim() || ''
      );
      const rows = Array.from(table.querySelectorAll('tbody tr')).map((row) =>
        Array.from(row.querySelectorAll('td')).map((td) => td.textContent?.trim() || '')
      );
      extracted.push({
        id: blockId,
        type: 'table',
        head: head.length > 0 ? head : rows[0]?.length ? (rows.shift() ?? []) : ['Column'],
        rows: rows.length > 0 ? rows : [['Cell']],
      });
      return;
    }

    // Check lists
    const ul = child.matches('ul, ol') ? child : child.querySelector('ul, ol');
    if (ul) {
      const isOrdered = ul.tagName === 'OL';
      const items = Array.from(ul.querySelectorAll('li')).map((li) => li.textContent?.trim() || '');
      extracted.push({
        id: blockId,
        type: isOrdered ? 'orderedList' : 'bulletList',
        items: items.length > 0 ? items : ['List item'],
      });
      return;
    }

    // Check quotes
    const quote = child.matches('blockquote') ? child : child.querySelector('blockquote');
    if (quote) {
      extracted.push({
        id: blockId,
        type: 'quote',
        html: quote.innerHTML.trim() || quote.textContent?.trim() || '',
      });
      return;
    }

    // Check button / CTA
    const btn = child.matches('a, button') ? child : child.querySelector('a, button');
    if (
      btn &&
      btn instanceof HTMLElement &&
      (btn.classList.contains('btn') ||
        btn.getAttribute('role') === 'button' ||
        btn.tagName === 'BUTTON')
    ) {
      const href = btn.getAttribute('href') || '/';
      extracted.push({
        id: blockId,
        type: 'button',
        label: btn.textContent?.trim() || 'Take Action',
        href,
      });
      return;
    }

    // Paragraph or generic text
    const p = child.matches('p') ? child : child.querySelector('p');
    const htmlContent = p ? p.innerHTML.trim() : child.innerHTML.trim();
    if (htmlContent) {
      extracted.push({
        id: blockId,
        type: 'paragraph',
        html: htmlContent,
      });
    } else {
      extracted.push({
        id: blockId,
        type: 'paragraph',
        html: child.textContent?.trim() || `Section ${idx + 1} content`,
      });
    }
  });

  return extracted.length > 0
    ? extracted
    : [{ id: nextBlockId(), type: 'paragraph', html: 'Section content' }];
}
