// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '@/components/admin/content/BlockEditor';
import { type Block, blockText, parseHtml, resetBlockIds } from '@/lib/blocks';

/** The visible text of each block, in order — what a reorder assertion means. */
const texts = (blocks: Block[]) => blocks.map(blockText);

/**
 * The reorder handle used to be a decorative <span> with a grip icon: it looked
 * draggable and did nothing. These cover the two paths that now actually move a
 * block — pointer drag and the keyboard route — because a control that only
 * looks like it works is worse than one that is obviously buttons.
 */
describe('BlockEditor reordering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  const render = (html: string, onChange = vi.fn()) => {
    act(() => {
      root.render(<BlockEditor blocks={parseHtml(html)} onChange={onChange} />);
    });
    return onChange;
  };

  /** jsdom has no DragEvent constructor; the handler only reads dataTransfer. */
  /** The only two properties the handler writes, which is all a stub needs. */
  const transfer = (setData = vi.fn()) => ({
    effectAllowed: 'move' as const,
    dropEffect: 'none' as const,
    setData,
  });

  const drag = (type: string, dataTransfer: Partial<DataTransfer>) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    return event;
  };

  const handles = () =>
    [...container.querySelectorAll('button')].filter((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith('Reorder ')
    );

  it('renders a real draggable handle per block, not a decorative icon', () => {
    render('<p>One</p><p>Two</p>');
    const found = handles();
    expect(found).toHaveLength(2);
    for (const handle of found) {
      expect(handle.getAttribute('draggable')).toBe('true');
      // It must also be reachable by keyboard, because a drag handle is not.
      expect(handle.getAttribute('aria-label')).toMatch(/^Reorder .+ block$/);
      expect(handle.tagName).toBe('BUTTON');
    }
  });

  it('describes the keyboard alternative to the drag handle', () => {
    render('<p>One</p>');
    const describedBy = handles()[0].getAttribute('aria-describedby');
    expect(describedBy).toBe('block-reorder-help');
    expect(container.querySelector(`#${describedBy}`)?.textContent).toMatch(/Alt/i);
  });

  it('moves a block with Alt+ArrowUp', () => {
    const onChange = render('<p>One</p><p>Two</p>');
    const second = handles()[1];
    act(() => {
      second.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          altKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    const last = onChange.mock.calls.at(-1)?.[0] as Block[];
    expect(texts(last)).toEqual(['Two', 'One']);
  });

  it('moves a block with Alt+ArrowDown', () => {
    const onChange = render('<p>One</p><p>Two</p>');
    act(() => {
      handles()[0].dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          altKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    const last = onChange.mock.calls.at(-1)?.[0] as Block[];
    expect(texts(last)).toEqual(['Two', 'One']);
  });

  it('does not move a block past the ends of the document', () => {
    const onChange = render('<p>One</p><p>Two</p>');
    act(() => {
      handles()[0].dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          altKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores a plain arrow, which belongs to the caret', () => {
    const onChange = render('<p>One</p><p>Two</p>');
    act(() => {
      handles()[1].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
      );
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reorders on drop, and clears the drag state afterwards', () => {
    const onChange = render('<p>One</p><p>Two</p><p>Three</p>');
    const items = [...container.querySelectorAll('li[data-block-type]')];
    expect(items).toHaveLength(3);

    const dataTransfer = transfer();

    act(() => {
      handles()[0].dispatchEvent(drag('dragstart', dataTransfer));
    });
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', expect.any(String));

    act(() => {
      items[2].dispatchEvent(drag('drop', dataTransfer));
    });
    const last = onChange.mock.calls.at(-1)?.[0] as Block[];
    expect(texts(last)).toEqual(['Two', 'Three', 'One']);

    // The source block must not stay dimmed after the drop.
    act(() => {
      handles()[0].dispatchEvent(drag('dragend', dataTransfer));
    });
    expect(container.querySelectorAll('.opacity-40')).toHaveLength(0);
  });

  it('does not drop a block onto itself', () => {
    const onChange = render('<p>One</p><p>Two</p>');
    const items = [...container.querySelectorAll('li[data-block-type]')];
    const dataTransfer = transfer();
    act(() => {
      handles()[0].dispatchEvent(drag('dragstart', dataTransfer));
    });
    act(() => {
      items[0].dispatchEvent(drag('drop', dataTransfer));
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('BlockEditor link insertion', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  const render = (onChange = vi.fn()) => {
    act(() => {
      root.render(
        <BlockEditor blocks={parseHtml('<p>Read about voting</p>')} onChange={onChange} />
      );
    });
    return onChange;
  };

  /** Set a React-controlled input's value so its onChange actually fires. */
  const setNativeValue = (el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const linkButton = () =>
    [...container.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Add or edit link'
    );

  it('offers a link control in the inline toolbar', () => {
    render();
    expect(linkButton()).toBeDefined();
  });

  it('opens the link editor on click', () => {
    render();
    const button = linkButton() as HTMLButtonElement;
    act(() => {
      button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('input[aria-label="Link URL"]')).not.toBeNull();
  });

  it('opens the link editor from the keyboard, so a link needs no pointer', () => {
    render();
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    act(() => {
      editable.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(container.querySelector('input[aria-label="Link URL"]')).not.toBeNull();
  });

  it('rejects an external link at the point of entry, before it is lost on publish', () => {
    render();
    act(() => {
      linkButton()?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    const input = container.querySelector('input[aria-label="Link URL"]') as HTMLInputElement;
    act(() => {
      setNativeValue(input, 'https://example.com');
    });
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });
    expect(container.textContent).toMatch(/removed when the page is published/i);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
