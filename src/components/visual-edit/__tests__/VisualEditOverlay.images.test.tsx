// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';
import {
  byText,
  container,
  getContentBySlugForEdit,
  mediaLibrary,
  openImageMediaLibrary,
  saveContent,
  toast,
  uploadCRMMedia,
  withPage,
} from './VisualEditOverlay.harness';
import { type OverlayMediaSelection, overlayMocks } from './VisualEditOverlay.mocks';

vi.mock('@/lib/actions/content', () => overlayMocks.content);
vi.mock('@/lib/actions/crm', () => overlayMocks.crm);
vi.mock('../CRMPanel', () => ({ CRMPanel: () => null }));
vi.mock('@/lib/actions/visual', () => overlayMocks.visual);
vi.mock('sonner', () => ({ toast: overlayMocks.toast }));
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

describe('VisualEditOverlay — image editing', () => {
  it('opens an alt text edit dialog instead of browser prompt when clicking the image Alt Text button', async () => {
    await withPage();

    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    document.querySelector('main')?.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();

    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Edit alt text');
    expect(dialog?.querySelector('input[type="text"]')).not.toBeNull();
    expect(dialog?.querySelector('button[data-confirm]')).not.toBeNull();
  });

  it('returns focus to the editor fallback when the image disappears under the alt dialog', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph?.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const cancel = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Cancel'
    );
    expect(cancel).toBeDefined();

    img.remove();
    altBtn?.remove();
    expect(img.isConnected).toBe(false);

    await act(async () => {
      cancel?.click();
    });

    expect(dialog?.isConnected).toBe(false);
    const fallback = document.querySelector<HTMLElement>('[data-editor-focus-fallback]');
    expect(fallback).not.toBeNull();
    expect(document.activeElement).toBe(fallback);
  });

  it('keeps the alt dialog open with the typed value when saving fails', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph?.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#alt-text-input');
    expect(input).not.toBeNull();
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'A revised description');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });
    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();

    await act(async () => {
      save?.click();
    });

    expect(dialog?.isConnected).toBe(true);
    expect(input?.value).toBe('A revised description');
    expect(toast.error).toHaveBeenCalledWith('Network unavailable');
    expect(save?.disabled).toBe(false);

    saveContent.mockResolvedValueOnce({
      success: true,
      data: { id: 7, updatedAt: '2026-10-11T00:00:00Z' },
    });
    await act(async () => {
      save?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('lets a focused field own undo instead of reversing the page behind it', async () => {
    await withPage();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.deleteSection, { detail: { blockIndex: 2 } })
      );
      await Promise.resolve();
    });

    const undo = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Undo the last change"]'
    );
    expect(undo).not.toBeNull();
    expect(undo?.disabled).toBe(false);

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const input = document.querySelector<HTMLInputElement>('#alt-text-input');
    if (!input) throw new Error('expected the alt text input');
    input.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      input.dispatchEvent(event);
      await Promise.resolve();
    });

    expect(event.defaultPrevented).toBe(false);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('undoes a retried alt-text save to the previous description', async () => {
    const oldSrc = 'https://example.com/old.jpg';
    const pageBody = `<p>Intro copy.<img src="${oldSrc}" alt="Old photo"></p><form><input></form><h2 class="cw cw--h2">Mission</h2>`;
    const pageRendered = `<p>Intro copy.<img src="${oldSrc}" alt="Old photo"></p><h2 class="cw cw--h2">Mission</h2>`;
    await withPage({ body: pageBody, rendered: pageRendered });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] p img');
    if (!img) throw new Error('expected the rendered image');
    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error('expected the alt text dialog');
    const setAlt = async (value: string) => {
      const input = document.querySelector<HTMLInputElement>('#alt-text-input');
      if (!input) throw new Error('expected the alt text input');
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      await act(async () => {
        setValue?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };

    await setAlt('Failed description');
    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });
    const save = dialog.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(dialog.isConnected).toBe(true);
    expect(img.alt).toBe('Failed description');

    // Leave the coalescing window so the retry is genuinely a second write.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 750));
    });

    await setAlt('Saved description');
    const retrySave = dialog.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(retrySave).not.toBeNull();
    await act(async () => {
      retrySave?.click();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(img.alt).toBe('Saved description');

    const dismiss = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss image controls"]'
    );
    expect(dismiss).not.toBeNull();
    await act(async () => {
      dismiss?.click();
    });
    expect(img.alt).toBe('Saved description');

    const undo = byText('Undo');
    expect(undo).toBeDefined();
    await act(async () => {
      undo?.click();
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true })
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    const lastCall = saveContent.mock.calls[saveContent.mock.calls.length - 1];
    const lastBody = lastCall?.[0]?.body as string | undefined;
    expect(lastBody).toBeDefined();
    expect(lastBody).toContain('alt="Old photo"');
    expect(lastBody).not.toContain('Failed description');
    expect(lastBody).not.toContain('Saved description');
  });

  it('keeps the image panel open when an uploaded replacement cannot be saved', async () => {
    await withPage({
      body: '<div data-copy-region="hero"><img src="https://example.com/old.jpg" alt="Old photo"></div>',
      rendered:
        '<div data-copy-region="hero"><img src="https://example.com/old.jpg" alt="Old photo"></div>',
    });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] img');
    expect(img).not.toBeNull();
    await act(async () => {
      img?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();

    uploadCRMMedia.mockResolvedValueOnce({
      success: true,
      data: { url: 'https://example.com/new.jpg' },
    });
    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    if (!fileInput) throw new Error('expected the image file input');
    const file = new File(['image'], 'replacement.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    await act(async () => {
      fileInput?.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(uploadCRMMedia).toHaveBeenCalledTimes(1);
    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(saveContent.mock.calls[0][0].body).toContain('https://example.com/new.jpg');
    expect(img?.src).toBe('https://example.com/new.jpg');
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Network unavailable');
  });

  it('undoes a retried upload to the last saved image, not the failed preview', async () => {
    const oldSrc = 'https://example.com/old.jpg';
    const failedSrc = 'https://example.com/failed.jpg';
    const retriedSrc = 'https://example.com/retried.jpg';
    const pageBody = `<p>Intro copy.<img src="${oldSrc}" alt="Old photo"></p><form><input></form><h2 class="cw cw--h2">Mission</h2>`;
    const pageRendered = `<p>Intro copy.<img src="${oldSrc}" alt="Old photo"></p><h2 class="cw cw--h2">Mission</h2>`;
    await withPage({ body: pageBody, rendered: pageRendered });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] p img');
    if (!img) throw new Error('expected the rendered image');
    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error('expected the image file input');
    const chooseFile = async (name: string) => {
      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: [new File(['image'], name, { type: 'image/png' })],
      });
      await act(async () => {
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      });
    };

    uploadCRMMedia.mockResolvedValueOnce({ success: true, data: { url: failedSrc } });
    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });
    await chooseFile('failed.png');
    expect(img.src).toBe(failedSrc);
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();

    // Leave the coalescing window so the retry is genuinely a second write.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 750));
    });

    uploadCRMMedia.mockResolvedValueOnce({ success: true, data: { url: retriedSrc } });
    await chooseFile('retried.png');
    expect(img.src).toBe(retriedSrc);
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();

    const undo = byText('Undo');
    expect(undo).toBeDefined();
    await act(async () => {
      undo?.click();
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true })
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    const lastCall = saveContent.mock.calls[saveContent.mock.calls.length - 1];
    const lastBody = lastCall?.[0]?.body as string | undefined;
    expect(lastBody).toBeDefined();
    expect(lastBody).toContain(oldSrc);
    expect(lastBody).not.toContain(failedSrc);
    expect(lastBody).not.toContain(retriedSrc);
  });

  it('saves an uploaded replacement inside a paragraph block', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/old.jpg';
    img.alt = 'Old photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();

    uploadCRMMedia.mockResolvedValueOnce({
      success: true,
      data: { url: 'https://example.com/new.jpg' },
    });

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    if (!fileInput) throw new Error('expected the image file input');
    const file = new File(['image'], 'replacement.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    const written = saveContent.mock.calls[0][0].body as string;
    expect(written).toContain('src="https://example.com/new.jpg"');
    expect(written).toContain('Intro copy.');
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();
  });

  it('restores the previous image when an upload has no savable block', async () => {
    await withPage({
      body: '<img src="https://example.com/old.jpg" alt="Old photo">',
      rendered: '<img src="https://example.com/old.jpg" alt="Old photo">',
    });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] img');
    expect(img).not.toBeNull();
    await act(async () => {
      img?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();

    uploadCRMMedia.mockResolvedValueOnce({
      success: true,
      data: { url: 'https://example.com/new.jpg' },
    });

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    if (!fileInput) throw new Error('expected the image file input');
    const file = new File(['image'], 'replacement.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(saveContent).not.toHaveBeenCalled();
    expect(img?.src).toBe('https://example.com/old.jpg');
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();
    expect(toast.error).toHaveBeenCalledWith('This image is not inside a savable block.');
  });

  it('restores the sidebar alt draft when alt text has no savable block', async () => {
    await withPage({
      body: '<img src="https://example.com/old.jpg" alt="Old photo">',
      rendered: '<img src="https://example.com/old.jpg" alt="Old photo">',
    });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] img');
    expect(img).not.toBeNull();
    await act(async () => {
      img?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const input = container.querySelector<HTMLInputElement>('#sidebar-image-alt-input');
    expect(input).not.toBeNull();
    if (!input) throw new Error('expected the sidebar alt input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'Revised photo');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const save = input.parentElement?.querySelector<HTMLButtonElement>('button');
    expect(save).toBeDefined();
    await act(async () => {
      save?.click();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(saveContent).not.toHaveBeenCalled();
    expect(img?.alt).toBe('Old photo');
    expect(input.value).toBe('Old photo');
    expect(toast.error).toHaveBeenCalledWith('Alt text cannot be saved for this block type');
  });

  it('saves a media-library replacement inside a paragraph block', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/old.jpg';
    img.alt = 'Old photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await openImageMediaLibrary();

    await act(async () => {
      await mediaLibrary.onSelectMedia?.({
        url: 'https://example.com/library.jpg',
        name: 'library.jpg',
        alt: 'Library photo',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    const written = saveContent.mock.calls[0][0].body as string;
    expect(written).toContain('src="https://example.com/library.jpg"');
    expect(written).toContain('alt="Library photo"');
    expect(written).toContain('Intro copy.');
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();
  });

  it('keeps the image panel open when a media-library replacement cannot be saved', async () => {
    const pageBody =
      '<p>Intro copy.<img src="https://example.com/old.jpg" alt="Old photo"></p><form><input></form><h2 class="cw cw--h2">Mission</h2>';
    const pageRendered =
      '<p>Intro copy.<img src="https://example.com/old.jpg" alt="Old photo"></p><h2 class="cw cw--h2">Mission</h2>';
    await withPage({ body: pageBody, rendered: pageRendered });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] p img');
    if (!img) throw new Error('expected the rendered image');

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await openImageMediaLibrary();
    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });

    await act(async () => {
      await mediaLibrary.onSelectMedia?.({
        url: 'https://example.com/library.jpg',
        name: 'library.jpg',
        alt: 'Library photo',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(img.src).toBe('https://example.com/library.jpg');
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Network unavailable');

    const dismiss = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss image controls"]'
    );
    expect(dismiss).not.toBeNull();
    await act(async () => {
      dismiss?.click();
    });

    expect(img.src).toBe('https://example.com/old.jpg');
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();
    expect(document.body.textContent).not.toContain('unsaved changes');

    const undo = byText('Undo');
    expect(undo).toBeDefined();
    await act(async () => {
      undo?.click();
    });
    expect(img.src).toBe('https://example.com/old.jpg');
  });

  it('undoes a retried media replacement to the last saved image', async () => {
    const oldSrc = 'https://example.com/old.jpg';
    const failedSrc = 'https://example.com/failed-library.jpg';
    const retriedSrc = 'https://example.com/retried-library.jpg';
    const pageBody = `<p>Intro copy.<img src="${oldSrc}" alt="Old photo"></p><form><input></form><h2 class="cw cw--h2">Mission</h2>`;
    const pageRendered = `<p>Intro copy.<img src="${oldSrc}" alt="Old photo"></p><h2 class="cw cw--h2">Mission</h2>`;
    await withPage({ body: pageBody, rendered: pageRendered });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] p img');
    if (!img) throw new Error('expected the rendered image');
    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await openImageMediaLibrary();
    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });

    await act(async () => {
      await mediaLibrary.onSelectMedia?.({
        url: failedSrc,
        name: 'failed-library.jpg',
        alt: 'Failed library photo',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(img.src).toBe(failedSrc);
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();

    // Leave the coalescing window so the retry is genuinely a second write.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 750));
    });

    await openImageMediaLibrary();
    await act(async () => {
      await mediaLibrary.onSelectMedia?.({
        url: retriedSrc,
        name: 'retried-library.jpg',
        alt: 'Retried library photo',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(img.src).toBe(retriedSrc);
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();

    const undo = byText('Undo');
    expect(undo).toBeDefined();
    await act(async () => {
      undo?.click();
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true })
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    const lastCall = saveContent.mock.calls[saveContent.mock.calls.length - 1];
    const lastBody = lastCall?.[0]?.body as string | undefined;
    expect(lastBody).toBeDefined();
    expect(lastBody).toContain(oldSrc);
    expect(lastBody).toContain('alt="Old photo"');
    expect(lastBody).not.toContain(failedSrc);
    expect(lastBody).not.toContain(retriedSrc);
    expect(lastBody).not.toContain('Failed library photo');
    expect(lastBody).not.toContain('Retried library photo');
  });

  it('rolls back a failed media-library replacement on Escape', async () => {
    const pageBody =
      '<p>Intro copy.<img src="https://example.com/old.jpg" alt="Old photo"></p><form><input></form><h2 class="cw cw--h2">Mission</h2>';
    const pageRendered =
      '<p>Intro copy.<img src="https://example.com/old.jpg" alt="Old photo"></p><h2 class="cw cw--h2">Mission</h2>';
    await withPage({ body: pageBody, rendered: pageRendered });

    const img = document.querySelector<HTMLImageElement>('[data-visual-edit-root] p img');
    if (!img) throw new Error('expected the rendered image');

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await openImageMediaLibrary();
    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });

    await act(async () => {
      await mediaLibrary.onSelectMedia?.({
        url: 'https://example.com/library.jpg',
        name: 'library.jpg',
        alt: 'Library photo',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(img.src).toBe('https://example.com/library.jpg');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(img.src).toBe('https://example.com/old.jpg');
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();
    expect(document.body.textContent).not.toContain('unsaved changes');

    const undo = byText('Undo');
    expect(undo).toBeDefined();
    await act(async () => {
      undo?.click();
    });
    expect(img.src).toBe('https://example.com/old.jpg');
  });

  it('restores the previous alt when cancelling after a failed save', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#alt-text-input');
    if (!input) throw new Error('expected the alt text input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'A revised description');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    saveContent.mockResolvedValueOnce({ success: false, error: 'Network unavailable' });
    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
    });
    expect(dialog?.isConnected).toBe(true);
    expect(img.alt).toBe('A revised description');

    const cancel = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Cancel'
    );
    expect(cancel).toBeDefined();
    await act(async () => {
      cancel?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(img.alt).toBe('Protest photo');
    expect(document.body.textContent).not.toContain('unsaved changes');

    const dismiss = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss image controls"]'
    );
    expect(dismiss).not.toBeNull();
    await act(async () => {
      dismiss?.click();
    });

    const undo = byText('Undo');
    expect(undo).toBeDefined();
    await act(async () => {
      undo?.click();
    });
    expect(img.alt).toBe('Protest photo');
  });

  it('keeps a saved alt when dismissing the image panel', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#alt-text-input');
    if (!input) throw new Error('expected the alt text input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'Saved description');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(img.alt).toBe('Saved description');

    const dismiss = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss image controls"]'
    );
    expect(dismiss).not.toBeNull();
    await act(async () => {
      dismiss?.click();
    });

    expect(img.alt).toBe('Saved description');
    expect(container.querySelector('[aria-label="Image asset controls"]')).toBeNull();
  });

  it('keeps the sidebar alt draft in step with the selected image and dialog saves', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const first = document.createElement('img');
    first.src = 'https://example.com/first.jpg';
    first.alt = 'First photo';
    const second = document.createElement('img');
    second.src = 'https://example.com/second.jpg';
    second.alt = 'Second photo';
    paragraph.append(first, second);

    const sidebarAlt = () => container.querySelector<HTMLInputElement>('#sidebar-image-alt-input');

    await act(async () => {
      first.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(sidebarAlt()?.value).toBe('First photo');

    await act(async () => {
      second.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(sidebarAlt()?.value).toBe('Second photo');

    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#alt-text-input');
    if (!input) throw new Error('expected the alt text input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'Second description');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(second.alt).toBe('Second description');
    expect(sidebarAlt()?.value).toBe('Second description');
  });

  it('keeps an image session when the header asks to switch regions', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();

    toast.info.mockClear();
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(VISUAL_EDIT_EVENTS.selectRegion, {
          detail: { regionId: 'about-mission' },
        })
      );
    });

    // A region switch replaces the block model underneath the selected image;
    // the image rail owns the provisional preview and alt draft until its own
    // Save or Cancel runs.
    expect(toast.info).toHaveBeenCalledWith(
      'Save or cancel the image edit before switching regions.'
    );
    expect(container.querySelector('[aria-label="Image asset controls"]')).not.toBeNull();
    expect(getContentBySlugForEdit).not.toHaveBeenCalledWith('copy-about-mission');
    expect(new URLSearchParams(window.location.search).get('region')).toBeNull();
  });

  it('keeps the image session through scroll and resize before a dialog save', async () => {
    await withPage();

    const paragraph = document.querySelector('[data-visual-edit-root] p');
    if (!paragraph) throw new Error('expected the rendered paragraph');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    img.alt = 'Protest photo';
    paragraph.appendChild(img);

    await act(async () => {
      img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const altBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit image alt text"]'
    );
    expect(altBtn).not.toBeNull();
    await act(async () => {
      altBtn?.click();
    });

    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const input = dialog?.querySelector<HTMLInputElement>('#alt-text-input');
    if (!input) throw new Error('expected the alt text input');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, 'Saved description');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const save = dialog?.querySelector<HTMLButtonElement>('button[data-confirm]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
    });
    expect(img.alt).toBe('Saved description');

    const dismiss = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss image controls"]'
    );
    expect(dismiss).not.toBeNull();
    await act(async () => {
      dismiss?.click();
    });

    expect(img.alt).toBe('Saved description');
  });
});
