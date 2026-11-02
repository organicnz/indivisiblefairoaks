// @vitest-environment jsdom
'use client';

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HeadingBlockEditor,
  ListBlockEditor,
  ParagraphBlockEditor,
  QuoteBlockEditor,
} from '@/components/visual-edit/composer/BlockContentStudio';
import { type Block, serializeBlocks } from '@/lib/blocks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The editor is a DOM surface, so these tests drive it the way a browser does:
 * select a range, then either mousedown the pill (which cancels the focus
 * change) or dispatch the shortcut the editor listens for. The final value is
 * asserted through the block serializer, not just the DOM, because the save is
 * what the block model actually promises.
 */
describe('visual rich-text content editors', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    window.getSelection()?.removeAllRanges();
    container.remove();
    document.body.innerHTML = '';
  });

  const serialized = () => container.querySelector('[data-testid="serialized"]')?.textContent ?? '';

  it.each([
    {
      label: 'paragraph',
      initial: { id: 'p', type: 'paragraph', html: 'Civic action' } as Block,
      wrapper: '<p>',
    },
    {
      label: 'heading',
      initial: { id: 'h', type: 'heading', level: 2, html: 'Civic action' } as Block,
      wrapper: '<h2 class="cw cw--h2">',
    },
    {
      label: 'quote',
      initial: { id: 'q', type: 'quote', html: 'Civic action' } as Block,
      wrapper: '<blockquote class="cw-quote"><p>',
    },
  ])('formats a $label through the toolbar and serializes valid block HTML', async (testCase) => {
    await act(async () => {
      root.render(<BlockHarness initial={testCase.initial} />);
    });

    const editor = contentEditor();
    expect(editor.textContent).toBe('Civic action');

    await act(async () => {
      editor.innerHTML = 'Typed copy';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(serialized()).toContain('Typed copy');

    selectContents(contentEditor());
    await act(async () => {
      mousedown(container.querySelector('button[aria-label="Bold"]'));
    });

    expect(serialized()).toContain(`${testCase.wrapper}<strong>Typed copy</strong>`);
    expect(contentEditor().innerHTML).toBe('<strong>Typed copy</strong>');
  });

  it('activates a format control from the keyboard without losing the selection', async () => {
    await act(async () => {
      root.render(<BlockHarness initial={{ id: 'p', type: 'paragraph', html: 'Civic action' }} />);
    });

    selectContents(contentEditor());
    const bold = container.querySelector<HTMLButtonElement>('button[aria-label="Bold"]');
    bold?.focus();
    await act(async () => {
      bold?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });

    expect(serialized()).toContain('<p><strong>Civic action</strong></p>');
  });

  it('applies bold and italic from the keyboard and keeps the caret in the editor', async () => {
    await act(async () => {
      root.render(<BlockHarness initial={{ id: 'p', type: 'paragraph', html: 'Civic action' }} />);
    });

    const editor = contentEditor();
    selectContents(editor);
    await act(async () => {
      editor.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'b',
          metaKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(serialized()).toContain('<p><strong>Civic action</strong></p>');

    selectContents(editor);
    await act(async () => {
      editor.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'i',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(contentEditor().innerHTML).toContain('<em>');
    expect(contentEditor().innerHTML).toContain('<strong>');
    expect(document.activeElement).toBe(contentEditor());
  });

  it.each([
    { label: 'Bold', tag: 'strong' },
    { label: 'Italic', tag: 'em' },
    { label: 'Underline', tag: 'u' },
    { label: 'Strikethrough', tag: 's' },
    { label: 'Inline Code', tag: 'code' },
  ])('shows $label as pressed and toggles it off', async ({ label, tag }) => {
    await act(async () => {
      root.render(
        <BlockHarness
          initial={{
            id: `format-${tag}`,
            type: 'paragraph',
            html: `<${tag}>Mission</${tag}>`,
          }}
        />
      );
    });

    await act(async () => {
      selectContents(contentEditor());
      document.dispatchEvent(new Event('selectionchange'));
    });

    const control = () =>
      container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    expect(control()?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      mousedown(control());
    });

    expect(contentEditor().textContent).toBe('Mission');
    expect(contentEditor().querySelector(tag)).toBeNull();
    expect(serialized()).toBe('<p>Mission</p>');
    expect(control()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('turns an active format off from a caret instead of nesting a second tag', async () => {
    await act(async () => {
      root.render(
        <BlockHarness
          initial={{ id: 'caret-bold', type: 'paragraph', html: '<strong>Mission</strong>' }}
        />
      );
    });

    await act(async () => {
      placeCaretAtText(contentEditor(), 'Mission', 4);
      document.dispatchEvent(new Event('selectionchange'));
    });

    const bold = () => container.querySelector<HTMLButtonElement>('button[aria-label="Bold"]');
    expect(bold()?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      mousedown(bold());
    });

    // No empty <strong> left behind, and the run is genuinely unformatted.
    expect(contentEditor().innerHTML).toBe('Mission');
    expect(contentEditor().querySelector('strong')).toBeNull();
    expect(serialized()).toBe('<p>Mission</p>');
  });

  it('keeps the strip in sync as the caret moves and typing changes the run', async () => {
    await act(async () => {
      root.render(
        <BlockHarness
          initial={{ id: 'caret-sync', type: 'paragraph', html: '<strong>Mission</strong> plain' }}
        />
      );
    });

    const bold = () => container.querySelector<HTMLButtonElement>('button[aria-label="Bold"]');

    // A mixed selection does not carry bold as a whole.
    await act(async () => {
      selectContents(contentEditor());
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(bold()?.getAttribute('aria-pressed')).toBe('false');

    // The caret inside the bold run says it is active.
    await act(async () => {
      placeCaretAtText(contentEditor(), 'Mission', 2);
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(bold()?.getAttribute('aria-pressed')).toBe('true');

    // Typing in the plain tail moves the state back off.
    await act(async () => {
      placeCaretAtText(contentEditor(), 'plain', 1);
      contentEditor().dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(bold()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('marks a linked selection and removes the anchor without losing its text', async () => {
    await act(async () => {
      root.render(
        <BlockHarness
          initial={{
            id: 'link-active',
            type: 'paragraph',
            html: '<strong>Before</strong> <a href="/events">Events</a> after',
          }}
        />
      );
    });

    await act(async () => {
      selectText(contentEditor(), 'Events');
      document.dispatchEvent(new Event('selectionchange'));
    });

    const editLink = container.querySelector<HTMLButtonElement>('button[aria-label="Edit link"]');
    expect(editLink?.getAttribute('aria-pressed')).toBe('true');
    const unlink = container.querySelector<HTMLButtonElement>('button[aria-label="Remove link"]');
    expect(unlink).not.toBeNull();

    await act(async () => {
      mousedown(unlink);
    });

    // The anchor is gone; its text and the surrounding formatting survive.
    expect(serialized()).toContain('<strong>Before</strong>');
    expect(serialized()).toContain('Events');
    expect(serialized()).toContain('after');
    expect(serialized()).not.toContain('<a');
    expect(container.querySelector('button[aria-label="Remove link"]')).toBeNull();
    expect(
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Insert link"]')
        ?.getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('captures the selection before the link dialog takes focus and inserts the link', async () => {
    await act(async () => {
      root.render(<BlockHarness initial={{ id: 'p', type: 'paragraph', html: 'Civic action' }} />);
    });

    const editor = contentEditor();
    selectContents(editor);
    await act(async () => {
      mousedown(container.querySelector('button[aria-label="Insert link"]'));
    });

    const dialog = container.querySelector<HTMLFormElement>('form[role="dialog"]');
    expect(dialog).not.toBeNull();
    const input = dialog?.querySelector<HTMLInputElement>('input');
    expect(input).not.toBeNull();
    if (!dialog || !input) return;

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, 'https://example.org/next');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      dialog.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(serialized()).toContain('<p><a href="https://example.org/next">Civic action</a></p>');
    expect(container.querySelector('form[role="dialog"]')).toBeNull();
  });

  it('rejects a javascript: link without writing it into the block', async () => {
    await act(async () => {
      root.render(<BlockHarness initial={{ id: 'p', type: 'paragraph', html: 'Civic action' }} />);
    });

    selectContents(contentEditor());
    await act(async () => {
      mousedown(container.querySelector('button[aria-label="Insert link"]'));
    });

    const dialog = container.querySelector<HTMLFormElement>('form[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('input');
    if (!dialog || !input) throw new Error('expected the link dialog');

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, 'javascript:alert(1)');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      dialog.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('Use an http(s), mailto:, tel:, or relative link.');
    expect(serialized()).not.toContain('javascript:');
    expect(container.querySelector('form[role="dialog"]')).not.toBeNull();
  });

  it('switches to raw HTML, edits the same value and comes back to the visual surface', async () => {
    await act(async () => {
      root.render(<BlockHarness initial={{ id: 'p', type: 'paragraph', html: 'Civic action' }} />);
    });

    await act(async () => {
      (container.querySelector('button[aria-label="Edit raw HTML"]') as HTMLButtonElement).click();
    });

    const raw = container.querySelector('textarea');
    expect(raw?.value).toBe('Civic action');
    if (!raw) return;

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setValue?.call(raw, '<em>Raw edit</em>');
      raw.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(serialized()).toContain('<p><em>Raw edit</em></p>');

    await act(async () => {
      (container.querySelector('button[aria-label="Edit visually"]') as HTMLButtonElement).click();
    });
    expect(contentEditor().innerHTML).toBe('<em>Raw edit</em>');
  });

  it('follows an external draft restoration, which is the undo path', async () => {
    await act(async () => {
      root.render(<BlockHarness initial={{ id: 'p', type: 'paragraph', html: 'Civic action' }} />);
    });

    const editor = contentEditor();
    await act(async () => {
      editor.innerHTML = '<strong>Changed copy</strong>';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(serialized()).toContain('<strong>Changed copy</strong>');

    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find(
          (button) => button.textContent === 'Restore initial draft'
        ) as HTMLButtonElement
      ).click();
    });

    // The block is the single value: restoring it puts the DOM back too.
    expect(serialized()).toContain('<p>Civic action</p>');
    expect(contentEditor().innerHTML).toBe('Civic action');
  });

  it('edits, formats, links and grows a visual list without changing the wrong item', async () => {
    await act(async () => {
      root.render(
        <ListHarness initial={{ id: 'l', type: 'bulletList', items: ['Vote', 'Organize'] }} />
      );
    });

    const editors = container.querySelectorAll<HTMLElement>('[contenteditable="true"]');
    expect(editors).toHaveLength(2);

    const first = editors[0];
    await act(async () => {
      first.innerHTML = 'Vote now';
      first.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(items()).toEqual(['Vote now', 'Organize']);

    selectContents(first);
    await act(async () => {
      mousedown(container.querySelector('button[aria-label="Bold"]'));
    });
    expect(items()).toEqual(['<strong>Vote now</strong>', 'Organize']);

    const second = container.querySelectorAll<HTMLElement>('[contenteditable="true"]')[1];
    selectContents(second);
    await act(async () => {
      mousedown(container.querySelector('button[aria-label="Insert link"]'));
    });
    const dialog = container.querySelector<HTMLFormElement>('form[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('input');
    if (!dialog || !input) throw new Error('expected the link dialog');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, '/events');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      dialog.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // The link belongs to item 2, and item 1 keeps the formatting from before.
    expect(items()).toEqual(['<strong>Vote now</strong>', '<a href="/events">Organize</a>']);
    expect(serialized()).toContain(
      '<ul class="cw-list cw-list--bullet"><li><strong>Vote now</strong></li><li><a href="/events">Organize</a></li></ul>'
    );

    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find(
          (button) => button.textContent === 'Add list item'
        ) as HTMLButtonElement
      ).click();
    });
    expect(items()).toHaveLength(3);
    expect(document.activeElement).toBe(container.querySelectorAll('[contenteditable="true"]')[2]);

    await act(async () => {
      const added = container.querySelectorAll<HTMLElement>('[contenteditable="true"]')[2];
      added.innerHTML = 'Donate';
      added.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(items()[2]).toBe('Donate');
  });

  it('adds a list item on Enter, breaks a line on Shift+Enter and removes an item', async () => {
    await act(async () => {
      root.render(
        <ListHarness initial={{ id: 'l', type: 'orderedList', items: ['Vote', 'Organize'] }} />
      );
    });

    const first = container.querySelectorAll<HTMLElement>('[contenteditable="true"]')[0];
    selectContents(first);
    await act(async () => {
      first.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });
    expect(items()).toEqual(['Vote', '', 'Organize']);
    expect(document.activeElement).toBe(container.querySelectorAll('[contenteditable="true"]')[1]);

    const added = container.querySelectorAll<HTMLElement>('[contenteditable="true"]')[1];
    await act(async () => {
      added.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(items()[1]).toContain('<br>');

    await act(async () => {
      (
        container.querySelector('button[aria-label="Remove list item 2"]') as HTMLButtonElement
      ).click();
    });
    expect(items()).toEqual(['Vote', 'Organize']);
    expect(document.activeElement).toBe(container.querySelectorAll('[contenteditable="true"]')[1]);
  });

  it('removes an empty list item on Backspace and moves focus to the previous item', async () => {
    await act(async () => {
      root.render(<ListHarness initial={{ id: 'l', type: 'bulletList', items: ['Vote', ''] }} />);
    });

    const editors = container.querySelectorAll<HTMLElement>('[contenteditable="true"]');
    expect(editors).toHaveLength(2);

    await act(async () => {
      editors[1].focus();
      editors[1].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })
      );
    });

    expect(items()).toEqual(['Vote']);
    expect(container.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
    expect(document.activeElement).toBe(container.querySelectorAll('[contenteditable="true"]')[0]);
  });

  it('round-trips a list through the raw HTML escape hatch', async () => {
    await act(async () => {
      root.render(
        <ListHarness initial={{ id: 'l', type: 'bulletList', items: ['Vote', 'Organize'] }} />
      );
    });

    await act(async () => {
      (
        container.querySelector('button[aria-label="Edit list items as HTML"]') as HTMLButtonElement
      ).click();
    });

    const raw = container.querySelector('textarea');
    expect(raw?.value).toBe('Vote\nOrganize');
    if (!raw) return;

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setValue?.call(raw, '<strong>One</strong>\nTwo');
      raw.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(items()).toEqual(['<strong>One</strong>', 'Two']);
    expect(serialized()).toContain(
      '<ul class="cw-list cw-list--bullet"><li><strong>One</strong></li><li>Two</li></ul>'
    );

    await act(async () => {
      (
        container.querySelector('button[aria-label="Edit list visually"]') as HTMLButtonElement
      ).click();
    });
    expect(container.querySelectorAll('[contenteditable="true"]')).toHaveLength(2);
    expect(container.querySelectorAll<HTMLElement>('[contenteditable="true"]')[0].innerHTML).toBe(
      '<strong>One</strong>'
    );
  });

  function contentEditor(): HTMLElement {
    const editor = container.querySelector<HTMLElement>('[contenteditable="true"]');
    if (!editor) throw new Error('expected a visual content editor');
    return editor;
  }

  function items(): string[] {
    return JSON.parse(container.querySelector('[data-testid="items"]')?.textContent ?? '[]');
  }
});

function BlockHarness({ initial }: { initial: Block }) {
  const [block, setBlock] = useState<Block>(initial);
  return (
    <div>
      {block.type === 'paragraph' && (
        <ParagraphBlockEditor currentBlock={block} setCurrentBlock={setBlock} />
      )}
      {block.type === 'heading' && (
        <HeadingBlockEditor currentBlock={block} setCurrentBlock={setBlock} />
      )}
      {block.type === 'quote' && (
        <QuoteBlockEditor currentBlock={block} setCurrentBlock={setBlock} />
      )}
      <output data-testid="serialized">{serializeBlocks([block])}</output>
      <button type="button" onClick={() => setBlock(initial)}>
        Restore initial draft
      </button>
    </div>
  );
}

function ListHarness({ initial }: { initial: Block }) {
  const [block, setBlock] = useState<Block>(initial);
  return (
    <div>
      {(block.type === 'bulletList' || block.type === 'orderedList') && (
        <ListBlockEditor currentBlock={block} setCurrentBlock={setBlock} />
      )}
      <output data-testid="serialized">{serializeBlocks([block])}</output>
      <output data-testid="items">
        {JSON.stringify(
          block.type === 'bulletList' || block.type === 'orderedList' ? block.items : []
        )}
      </output>
      <button type="button" onClick={() => setBlock(initial)}>
        Restore initial draft
      </button>
    </div>
  );
}

function selectContents(editor: HTMLElement) {
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  const selection = window.getSelection();
  if (!selection) throw new Error('expected a selection');
  selection.removeAllRanges();
  selection.addRange(range);
  // The gesture that would create this selection in a browser also records it
  // for the toolbar's keyboard path, which runs after focus has moved.
  editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

/** A run of text the test can address, wherever it sits in the editor. */
function findTextNode(editor: HTMLElement, text: string): { node: Text; index: number } {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.textContent ?? '';
    const index = value.indexOf(text);
    if (index !== -1) return { node: node as Text, index };
    node = walker.nextNode();
  }
  throw new Error(`expected to find "${text}" in the editor`);
}

/** Selects one run of text by its content, so formatting can be toggled. */
function selectText(editor: HTMLElement, text: string) {
  const { node, index } = findTextNode(editor, text);
  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + text.length);
  const selection = window.getSelection();
  if (!selection) throw new Error('expected a selection');
  selection.removeAllRanges();
  selection.addRange(range);
  editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

/** Puts a collapsed caret inside a run of text at an offset in that run. */
function placeCaretAtText(editor: HTMLElement, text: string, offset: number) {
  const { node, index } = findTextNode(editor, text);
  const range = document.createRange();
  range.setStart(node, index + offset);
  range.collapse(true);
  const selection = window.getSelection();
  if (!selection) throw new Error('expected a selection');
  selection.removeAllRanges();
  selection.addRange(range);
}

function mousedown(element: Element | null) {
  if (!element) throw new Error('expected the toolbar control');
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}
