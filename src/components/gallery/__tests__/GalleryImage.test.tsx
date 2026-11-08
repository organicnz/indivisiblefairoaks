// @vitest-environment jsdom-same-realm
import { act, createElement, type ReactEventHandler } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GalleryImage } from '@/components/gallery/GalleryImage';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/image', () => ({
  default: (props: {
    src?: string;
    alt?: string;
    className?: string;
    onError?: ReactEventHandler<HTMLImageElement>;
  }) => {
    const { src, alt, className, onError } = props;
    return createElement('img', { src, alt, className, onError });
  },
}));

describe('GalleryImage', () => {
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

  it('replaces a failed photo with an accessible fallback', async () => {
    await act(async () => {
      root.render(
        <GalleryImage
          src="https://example.com/missing.jpg"
          alt="Brake light clinic"
          sizes="100vw"
        />
      );
    });

    const image = container.querySelector('img');
    expect(image).not.toBeNull();

    await act(async () => {
      image?.dispatchEvent(new Event('error', { bubbles: true }));
    });

    const fallback = container.querySelector('[data-testid="gallery-image-fallback"]');
    expect(fallback).not.toBeNull();
    expect(fallback?.getAttribute('role')).toBe('img');
    expect(fallback?.getAttribute('aria-label')).toBe('Brake light clinic — Photo unavailable');
    expect(container.textContent).toContain('Photo unavailable');
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the fallback immediately when the URL is empty', async () => {
    await act(async () => {
      root.render(<GalleryImage src="" alt="Missing photo" />);
    });

    expect(container.querySelector('[data-testid="gallery-image-fallback"]')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
