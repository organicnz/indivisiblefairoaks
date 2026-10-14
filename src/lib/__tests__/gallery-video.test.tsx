// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GalleryPage from '@/app/gallery/page';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/components/ui/VgpuCivicConstellation', () => ({
  VgpuCivicConstellation: () => <div data-testid="constellation" />,
}));

vi.mock('@/lib/queries/content-client', () => ({
  getGalleryPhotos: vi.fn().mockResolvedValue([]),
}));

describe('GalleryPage Video Archive (Issue #88)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders the No Kings 3 featured video archive spotlight', async () => {
    await act(async () => {
      root.render(<GalleryPage />);
    });

    expect(container.textContent).toContain('No Kings in America: The Movement in Motion');
    expect(container.textContent).toContain('No Kings 3 Nationwide Action');

    const iframe = container.querySelector<HTMLIFrameElement>('iframe[src*="aO2BEp8PCcY"]');
    expect(iframe).not.toBeNull();
    expect(iframe?.title).toContain('No Kings 3');
    expect(iframe?.allowFullscreen).toBe(true);
  });
});
