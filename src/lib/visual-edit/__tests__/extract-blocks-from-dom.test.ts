// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Block } from '@/lib/blocks';
import { extractBlocksFromDOM } from '@/lib/visual-edit/extract-blocks-from-dom';

function makeRoot(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('extractBlocksFromDOM', () => {
  it('extracts headings with level and text', () => {
    const root = makeRoot('<h2>Mission</h2><h3>Subheading</h3>');
    const blocks = extractBlocksFromDOM(root);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('heading');
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 2, html: 'Mission' });
    expect(blocks[1]).toMatchObject({ type: 'heading', level: 3, html: 'Subheading' });
  });

  it('clamps heading level to 2–4', () => {
    const root = makeRoot('<h1>Title</h1><h5>Deep</h5>');
    const blocks = extractBlocksFromDOM(root);
    expect(blocks[0]).toMatchObject({ level: 2 });
    expect(blocks[1]).toMatchObject({ level: 2 });
  });

  it('extracts images with src, alt, and dimensions', () => {
    const root = makeRoot('<img src="https://example.com/photo.jpg" alt="Banner" />');
    const blocks = extractBlocksFromDOM(root);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: 'image',
      src: 'https://example.com/photo.jpg',
      alt: 'Banner',
      caption: '',
    });
  });

  it('extracts bullet lists', () => {
    const root = makeRoot('<ul><li>First</li><li>Second</li></ul>');
    const blocks = extractBlocksFromDOM(root);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'bulletList', items: ['First', 'Second'] });
  });

  it('extracts ordered lists as orderedList type', () => {
    const root = makeRoot('<ol><li>Step 1</li><li>Step 2</li></ol>');
    const blocks = extractBlocksFromDOM(root);
    expect(blocks[0]).toMatchObject({ type: 'orderedList', items: ['Step 1', 'Step 2'] });
  });

  it('extracts tables with header and rows', () => {
    const root = makeRoot(`
      <table>
        <thead><tr><th>Name</th><th>Role</th></tr></thead>
        <tbody>
          <tr><td>Alice</td><td>Lead</td></tr>
          <tr><td>Bob</td><td>Volunteer</td></tr>
        </tbody>
      </table>
    `);
    const blocks = extractBlocksFromDOM(root);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('table');
    if (blocks[0].type === 'table') {
      expect(blocks[0].head).toEqual(['Name', 'Role']);
      expect(blocks[0].rows).toEqual([
        ['Alice', 'Lead'],
        ['Bob', 'Volunteer'],
      ]);
    }
  });

  it('extracts blockquotes', () => {
    const root = makeRoot('<blockquote><p>Power to the people.</p></blockquote>');
    const blocks = extractBlocksFromDOM(root);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('quote');
    if (blocks[0].type === 'quote') {
      expect(blocks[0].html).toContain('Power to the people');
    }
  });

  it('extracts buttons / CTAs', () => {
    const root = makeRoot('<a class="btn" href="/donate">Donate Now</a>');
    const blocks = extractBlocksFromDOM(root);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'button', label: 'Donate Now', href: '/donate' });
  });

  it('extracts paragraphs from <p> elements', () => {
    const root = makeRoot('<p>Hello world</p>');
    const blocks = extractBlocksFromDOM(root);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'paragraph', html: 'Hello world' });
  });

  it('falls back to paragraph for generic children with text', () => {
    const root = makeRoot('<div>Some text content</div>');
    const blocks = extractBlocksFromDOM(root);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
  });

  it('returns a single paragraph for an empty root', () => {
    const root = makeRoot('');
    const blocks = extractBlocksFromDOM(root);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'paragraph', html: 'Section content' });
  });

  it('preserves order: heading, paragraph, list', () => {
    const root = makeRoot('<h2>Title</h2><p>Body</p><ul><li>Item</li></ul>');
    const blocks = extractBlocksFromDOM(root);
    expect(blocks.map((b: Block) => b.type)).toEqual(['heading', 'paragraph', 'bulletList']);
  });
});
