// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GalleryPage from '@/app/gallery/page';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/components/ui/VgpuCosmicRayCascade', () => ({
  VgpuCosmicRayCascade: () => <div data-testid="cosmic-ray-cascade" />,
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

    // The archive now uses the shared click-to-load player. Assert the local
    // poster surface first, then the player after intent — a raw iframe on
    // every page view is the regression this test now guards against.
    const playButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label*="Play film"][aria-label*="No Kings 3"]'
    );
    expect(playButton).not.toBeNull();
    expect(container.querySelector('iframe')).toBeNull();

    await act(async () => {
      playButton?.click();
    });

    const iframe = container.querySelector<HTMLIFrameElement>('iframe[src*="aO2BEp8PCcY"]');
    expect(iframe).not.toBeNull();
    expect(iframe?.title).toContain('No Kings 3');
    expect(iframe?.allowFullscreen).toBe(true);
  });
});
