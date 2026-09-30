import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentEditor } from '@/components/admin/content/ContentEditor';

const saveContent = vi.hoisted(() => vi.fn());
const getContentRevisions = vi.hoisted(() => vi.fn());
const restoreContentRevision = vi.hoisted(() => vi.fn());
const getContentForEdit = vi.hoisted(() => vi.fn());
const setContentStatus = vi.hoisted(() => vi.fn());
const deleteContent = vi.hoisted(() => vi.fn());
const duplicateContent = vi.hoisted(() => vi.fn());
const uploadContentImage = vi.hoisted(() => vi.fn());
const deleteContentImage = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@/lib/actions/content', () => ({
  saveContent,
  getContentRevisions,
  restoreContentRevision,
  getContentForEdit,
  setContentStatus,
  deleteContent,
  duplicateContent,
  uploadContentImage,
  deleteContentImage,
}));
vi.mock('sonner', () => ({ toast }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

/**
 * SEO meta fields are stored in content.metadata as meta_title /
 * meta_description and used by generateMetadata when present. The search
 * preview must show them when set, because that is what Google will use.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ContentEditor SEO meta fields', () => {
  let container: HTMLDivElement;
  let root: Root;

  const initial = {
    id: 7,
    slug: 'meeting-notes',
    title: 'Meeting notes',
    body: '<p>March agenda</p>',
    excerpt: '',
    type: 'post',
    status: 'publish' as const,
    featuredImage: '',
    publishedAt: '2026-09-20T18:00:00.000Z',
    metadata: null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    saveContent.mockResolvedValue({ success: true, data: { id: 7 } });
    getContentRevisions.mockResolvedValue({ success: true, data: { revisions: [] } });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const render = () => {
    act(() => {
      root.render(<ContentEditor initial={initial} siteHost="indivisiblefairoaks.org" />);
    });
  };

  const metaTitleInput = () =>
    container.querySelector('input[placeholder="Meeting notes"]') as HTMLInputElement;
  const metaDescTextArea = () => container.querySelector('textarea') as HTMLTextAreaElement;

  const setInputValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto =
      el instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    act(() => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('renders meta title and description inputs with character counts', () => {
    render();
    expect(metaTitleInput()).not.toBeNull();
    expect(metaDescTextArea()).not.toBeNull();
    expect(container.textContent).toContain('Meta title');
    expect(container.textContent).toContain('Meta description');
    expect(container.textContent).toContain('0/60');
    expect(container.textContent).toContain('0/155');
  });

  it('shows meta fields in the search preview when set', () => {
    render();
    act(() => {
      setInputValue(metaTitleInput(), 'Custom SEO Title');
      setInputValue(metaDescTextArea(), 'A custom meta description for search engines.');
    });
    expect(container.textContent).toContain('Custom SEO Title');
    expect(container.textContent).toContain('A custom meta description for search engines.');
  });

  it('saves meta fields into metadata on persist', async () => {
    render();
    act(() => {
      setInputValue(metaTitleInput(), 'SEO Title');
      setInputValue(metaDescTextArea(), 'SEO description');
    });

    await act(async () => {
      const saveBtn = [...container.querySelectorAll('button')].find(
        (b) => b.textContent === 'Save'
      ) as HTMLButtonElement;
      saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(saveContent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { meta_title: 'SEO Title', meta_description: 'SEO description' },
      })
    );
  });
});
