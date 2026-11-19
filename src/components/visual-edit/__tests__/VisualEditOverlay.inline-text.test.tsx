// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  container,
  getContentBySlugForEdit,
  mount,
  renderPage,
  saveContent,
  toast,
  withPage,
} from './VisualEditOverlay.harness';
import { type OverlayMediaSelection, overlayMocks } from './VisualEditOverlay.mocks';

vi.mock('@/lib/actions/content', async () => {
  const { overlayMocks } = await import('./VisualEditOverlay.mocks');
  return overlayMocks.content;
});
vi.mock('@/lib/actions/crm', async () => {
  const { overlayMocks } = await import('./VisualEditOverlay.mocks');
  return overlayMocks.crm;
});
vi.mock('../CRMPanel', () => ({ CRMPanel: () => null }));
vi.mock('@/lib/actions/visual', async () => {
  const { overlayMocks } = await import('./VisualEditOverlay.mocks');
  return overlayMocks.visual;
});
vi.mock('sonner', async () => {
  const { overlayMocks } = await import('./VisualEditOverlay.mocks');
  return { toast: overlayMocks.toast };
});
vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: () => overlayMocks.editContext,
}));
vi.mock('@/components/admin/crm/composer/CRMMediaLibraryModal', () => ({
  CRMMediaLibraryModal: (props: {
    isOpen: boolean;
    onSelectMedia: (media: OverlayMediaSelection) => void | Promise<void>;
  }) => {
    if (props.isOpen) overlayMocks.mediaLibrary.onSelectMedia = props.onSelectMedia;
    return null;
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => overlayMocks.router,
  usePathname: () => overlayMocks.pathname.value,
}));
vi.mock('@/components/layout/visual-edit-store', () => ({
  registerVisualEditExitGuard: vi.fn(),
  useVisualEditMode: () => ({
    enabled: overlayMocks.visualMode.enabled,
    toggle: () => {
      overlayMocks.visualMode.enabled = !overlayMocks.visualMode.enabled;
    },
  }),
}));

describe('VisualEditOverlay — inline text and link editing', () => {
  it('toggles responsive viewport modes (desktop, tablet, mobile) and constrains layout', async () => {
    await withPage();

    const tabletBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Tablet viewport"]'
    );
    const mobileBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Mobile viewport"]'
    );
    const desktopBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Desktop viewport"]'
    );

    expect(tabletBtn).not.toBeNull();
    expect(mobileBtn).not.toBeNull();
    expect(desktopBtn).not.toBeNull();
    expect(desktopBtn?.getAttribute('aria-pressed')).toBe('true');

    const main = document.querySelector('main');
    expect(main).not.toBeNull();

    await act(async () => {
      tabletBtn?.click();
    });

    expect(tabletBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(main?.style.maxWidth).toBe('768px');

    await act(async () => {
      mobileBtn?.click();
    });

    expect(mobileBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(main?.style.maxWidth).toBe('390px');

    await act(async () => {
      desktopBtn?.click();
    });

    expect(desktopBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(main?.style.maxWidth).toBe('');
  });

  it('renders rich in-place formatting toolbar on clicking editable text element', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    expect(heading).not.toBeNull();

    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const toolbar = container.querySelector('[data-inline-toolbar="true"]');
    expect(toolbar).not.toBeNull();

    // Check formatting buttons
    expect(toolbar?.querySelector('button[aria-label="Bold"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Italic"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Underline"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Strikethrough"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Inline Code"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Highlight"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Bullet list"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Numbered list"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Insert link"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Remove link"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Clear formatting"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Heading 2"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Heading 3"]')).not.toBeNull();
    expect(toolbar?.querySelector('button[aria-label="Paragraph"]')).not.toBeNull();

    // Word and character count badge
    expect(toolbar?.textContent).toMatch(/\d+w · \d+c/);
  });

  /**
   * A page whose only block is a paragraph containing a link.
   *
   * This is the shape that made a destination-only edit invisible: the session
   * element is the `<a>`, so `innerHTML` serializes "the guide" and says
   * nothing about where it points — and the paragraph, not the anchor, is the
   * block the model has to persist.
   */
  const linkedBody = '<p>Read <a href="/guide">the guide</a> today.</p>';

  const withLinkedPage = async () => {
    renderPage(linkedBody);
    getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      title: 'About Us',
      slug: 'about',
      excerpt: null,
      type: 'page',
      status: 'publish',
      body: linkedBody,
      featured_image: null,
      metadata: {},
      updated_at: '2026-10-09T00:00:00Z',
    });
    await mount();
  };

  it('makes a link inside the page editable instead of following it', async () => {
    await withLinkedPage();

    const anchor = document.querySelector<HTMLAnchorElement>('main a');
    expect(anchor).not.toBeNull();

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      anchor?.dispatchEvent(click);
    });

    // Navigation is an anchor's default action. Preventing it is what keeps the
    // organiser on the page they are editing rather than on its destination.
    expect(click.defaultPrevented).toBe(true);
    expect(anchor?.contentEditable).toBe('true');

    const toolbar = container.querySelector('[data-inline-toolbar="true"]');
    expect(toolbar?.querySelector('button[aria-label="Edit link"]')).not.toBeNull();
  });

  it('makes a header navigation link editable without navigating', async () => {
    await withLinkedPage();

    const header = document.createElement('header');
    const nav = document.createElement('nav');
    const tab = document.createElement('a');
    tab.href = '/events';
    tab.textContent = 'Events';
    nav.appendChild(tab);
    header.appendChild(nav);
    document.body.insertBefore(header, document.body.firstChild);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      tab.dispatchEvent(click);
    });

    expect(click.defaultPrevented).toBe(true);
    expect(tab.contentEditable).toBe('true');
    expect(
      container.querySelector('[data-inline-toolbar="true"] button[aria-label="Edit link"]')
    ).not.toBeNull();

    // Header links are outside the saved block document. A commit must not
    // report a success the next render will erase.
    toast.error.mockClear();
    await act(async () => {
      tab.textContent = 'Events edited';
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
      );
    });

    expect(toast.error).toHaveBeenCalledWith(
      'This text is outside the saved page document, so it cannot be saved.'
    );
    expect(tab.textContent).toBe('Events');
    expect(tab.contentEditable).toBe('false');
  });

  it('commits an inline edit once when saved with the keyboard shortcut', async () => {
    /*
     * Cmd+S used to start `commitInlineEdit` and then immediately persist the
     * pre-edit `blocks` array. That second write raced the inline commit on the
     * same row version, so the text on screen could lose to the body behind it.
     */
    await withPage();

    const paragraph = document.querySelector<HTMLElement>('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    await act(async () => {
      paragraph.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(paragraph.classList.contains('visual-inline-active')).toBe(true);
    saveContent.mockClear();

    await act(async () => {
      paragraph.innerHTML = 'Intro copy, shortcut saved.';
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true })
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(saveContent.mock.calls[0]?.[0]?.body).toContain('Intro copy, shortcut saved.');
  });

  it('leaves header controls functional so the editorial toggle still works', async () => {
    await withLinkedPage();

    const header = document.createElement('header');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = 'Editorial';
    header.appendChild(toggle);
    document.body.insertBefore(header, document.body.firstChild);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      toggle.dispatchEvent(click);
    });

    // The mode toggle, theme switch and menu are <button>s in the header.
    // Intercepting them would leave the editor unable to turn itself off.
    expect(click.defaultPrevented).toBe(false);
    expect(toggle.contentEditable).not.toBe('true');
    expect(container.querySelector('[data-inline-toolbar="true"]')).toBeNull();
  });

  it('persists an edited link destination to the paragraph that contains it', async () => {
    await withLinkedPage();

    const anchor = document.querySelector<HTMLAnchorElement>('main a');
    await act(async () => {
      anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const editLink = container.querySelector<HTMLButtonElement>('button[aria-label="Edit link"]');
    expect(editLink).not.toBeNull();

    // The pill variant activates on mouse-down so the contentEditable
    // selection does not collapse before the command runs.
    await act(async () => {
      editLink?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Edit link');

    const input = dialog?.querySelector<HTMLInputElement>('#link-url');
    expect(input?.value).toBe('/guide');

    // React tracks the previous value on the DOM node, so assigning `.value`
    // directly is discarded; the native setter plus an input event is the
    // change React actually observes.
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'https://example.org/new-guide');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    await act(async () => {
      save?.click();
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    const written = saveContent.mock.calls[0][0].body as string;
    expect(written).toContain('href="https://example.org/new-guide"');
    // The block is the paragraph. Persisting the anchor's own innerHTML would
    // replace the paragraph with "the guide".
    expect(written).toContain('Read ');
    expect(written).toContain('today.');
  });

  it('refuses to edit a link whose anchor was replaced while the dialog was open', async () => {
    await withLinkedPage();

    const anchor = document.querySelector<HTMLAnchorElement>('main a');
    expect(anchor).not.toBeNull();
    if (!anchor) throw new Error('expected the linked anchor');

    await act(async () => {
      anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const editLink = container.querySelector<HTMLButtonElement>('button[aria-label="Edit link"]');
    expect(editLink).not.toBeNull();
    await act(async () => {
      editLink?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#link-url');
    if (!input) throw new Error('expected the link URL input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'https://example.org/new-guide');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // A page refresh or re-render can replace the anchor that opened this
    // dialog. The dialog must not write to the detached node or a new session.
    const replacement = document.createElement('a');
    replacement.href = '/guide';
    replacement.textContent = 'the guide';
    await act(async () => {
      anchor.replaceWith(replacement);
    });
    expect(anchor.isConnected).toBe(false);

    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
    });

    expect(anchor.getAttribute('href')).toBe('/guide');
    expect(replacement.getAttribute('href')).toBe('/guide');
    expect(saveContent).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'This link is no longer editable. Select it again to change its destination.'
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const fallback = document.querySelector<HTMLElement>('[data-editor-focus-fallback]');
    expect(fallback).not.toBeNull();
    expect(document.activeElement).toBe(fallback);
  });

  it('renders image action pill when clicking an image element instead of making it contentEditable', async () => {
    await withPage();

    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    document.querySelector('main')?.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(img.contentEditable).not.toBe('true');

    const imageToolbar = container.querySelector('[aria-label="Image asset controls"]');
    expect(imageToolbar).not.toBeNull();
    expect(imageToolbar?.textContent).toContain('Replace');
    expect(imageToolbar?.textContent).toContain('Upload');
    expect(imageToolbar?.textContent).toContain('Alt Text');
  });

  it('opens a link insert dialog instead of browser prompt when clicking the inline toolbar link button', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const linkBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Insert link"]');
    expect(linkBtn).not.toBeNull();

    // The pill variant uses onMouseDown (not onClick) to prevent the
    // contentEditable selection from collapsing before the command runs.
    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Insert link');
    expect(dialog?.querySelector('input[type="url"]')).not.toBeNull();
    expect(dialog?.querySelector('button[data-confirm]')).not.toBeNull();
  });

  it('keeps the link dialog open and reports an unsafe destination', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const linkBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Insert link"]');
    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#link-url');
    expect(input).not.toBeNull();

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'javascript:alert(1)');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      input?.dispatchEvent(enter);
    });

    expect(enter.defaultPrevented).toBe(true);
    expect(toast.error).toHaveBeenCalledWith('Use an http(s), mailto:, tel:, or relative link.');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('restores the inline selection before creating a link', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    expect(heading).not.toBeNull();
    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(heading?.contentEditable).toBe('true');

    const text = heading?.firstChild;
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(text as Node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    expect(selection?.toString()).toBe('Mission');

    const linkBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Insert link"]');
    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    // The dialog has focus now. A real browser may drop the page selection;
    // the editor must have cloned it before that happened.
    selection?.removeAllRanges();
    expect(selection?.toString()).toBe('');

    const dialog = document.querySelector('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#link-url');
    expect(input).not.toBeNull();
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'https://example.org');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input?.value).toBe('https://example.org');

    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    expect(save?.disabled).toBe(false);

    const selectedAtCommand: string[] = [];
    const execCommand = vi.fn((command: string) => {
      if (command === 'createLink') {
        selectedAtCommand.push(window.getSelection()?.toString() ?? '');
      }
      return true;
    });
    const originalExecCommand = document.execCommand;
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    try {
      await act(async () => {
        save?.click();
      });
    } finally {
      if (originalExecCommand) {
        Object.defineProperty(document, 'execCommand', {
          configurable: true,
          value: originalExecCommand,
        });
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
    }

    expect(execCommand).toHaveBeenCalledWith('createLink', false, 'https://example.org');
    expect(selectedAtCommand).toEqual(['Mission']);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('refuses a stale link range instead of creating a link elsewhere', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    expect(heading).not.toBeNull();
    if (!heading) throw new Error('expected the heading');
    await act(async () => {
      heading.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const text = heading.firstChild;
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(text as Node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const linkBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Insert link"]');
    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#link-url');
    if (!input) throw new Error('expected the link URL input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'https://example.org');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Removing the edited element detaches the captured range and takes the
    // inline session's element out of the document while the dialog is open.
    await act(async () => {
      heading.remove();
    });
    expect(heading.isConnected).toBe(false);

    const execCommand = vi.fn();
    const originalExecCommand = document.execCommand;
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    try {
      const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
      expect(save).not.toBeNull();
      await act(async () => {
        save?.click();
      });
    } finally {
      if (originalExecCommand) {
        Object.defineProperty(document, 'execCommand', {
          configurable: true,
          value: originalExecCommand,
        });
      }
    }

    expect(execCommand).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'The selected text is no longer editable. Select it again to add a link.'
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const fallback = document.querySelector<HTMLElement>('[data-editor-focus-fallback]');
    expect(fallback).not.toBeNull();
    expect(document.activeElement).toBe(fallback);
  });

  it('restores the inline selection when the link dialog is cancelled', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const text = heading?.firstChild;
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(text as Node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const linkBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Insert link"]');
    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    selection?.removeAllRanges();

    const dialog = document.querySelector('[role="dialog"]');
    const cancel = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Cancel'
    );
    expect(cancel).toBeDefined();
    await act(async () => {
      cancel?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(window.getSelection()?.toString()).toBe('Mission');
  });

  it('returns focus to the editor fallback when a cancelled link range is stale', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    expect(heading).not.toBeNull();
    if (!heading) throw new Error('expected the heading');
    await act(async () => {
      heading.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const text = heading.firstChild;
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(text as Node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const linkBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Insert link"]');
    await act(async () => {
      linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const cancel = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Cancel'
    );
    expect(cancel).toBeDefined();

    await act(async () => {
      heading.remove();
    });
    await act(async () => {
      cancel?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const fallback = document.querySelector<HTMLElement>('[data-editor-focus-fallback]');
    expect(fallback).not.toBeNull();
    expect(document.activeElement).toBe(fallback);
  });

  it('restores the inline selection before a slash command runs', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    await act(async () => {
      heading?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const text = heading?.firstChild;
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(text as Node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const slashButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open Slash Commands"]'
    );
    expect(slashButton).not.toBeNull();
    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    await act(async () => {
      slashButton?.dispatchEvent(mouseDown);
    });
    expect(mouseDown.defaultPrevented).toBe(true);

    await act(async () => {
      slashButton?.click();
    });
    selection?.removeAllRanges();
    expect(selection?.toString()).toBe('');

    const h2Command = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Heading 2')
    );
    expect(h2Command).toBeDefined();

    const selectedAtCommand: string[] = [];
    const execCommand = vi.fn((command: string) => {
      if (command === 'formatBlock') {
        selectedAtCommand.push(window.getSelection()?.toString() ?? '');
      }
      return true;
    });
    const originalExecCommand = document.execCommand;
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    try {
      await act(async () => {
        h2Command?.click();
      });
    } finally {
      if (originalExecCommand) {
        Object.defineProperty(document, 'execCommand', {
          configurable: true,
          value: originalExecCommand,
        });
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
    }

    expect(execCommand).toHaveBeenCalledWith('formatBlock', false, '<h2>');
    expect(selectedAtCommand).toEqual(['Mission']);
  });

  it('refuses a slash command after the captured text is removed', async () => {
    await withPage();

    const heading = document.querySelector('h2');
    expect(heading).not.toBeNull();
    if (!heading) throw new Error('expected the heading');
    await act(async () => {
      heading.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const text = heading.firstChild;
    expect(text).not.toBeNull();
    const range = document.createRange();
    range.selectNodeContents(text as Node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const slashButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open Slash Commands"]'
    );
    expect(slashButton).not.toBeNull();
    await act(async () => {
      slashButton?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      slashButton?.click();
    });
    selection?.removeAllRanges();

    await act(async () => {
      heading.remove();
    });
    expect(heading.isConnected).toBe(false);

    const h2Command = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Heading 2')
    );
    expect(h2Command).toBeDefined();

    const execCommand = vi.fn();
    const originalExecCommand = document.execCommand;
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    try {
      await act(async () => {
        h2Command?.click();
      });
    } finally {
      if (originalExecCommand) {
        Object.defineProperty(document, 'execCommand', {
          configurable: true,
          value: originalExecCommand,
        });
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
    }

    expect(execCommand).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'The selected text is no longer editable. Select it again and retry.'
    );
    const fallback = document.querySelector<HTMLElement>('[data-editor-focus-fallback]');
    expect(fallback).not.toBeNull();
    expect(document.activeElement).toBe(fallback);
  });
});
