// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { BlockEditor } from '@/components/admin/content/BlockEditor';
import { type Block, blockText, parseHtml, resetBlockIds } from '@/lib/blocks';

/**
 * The input debounce is the editor's one piece of shared mutable state, and
 * every failure below is the same bug wearing a different hat: a keystroke is
 * written to the DOM immediately but reaches the model up to 120ms later, so
 * anything that reads the model in that window reads a document that never
 * existed.
 *
 * It shipped because a single-block test cannot see it. One block, one timer,
 * one flush — the closure over `blocks` is correct by accident. It takes two
 * blocks inside one window to see either failure, and type-then-Enter is the
 * single most common action in a block editor.
 */
describe('BlockEditor input debounce', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onChange: Mock<(blocks: Block[], intent?: string | null) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    resetBlockIds();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onChange = vi.fn<(blocks: Block[], intent?: string | null) => void>();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const render = (initial: Block[]) =>
    act(() => {
      root.render(<BlockEditor blocks={initial} onChange={onChange} />);
    });

  /** Commit the last model the editor emitted, as the parent component would. */
  const commitLatest = () => {
    const next = onChange.mock.calls.at(-1)?.[0] as Block[] | undefined;
    if (next) render(next);
    return next;
  };

  const editable = (index = 0) =>
    container.querySelectorAll<HTMLElement>('[contenteditable="true"]')[index];

  const typeInto = (el: HTMLElement, html: string) =>
    act(() => {
      el.innerHTML = html;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

  const pressEnter = (el: HTMLElement) =>
    act(() => {
      el.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });

  /**
   * The plain text of every block, or `[]` when nothing was emitted.
   *
   * Every assertion in this file is about *text surviving*, and reading it back
   * through one helper means a missing emission fails as "no text at all" rather
   * than as a crash inside the assertion.
   */
  const texts = (blocks: Block[] | undefined): string[] => (blocks ? blocks.map(blockText) : []);

  it('keeps both edits when two blocks are typed inside one debounce window', () => {
    render(parseHtml('<p>One</p><p>Two</p>'));

    // Both keystrokes land in the DOM. The model still says "One"/"Two".
    typeInto(editable(0), 'One A');
    typeInto(editable(1), 'Two B');
    expect(editable(0).innerHTML).toBe('One A');
    expect(editable(1).innerHTML).toBe('Two B');

    commitLatest();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const flushed = onChange.mock.calls.at(-1)?.[0];
    expect(flushed).toBeDefined();
    expect(texts(flushed)).toEqual(['One A', 'Two B']);
  });

  it('does not let the second block pending edit cancel the first', () => {
    render(parseHtml('<p>One</p><p>Two</p>'));
    typeInto(editable(0), 'One A');
    typeInto(editable(1), 'Two B');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // Every block's text, in one model, is the assertion that matters.
    const flushed = onChange.mock.calls.at(-1)?.[0];
    expect(texts(flushed)).toEqual(['One A', 'Two B']);
  });

  it('keeps the paragraph Enter created when it was pressed inside the window', () => {
    render(parseHtml('<p>One</p>'));
    typeInto(editable(0), 'One A');
    pressEnter(editable(0));

    // The author's text must survive the split, and the new block must exist.
    const afterEnter = commitLatest();
    expect(texts(afterEnter)[0]).toBe('One A');
    expect(afterEnter).toHaveLength(2);

    // And the pending flush must not resurrect the pre-Enter model, which would
    // silently delete the paragraph the caret was just moved into.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const flushed = onChange.mock.calls.at(-1)?.[0];
    expect(flushed).toHaveLength(2);
    expect(texts(flushed)[0]).toBe('One A');
  });

  it('carries just-typed text across a block conversion', () => {
    render(parseHtml('<p>One</p>'));
    typeInto(editable(0), 'One A');

    // Open the block's own type menu (labelled with the current kind) and pick
    // Heading. Conversion promises to carry the author's words across.
    const typeMenu = [...container.querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Text'
    );
    expect(typeMenu).toBeDefined();
    act(() => {
      typeMenu?.click();
    });
    const choose = [...container.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').trim().startsWith('Heading')
    );
    expect(choose).toBeDefined();
    act(() => {
      choose?.click();
    });

    const first = commitLatest()?.[0];
    // Reading them from the stale model instead loses whatever was typed in the
    // last 120ms — the conversion is what makes the loss permanent.
    expect(first).toBeDefined();
    expect(first && blockText(first)).toBe('One A');
    expect(first?.type).toBe('heading');
  });

  it('emits one undo intent per burst, not one per block', () => {
    render(parseHtml('<p>One</p><p>Two</p>'));
    typeInto(editable(0), 'One A');
    typeInto(editable(1), 'Two B');
    commitLatest();
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const intent = (onChange.mock.calls.at(-1) ?? [])[1] as string | null;
    expect(intent).not.toBeNull();
    // Coalescing is field-scoped: two different blocks are two intents, and the
    // key must name both so neither silently merges into the other. The key is
    // built from the *set* of blocks, sorted, so the assertion is on membership
    // rather than on the separator or the order they were clicked in.
    const names = String(intent).split(':').slice(1).join(':').split(/[:,]/);
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
  });

  it('still coalesces a single block into one keystroke-sized intent', () => {
    render(parseHtml('<p>One</p>'));
    typeInto(editable(0), 'One A');
    commitLatest();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const intent = (onChange.mock.calls.at(-1) ?? [])[1] as string | null;
    // Byte-identical to the pre-fix key, so existing per-field coalescing is
    // unchanged and a run of typing stays one undo step.
    expect(intent).toMatch(/^type:[^:,]+$/);
  });

  it('gives the same intent key however the blocks were clicked in', () => {
    // The key is compared for equality by the parent's history recorder, so two
    // bursts over the same set of blocks have to produce the same string. An
    // insertion-ordered key would differ here and split one run of typing into
    // two undo steps purely because of the order the author moved around.
    //
    // The id counter is reset between the two passes so both render the *same*
    // document with the *same* ids — otherwise the keys would differ for the
    // uninteresting reason that the blocks are not the same blocks.
    const keyFor = (order: readonly [number, number]): string => {
      onChange.mockClear();
      resetBlockIds();
      render(parseHtml('<p>One</p><p>Two</p>'));
      for (const index of order) typeInto(editable(index), `Block ${index} typed`);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      return (onChange.mock.calls.at(-1) ?? [])[1] as string;
    };

    const forwards = keyFor([0, 1]);
    const backwards = keyFor([1, 0]);
    expect(forwards).toMatch(/^type:/);
    expect(backwards).toBe(forwards);
  });
});
