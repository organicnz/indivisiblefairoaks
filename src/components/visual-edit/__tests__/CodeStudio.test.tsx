// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CodeCustomStylesStudio,
  CodeHtmlStudio,
  CodeJsonExchangeStudio,
  CodeStudio,
} from '@/components/visual-edit/composer/CodeStudio';
import { DEFAULT_VC_STYLES } from '@/components/visual-edit/composer/constants';
import type { Block } from '@/lib/blocks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('CodeStudio and Sub-Studios', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockBlock: Block = {
    id: 'code-block-1',
    type: 'paragraph',
    html: '<div class="civic-alert">  <p>Urgent Action</p>  </div>',
  };

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

  it('renders CodeHtmlStudio and cleans extraneous whitespace', async () => {
    let currentBlock: Block = { ...mockBlock };
    const setCurrentBlock = vi.fn((b: Block) => {
      currentBlock = b;
    });

    await act(async () => {
      root.render(
        <CodeHtmlStudio
          currentBlock={currentBlock}
          setCurrentBlock={setCurrentBlock}
          rawHtmlInputId="test-html-input"
        />
      );
    });

    expect(container.textContent).toContain('Raw Block HTML Markup');
    expect(container.textContent).toContain('Direct HTML');
    expect(container.textContent).toContain('Target: paragraph (#code-block-1)');

    const textarea = container.querySelector('#test-html-input') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe(mockBlock.html);

    // Click Minify Spaces button
    const minifyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Minify Spaces')
    );
    expect(minifyBtn).toBeDefined();

    await act(async () => {
      minifyBtn?.click();
    });

    expect(setCurrentBlock).toHaveBeenCalled();
    expect('html' in currentBlock && currentBlock.html).toBe(
      '<div class="civic-alert"><p>Urgent Action</p></div>'
    );
  });

  it('renders CodeCustomStylesStudio and appends design tokens and inline style snippets', async () => {
    let currentStyles = { ...DEFAULT_VC_STYLES };
    const setStyles = vi.fn((update) => {
      currentStyles = typeof update === 'function' ? update(currentStyles) : update;
    });

    await act(async () => {
      root.render(
        <CodeCustomStylesStudio
          styles={currentStyles}
          setStyles={setStyles}
          blockAnchorIdInputId="test-anchor-id"
          customClassesInputId="test-custom-classes"
          customStyleInputId="test-custom-style"
        />
      );
    });

    expect(container.textContent).toContain('Block Element Anchor ID (Deep Linking)');
    expect(container.textContent).toContain('Custom CSS & Tailwind Utilities');
    expect(container.textContent).toContain('Custom Inline CSS Styles');
    expect(container.textContent).toContain('Quick Design Tokens:');

    // Click quick token button (e.g. +Amber Glow)
    const tokenBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('+Amber Glow')
    );
    expect(tokenBtn).toBeDefined();

    await act(async () => {
      tokenBtn?.click();
    });

    expect(setStyles).toHaveBeenCalled();

    // Click inline CSS quick snippet (e.g. +Tracking Spacing)
    const snippetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('+Tracking Spacing')
    );
    expect(snippetBtn).toBeDefined();

    await act(async () => {
      snippetBtn?.click();
    });

    expect(setStyles).toHaveBeenCalledTimes(2);
    expect(currentStyles.customStyle).toContain('letter-spacing: 0.05em;');
  });

  it('renders CodeJsonExchangeStudio and handles export and format actions', async () => {
    let draft = JSON.stringify({ theme: 'civic' });
    const setJsonConfigDraft = vi.fn((val) => {
      draft = val;
    });
    const onExportJson = vi.fn();
    const onImportJson = vi.fn();

    await act(async () => {
      root.render(
        <CodeJsonExchangeStudio
          designJsonInputId="test-json-input"
          jsonConfigDraft={draft}
          setJsonConfigDraft={setJsonConfigDraft}
          onExportJson={onExportJson}
          onImportJson={onImportJson}
        />
      );
    });

    expect(container.textContent).toContain('Design Config JSON Studio');
    expect(container.textContent).toContain('Export JSON');
    expect(container.textContent).toContain('Import JSON');

    const exportBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export JSON')
    );
    await act(async () => {
      exportBtn?.click();
    });
    expect(onExportJson).toHaveBeenCalledTimes(1);

    const importBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Import JSON')
    );
    await act(async () => {
      importBtn?.click();
    });
    expect(onImportJson).toHaveBeenCalledTimes(1);

    const formatBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Format JSON')
    );
    await act(async () => {
      formatBtn?.click();
    });
    expect(setJsonConfigDraft).toHaveBeenCalledWith(JSON.stringify(JSON.parse(draft), null, 2));
  });

  it('supports sticky sub-tab filtering in CodeStudio', async () => {
    const setCurrentBlock = vi.fn();
    const setStyles = vi.fn();
    const setJsonConfigDraft = vi.fn();
    const onExportJson = vi.fn();
    const onImportJson = vi.fn();

    await act(async () => {
      root.render(
        <CodeStudio
          currentBlock={mockBlock}
          setCurrentBlock={setCurrentBlock}
          styles={DEFAULT_VC_STYLES}
          setStyles={setStyles}
          jsonConfigDraft=""
          setJsonConfigDraft={setJsonConfigDraft}
          onExportJson={onExportJson}
          onImportJson={onImportJson}
        />
      );
    });

    expect(container.textContent).toContain('All Code Controls');
    expect(container.textContent).toContain('HTML Markup');
    expect(container.textContent).toContain('Custom Styles & Inlines');
    expect(container.textContent).toContain('JSON Config Exchange');

    // Switch to HTML Markup sub-tab
    const htmlTabBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'HTML Markup'
    );
    expect(htmlTabBtn).toBeDefined();

    await act(async () => {
      htmlTabBtn?.click();
    });

    expect(container.textContent).toContain('Raw Block HTML Markup');
    expect(container.textContent).not.toContain('Design Config JSON Studio');

    // Switch to JSON Config Exchange sub-tab
    const jsonTabBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'JSON Config Exchange'
    );
    expect(jsonTabBtn).toBeDefined();

    await act(async () => {
      jsonTabBtn?.click();
    });

    expect(container.textContent).toContain('Design Config JSON Studio');
    expect(container.textContent).not.toContain('Raw Block HTML Markup');
  });
});
