import { describe, expect, it } from 'vitest';
import { type Block, convertBlock, extractBlockContentText } from '@/lib/blocks';

describe('blocks convert', () => {
  it('extracts content text from various block types', () => {
    expect(
      extractBlockContentText({ id: '1', type: 'paragraph', html: 'Hello <strong>World</strong>' })
    ).toBe('Hello <strong>World</strong>');
    expect(
      extractBlockContentText({ id: '2', type: 'heading', level: 2, html: 'Main Heading' })
    ).toBe('Main Heading');
    expect(extractBlockContentText({ id: '3', type: 'bulletList', items: ['One', 'Two'] })).toBe(
      'One\nTwo'
    );
    expect(
      extractBlockContentText({ id: '4', type: 'callout', tone: 'action', html: 'Action note' })
    ).toBe('Action note');
    expect(extractBlockContentText({ id: '5', type: 'code', text: 'const x = 1;' })).toBe(
      'const x = 1;'
    );
    expect(
      extractBlockContentText({ id: '6', type: 'button', label: 'Donate', href: '/donate' })
    ).toBe('Donate');
    expect(
      extractBlockContentText({
        id: '7',
        type: 'image',
        src: '/img.png',
        alt: 'Flag',
        caption: 'State flag',
        width: null,
        height: null,
      })
    ).toBe('State flag');
    expect(
      extractBlockContentText({ id: '8', type: 'table', head: ['H1', 'H2'], rows: [['R1', 'R2']] })
    ).toBe('H1 | H2\nR1 | R2');
    expect(extractBlockContentText({ id: '9', type: 'divider' })).toBe('');
  });

  it('converts paragraph to heading, preserving html', () => {
    const p: Block = { id: 'p1', type: 'paragraph', html: 'Important Title' };
    const h = convertBlock(p, 'heading', { headingLevel: 3 });
    expect(h).toEqual({
      id: 'p1',
      type: 'heading',
      level: 3,
      html: 'Important Title',
    });
  });

  it('converts heading to callout, preserving html and setting tone', () => {
    const h: Block = { id: 'h1', type: 'heading', level: 2, html: 'Notice to members' };
    const c = convertBlock(h, 'callout', { calloutTone: 'warning' });
    expect(c).toEqual({
      id: 'h1',
      type: 'callout',
      tone: 'warning',
      html: 'Notice to members',
    });
  });

  it('converts callout to quote', () => {
    const c: Block = { id: 'c1', type: 'callout', tone: 'info', html: 'Wisdom of the crowd' };
    const q = convertBlock(c, 'quote');
    expect(q).toEqual({
      id: 'c1',
      type: 'quote',
      html: 'Wisdom of the crowd',
    });
  });

  it('converts multiline text to bulletList and orderedList', () => {
    const p: Block = { id: 'p2', type: 'paragraph', html: 'Item Alpha<br>Item Beta\nItem Gamma' };
    const list = convertBlock(p, 'bulletList');
    expect(list.type).toBe('bulletList');
    if (list.type === 'bulletList') {
      expect(list.items).toEqual(['Item Alpha', 'Item Beta', 'Item Gamma']);
    }

    const oList = convertBlock(p, 'orderedList');
    expect(oList.type).toBe('orderedList');
    if (oList.type === 'orderedList') {
      expect(oList.items).toEqual(['Item Alpha', 'Item Beta', 'Item Gamma']);
    }
  });

  it('converts bulletList to paragraph', () => {
    const list: Block = { id: 'l1', type: 'bulletList', items: ['First point', 'Second point'] };
    const p = convertBlock(list, 'paragraph');
    expect(p).toEqual({
      id: 'l1',
      type: 'paragraph',
      html: 'First point\nSecond point',
    });
  });

  it('converts to button with truncated plain label', () => {
    const p: Block = {
      id: 'b1',
      type: 'paragraph',
      html: '<strong>Support our campaign today</strong>',
    };
    const btn = convertBlock(p, 'button');
    expect(btn.type).toBe('button');
    if (btn.type === 'button') {
      expect(btn.label).toBe('Support our campaign today');
      expect(btn.href).toBe('/');
    }
  });

  it('returns same block if target type and options match', () => {
    const h: Block = { id: 'h2', type: 'heading', level: 2, html: 'Header' };
    expect(convertBlock(h, 'heading', { headingLevel: 2 })).toBe(h);

    const c: Block = { id: 'c2', type: 'callout', tone: 'action', html: 'Note' };
    expect(convertBlock(c, 'callout', { calloutTone: 'action' })).toBe(c);
  });

  it('handles empty text with sensible fallbacks', () => {
    const div: Block = { id: 'd1', type: 'divider' };
    const p = convertBlock(div, 'paragraph');
    expect(p).toEqual({ id: 'd1', type: 'paragraph', html: 'Content' });

    const btn = convertBlock(div, 'button');
    expect(btn).toEqual({ id: 'd1', type: 'button', label: 'Action', href: '/' });

    const list = convertBlock(div, 'bulletList');
    expect(list).toEqual({ id: 'd1', type: 'bulletList', items: ['Item 1', 'Item 2'] });
  });
});
