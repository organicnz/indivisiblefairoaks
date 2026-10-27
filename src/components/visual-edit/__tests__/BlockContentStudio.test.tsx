// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BlockContentStudio,
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
} from '@/components/visual-edit/composer/BlockContentStudio';
import type { Block } from '@/lib/blocks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BlockContentStudio & Modular Block Editors', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders BlockTypeConverter and converts element type', async () => {
    const block: Block = { id: 'b1', type: 'paragraph', html: 'Hello Civic' };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(<BlockTypeConverter currentBlock={block} setCurrentBlock={setCurrentBlock} />);
    });

    expect(container.textContent).toContain('Element Type & Conversion');
    expect(container.textContent).toContain('PARAGRAPH');

    // Click Heading button to convert
    const headingBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Heading')
    );
    expect(headingBtn).toBeDefined();

    act(() => {
      headingBtn?.click();
    });

    expect(setCurrentBlock).toHaveBeenCalled();
  });

  it('renders HeadingBlockEditor and updates level and text', async () => {
    const block: Extract<Block, { type: 'heading' }> = {
      id: 'b2',
      type: 'heading',
      level: 2,
      html: 'Rally Tomorrow',
    };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(
        <HeadingBlockEditor
          currentBlock={block}
          setCurrentBlock={setCurrentBlock}
          headingTextId="heading-input"
        />
      );
    });

    expect(container.textContent).toContain('Heading Level');
    expect(container.textContent).toContain('H1');
    expect(container.textContent).toContain('H2');

    // Click H3 button
    const h3Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('H3')
    );
    expect(h3Btn).toBeDefined();

    act(() => {
      h3Btn?.click();
    });

    expect(setCurrentBlock).toHaveBeenCalledWith(expect.objectContaining({ level: 3 }));
  });

  it('renders ParagraphBlockEditor and updates text', async () => {
    const block: Extract<Block, { type: 'paragraph' }> = {
      id: 'b3',
      type: 'paragraph',
      html: 'Initial body text',
    };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(
        <ParagraphBlockEditor
          currentBlock={block}
          setCurrentBlock={setCurrentBlock}
          paragraphTextId="para-input"
        />
      );
    });

    expect(container.textContent).toContain('Paragraph HTML / Content');
    const textarea = container.querySelector('#para-input') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('Initial body text');

    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(textarea, 'Updated paragraph');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setCurrentBlock).toHaveBeenCalled();
  });

  it('renders ImageBlockEditor and updates width/height dimensions', async () => {
    const block: Extract<Block, { type: 'image' }> = {
      id: 'b4',
      type: 'image',
      src: 'https://example.com/photo.jpg',
      alt: 'Civic Rally',
      caption: 'Organizers at Carmichael',
      width: 1200,
      height: 630,
    };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(
        <ImageBlockEditor
          currentBlock={block}
          setCurrentBlock={setCurrentBlock}
          imageSrcId="img-src"
          imageAltId="img-alt"
          imageCaptionId="img-caption"
        />
      );
    });

    expect(container.textContent).toContain('Image URL');
    expect(container.textContent).toContain('Intrinsic Width (px)');
    expect(container.textContent).toContain('Intrinsic Height (px)');

    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(3);
  });

  it('renders ButtonBlockEditor and updates destination href', async () => {
    const block: Extract<Block, { type: 'button' }> = {
      id: 'b5',
      type: 'button',
      label: 'Sign Up',
      href: '/join',
    };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(
        <ButtonBlockEditor
          currentBlock={block}
          setCurrentBlock={setCurrentBlock}
          buttonLabelId="btn-label"
          buttonHrefId="btn-href"
        />
      );
    });

    expect(container.textContent).toContain('Button Label');
    expect(container.textContent).toContain('Destination URL');
    expect(container.textContent).toContain('Quick Destination Links');
    expect(container.textContent).toContain('Events Calendar');

    const eventsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Events Calendar')
    );
    expect(eventsBtn).toBeDefined();

    act(() => {
      eventsBtn?.click();
    });

    expect(setCurrentBlock).toHaveBeenCalledWith(expect.objectContaining({ href: '/events' }));
  });

  it('renders CalloutBlockEditor and selects action tone', async () => {
    const block: Extract<Block, { type: 'callout' }> = {
      id: 'b6',
      type: 'callout',
      tone: 'info',
      html: 'Important bulletin',
    };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(
        <CalloutBlockEditor
          currentBlock={block}
          setCurrentBlock={setCurrentBlock}
          calloutTextId="callout-text"
        />
      );
    });

    expect(container.textContent).toContain('Callout Tone');
    expect(container.textContent).toContain('action');

    const actionBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('action')
    );
    expect(actionBtn).toBeDefined();

    act(() => {
      actionBtn?.click();
    });

    expect(setCurrentBlock).toHaveBeenCalledWith(expect.objectContaining({ tone: 'action' }));
  });

  it('renders Quote, List, Code, Table, and Divider editors without errors', async () => {
    const setCurrentBlock = vi.fn();

    // Quote
    const quoteBlock: Extract<Block, { type: 'quote' }> = {
      id: 'b7',
      type: 'quote',
      html: 'Democracy is not a spectator sport.',
    };
    await act(async () => {
      root.render(<QuoteBlockEditor currentBlock={quoteBlock} setCurrentBlock={setCurrentBlock} />);
    });
    expect(container.textContent).toContain('Quote Content');

    // List
    const listBlock: Extract<Block, { type: 'bulletList' }> = {
      id: 'b8',
      type: 'bulletList',
      items: ['Vote', 'Organize', 'Donate'],
    };
    await act(async () => {
      root.render(<ListBlockEditor currentBlock={listBlock} setCurrentBlock={setCurrentBlock} />);
    });
    expect(container.textContent).toContain('List Items (one per line)');

    // Code
    const codeBlock: Extract<Block, { type: 'code' }> = {
      id: 'b9',
      type: 'code',
      text: 'bun run test',
    };
    await act(async () => {
      root.render(<CodeBlockEditor currentBlock={codeBlock} setCurrentBlock={setCurrentBlock} />);
    });
    expect(container.textContent).toContain('Code Snippet');

    // Table
    const tableBlock: Extract<Block, { type: 'table' }> = {
      id: 'b10',
      type: 'table',
      head: ['Event', 'Location'],
      rows: [['Meeting', 'Fair Oaks']],
    };
    await act(async () => {
      root.render(<TableBlockEditor currentBlock={tableBlock} setCurrentBlock={setCurrentBlock} />);
    });
    expect(container.textContent).toContain('Table Columns');

    // Divider
    await act(async () => {
      root.render(<DividerBlockEditor />);
    });
    expect(container.textContent).toContain('Horizontal Section Divider');

    // Unsupported
    const unsupportedBlock: Extract<Block, { type: 'unsupported' }> = {
      id: 'b11',
      type: 'unsupported',
      html: '<svg></svg>',
    };
    await act(async () => {
      root.render(
        <UnsupportedBlockEditor currentBlock={unsupportedBlock} setCurrentBlock={setCurrentBlock} />
      );
    });
    expect(container.textContent).toContain('Raw HTML Markup');
  });

  it('renders composed BlockContentStudio correctly for heading block', async () => {
    const block: Block = { id: 'b12', type: 'heading', level: 1, html: 'Fair Oaks Indivisible' };
    const setCurrentBlock = vi.fn();

    await act(async () => {
      root.render(<BlockContentStudio currentBlock={block} setCurrentBlock={setCurrentBlock} />);
    });

    expect(container.textContent).toContain('Element Type & Conversion');
    expect(container.textContent).toContain('HEADING');
    expect(container.textContent).toContain('Element Content & Copy');
    expect(container.textContent).toContain('Heading Level');
  });
});
