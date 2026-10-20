// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '@/components/admin/content/BlockEditor';
import { type Block, parseHtml, resetBlockIds, serializeBlocks, stripTags } from '@/lib/blocks';

// The editor deliberately does not render block content through React: the DOM
// is the source of truth while typing and the model is read back on `input`.
// That architecture is the whole reason a keystroke does not lose the caret,
// and it is exactly the thing a type-check cannot verify — so it is exercised
// here against a real DOM rather than assumed.
describe('BlockEditor DOM/model bridge', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // The editor coalesces rapid keystrokes into one model update, so timers are
    // controlled here rather than waited on in real time.
    vi.useFakeTimers();
    resetBlockIds();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  /** Let the input debounce flush, then return the latest model the editor emitted. */
  const flush = (spy: ReturnType<typeof vi.fn>): Block[] => {
    act(() => {
      vi.advanceTimersByTime(200);
    });
    return spy.mock.calls.at(-1)?.[0] as Block[];
  };

  const render = (initial: Block[], onChange: (b: Block[]) => void) =>
    act(() => {
      root.render(<BlockEditor blocks={initial} onChange={onChange} />);
    });

  const editable = (index = 0) =>
    container.querySelectorAll<HTMLElement>('[contenteditable="true"]')[index];

  const typeInto = (el: HTMLElement, html: string) =>
    act(() => {
      el.innerHTML = html;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

  it('renders one editable element per block', () => {
    render(parseHtml('<p>One</p><p>Two</p><hr class="cw-divider" />'), vi.fn());
    // Two paragraphs; the divider renders an <hr>, not a textbox.
    expect(container.querySelectorAll('[contenteditable="true"]')).toHaveLength(2);
  });

  it('reads typed HTML back into the model', () => {
    const onChange = vi.fn();
    render(parseHtml('<p></p>'), onChange);
    typeInto(editable(), 'Join us <strong>Saturday</strong>');
    expect(flush(onChange)[0]).toMatchObject({
      type: 'paragraph',
      html: 'Join us <strong>Saturday</strong>',
    });
  });

  it('does not push an unchanged value upstream', () => {
    // A model round trip happens on every keystroke. If it re-emitted the same
    // HTML, every character typed would create a revision in the database.
    const onChange = vi.fn();
    const blocks = parseHtml('<p>Already here</p>');
    render(blocks, onChange);
    typeInto(editable(), 'Already here');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves the DOM untouched when the model echoes back the same HTML', () => {
    const blocks = parseHtml('<p>Stable</p>');
    render(blocks, vi.fn());
    const el = editable();
    el.innerHTML = 'Stable';
    act(() => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // The re-render must not replace innerHTML on the element being typed into.
    expect(editable().innerHTML).toBe('Stable');
  });

  it('adds a paragraph when Enter is pressed', () => {
    const onChange = vi.fn();
    render(parseHtml('<p>First</p>'), onChange);
    act(() => {
      editable().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });
    const last = onChange.mock.calls.at(-1)?.[0] as Block[];
    expect(last).toHaveLength(2);
    expect(last[1]).toMatchObject({ type: 'paragraph', html: '' });
  });

  it('deletes an empty paragraph on Backspace', () => {
    const onChange = vi.fn();
    render(parseHtml('<p>Keep</p><p></p>'), onChange);
    act(() => {
      editable(1).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })
      );
    });
    const last = onChange.mock.calls.at(-1)?.[0] as Block[];
    expect(last).toHaveLength(1);
  });

  it('never deletes the last remaining block', () => {
    const onChange = vi.fn();
    render(parseHtml('<p></p>'), onChange);
    act(() => {
      editable().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })
      );
    });
    const last = onChange.mock.calls.at(-1)?.[0] as Block[];
    expect(last).toHaveLength(1);
    expect(last[0].type).toBe('paragraph');
  });

  it('offers every block in the type menu, not just the current one', () => {
    render(parseHtml('<p>x</p>'), vi.fn());
    // The menu is collapsed, so only the current block's label is present.
    const toggle = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.trim().startsWith('Text')
    ) as HTMLButtonElement;
    expect(toggle).toBeDefined();
    act(() => {
      toggle.click();
    });
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent?.trim());
    // The slash menu is keyboard-only in practice, so the type menu has to carry
    // every block kind or half the vocabulary is undiscoverable.
    for (const expected of [
      'Text',
      'Heading',
      'Bulleted list',
      'Numbered list',
      'Quote',
      'Callout',
      'Call to action',
      'Image',
      'Table',
      'Code',
      'Divider',
    ]) {
      expect(labels.some((l) => l?.startsWith(expected))).toBe(true);
    }
  });

  it('converts a block through the type menu, keeping the author’s text', () => {
    const onChange = vi.fn();
    render(parseHtml('<p>Become a quote</p>'), onChange);
    const typeButton = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.trim().startsWith('Text')
    );
    act(() => {
      typeButton?.click();
    });
    const quoteButton = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.trim().startsWith('Quote')
    );
    act(() => {
      quoteButton?.click();
    });
    expect(flush(onChange)[0]).toMatchObject({ type: 'quote', html: 'Become a quote' });
  });

  it('exposes reorder, duplicate and delete for each block', () => {
    render(parseHtml('<p>Only</p>'), vi.fn());
    const names = [...container.querySelectorAll('button')].map(
      (b) => b.getAttribute('aria-label') ?? ''
    );
    expect(names).toContain('Move block up');
    expect(names).toContain('Move block down');
    expect(names).toContain('Duplicate block');
    expect(names).toContain('Delete block');
  });

  it('disables moving the first block up and the last block down', () => {
    render(parseHtml('<p>One</p><p>Two</p>'), vi.fn());
    const up = [...container.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Move block up'
    ) as HTMLButtonElement;
    const down = [...container.querySelectorAll('button')].filter(
      (b) => b.getAttribute('aria-label') === 'Move block down'
    ) as HTMLButtonElement[];
    expect(up.disabled).toBe(true);
    expect(down[0].disabled).toBe(false);
    expect(down[1].disabled).toBe(true);
  });

  it('gives a duplicated block a fresh id so the two do not share a DOM node', () => {
    const onChange = vi.fn();
    render(parseHtml('<p>Original</p>'), onChange);
    const dup = [...container.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Duplicate block'
    );
    act(() => {
      dup?.click();
    });
    const last = onChange.mock.calls.at(-1)?.[0] as Block[];
    expect(last).toHaveLength(2);
    expect(last[0].id).not.toBe(last[1].id);
  });

  it('adds a list item on Enter inside a list', () => {
    const onChange = vi.fn();
    render(parseHtml('<ul class="cw-list cw-list--bullet"><li>One</li></ul>'), onChange);
    // Scope to the block's own list: each block wrapper is itself an <li>, so a
    // bare `li` selector would match the wrapper rather than the list item.
    const li = container.querySelector('.cw-list li') as HTMLElement;
    expect(li).not.toBeNull();
    act(() => {
      li.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });
    const last = onChange.mock.calls.at(-1)?.[0] as Block[];
    expect(last[0]).toMatchObject({ type: 'bulletList', items: ['One', ''] });
  });

  it('renders an unsupported block read-only with its original markup', () => {
    render(parseHtml('<dl><dt>Term</dt><dd>Definition</dd></dl>'), vi.fn());
    expect(container.textContent).toContain('Unsupported markup');
    expect(container.querySelector('[contenteditable="true"]')).toBeNull();
    expect(container.querySelector('pre')?.textContent).toContain('<dt>Term</dt>');
  });

  it('keeps the whole document serializable after every edit', () => {
    const onChange = vi.fn();
    const initial = parseHtml('<p>Alpha</p><p>Beta</p>');
    render(initial, onChange);
    typeInto(editable(1), 'Beta <em>italic</em>');
    const html = serializeBlocks(flush(onChange));
    expect(html).toContain('Beta <em>italic</em>');
    expect(stripTags(html)).toContain('Alpha');
  });
});
