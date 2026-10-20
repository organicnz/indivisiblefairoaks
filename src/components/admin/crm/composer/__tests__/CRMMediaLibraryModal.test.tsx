// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRMMediaLibraryModal } from '@/components/admin/crm/composer/CRMMediaLibraryModal';
import type { MediaItem } from '@/types/unified';

const mockGetCRMMediaFiles = vi.hoisted(() => vi.fn());
const mockUploadCRMMedia = vi.hoisted(() => vi.fn());
const mockDeleteCRMMedia = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/actions/crm', () => ({
  getCRMMediaFiles: mockGetCRMMediaFiles,
  uploadCRMMedia: mockUploadCRMMedia,
  deleteCRMMedia: mockDeleteCRMMedia,
}));

vi.mock('sonner', () => ({
  toast: mockToast,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SAMPLE_MEDIA: MediaItem[] = [
  {
    id: 'm1',
    name: 'fair-oaks-rally.jpg',
    path: 'crm/fair-oaks-rally.jpg',
    url: 'https://example.supabase.co/storage/v1/object/public/media/crm/fair-oaks-rally.jpg',
    size: 204800,
    mimeType: 'image/jpeg',
    createdAt: '2026-10-01T12:00:00Z',
    folder: 'crm',
    width: 1200,
    height: 800,
  },
  {
    id: 'm2',
    name: 'democracy-banner.webp',
    path: 'content/democracy-banner.webp',
    url: 'https://example.supabase.co/storage/v1/object/public/media/content/democracy-banner.webp',
    size: 102400,
    mimeType: 'image/webp',
    createdAt: '2026-10-02T12:00:00Z',
    folder: 'content',
    width: 800,
    height: 600,
  },
];

describe('CRMMediaLibraryModal component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();

    mockGetCRMMediaFiles.mockResolvedValue({
      items: SAMPLE_MEDIA,
      folders: ['crm', 'content', 'products'],
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  it('loads and renders assets from Supabase S3 storage', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <CRMMediaLibraryModal
          isOpen={true}
          onClose={onClose}
          onSelectMedia={onSelect}
          initialFolder="crm"
        />
      );
    });

    expect(mockGetCRMMediaFiles).toHaveBeenCalledWith({ folder: 'crm', search: '' });
    expect(document.body.textContent).toContain('fair-oaks-rally.jpg');
    expect(document.body.textContent).toContain('democracy-banner.webp');
  });

  it('selects media when Select button is clicked', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <CRMMediaLibraryModal
          isOpen={true}
          onClose={onClose}
          onSelectMedia={onSelect}
          initialFolder="crm"
        />
      );
    });

    const selectButtons = Array.from(document.body.querySelectorAll('button')).filter(
      (btn) => btn.textContent?.trim() === 'Select'
    );
    expect(selectButtons.length).toBeGreaterThan(0);

    await act(async () => {
      selectButtons[0]?.click();
    });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        url: SAMPLE_MEDIA[0].url,
        name: SAMPLE_MEDIA[0].name,
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('fetches folder contents when clicking folder buttons', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <CRMMediaLibraryModal
          isOpen={true}
          onClose={onClose}
          onSelectMedia={onSelect}
          initialFolder="crm"
        />
      );
    });

    const contentFolderBtn = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Site & Content')
    );
    expect(contentFolderBtn).toBeDefined();

    await act(async () => {
      contentFolderBtn?.click();
    });

    expect(mockGetCRMMediaFiles).toHaveBeenCalledWith({ folder: 'content', search: '' });
  });

  it('uploads media targeting the active folder and auto-selects result', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    mockUploadCRMMedia.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'uploaded-1',
        name: 'new-rally.png',
        path: 'content/new-rally.png',
        url: 'https://example.supabase.co/storage/v1/object/public/media/content/new-rally.png',
        size: 51200,
        mimeType: 'image/png',
        createdAt: '2026-10-12T12:00:00Z',
        folder: 'content',
        width: 1000,
        height: 500,
      },
    });

    await act(async () => {
      root.render(
        <CRMMediaLibraryModal
          isOpen={true}
          onClose={onClose}
          onSelectMedia={onSelect}
          initialFolder="content"
        />
      );
    });

    const fileInput = document.body.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();

    const file = new File(['fake-png-content'], 'new-rally.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    await act(async () => {
      fileInput?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(mockUploadCRMMedia).toHaveBeenCalledTimes(1);
    const passedFormData = mockUploadCRMMedia.mock.calls[0][0] as FormData;
    expect(passedFormData.get('folder')).toBe('content');
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.supabase.co/storage/v1/object/public/media/content/new-rally.png',
        name: 'new-rally.png',
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('deletes an unreferenced asset after confirmation', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    mockDeleteCRMMedia.mockResolvedValueOnce({ success: true });

    await act(async () => {
      root.render(
        <CRMMediaLibraryModal
          isOpen={true}
          onClose={onClose}
          onSelectMedia={onSelect}
          initialFolder="crm"
        />
      );
    });

    // Delete buttons should be present for crm and content
    const deleteButtons = Array.from(document.body.querySelectorAll('button')).filter(
      (btn) => btn.getAttribute('aria-label') === 'Delete Asset'
    );
    expect(deleteButtons.length).toBe(2);

    // Click Delete Asset to show confirmation
    await act(async () => {
      deleteButtons[0]?.click();
    });

    // Confirmation button should appear
    const confirmButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) =>
        btn.textContent?.trim() === 'Delete Asset' &&
        btn.getAttribute('aria-label') !== 'Delete Asset'
    );
    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton?.click();
    });

    expect(mockDeleteCRMMedia).toHaveBeenCalledWith(SAMPLE_MEDIA[0].path);
  });
});
