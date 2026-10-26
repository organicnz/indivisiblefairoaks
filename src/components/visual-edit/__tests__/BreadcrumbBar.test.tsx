// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BreadcrumbBar } from '@/components/visual-edit/BreadcrumbBar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BreadcrumbBar', () => {
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
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders nothing when not visible', async () => {
    await act(async () => {
      root.render(<BreadcrumbBar visible={false} pageTitle="Gallery" pathname="/gallery" />);
    });

    expect(container.textContent).toBe('');
  });

  it('renders page, region, section and tag crumbs when visible', async () => {
    const onFocusSection = vi.fn();
    const onOpenDataPoints = vi.fn();

    await act(async () => {
      root.render(
        <BreadcrumbBar
          visible={true}
          pageTitle="Community Showcase"
          pathname="/gallery"
          activeRegionLabel="Hero Banner"
          activeSectionLabel="Welcome Heading"
          activeTag="h1"
          activeDataPointKey="gallery.hero.title"
          onFocusSection={onFocusSection}
          onOpenDataPoints={onOpenDataPoints}
        />
      );
    });

    expect(container.textContent).toContain('Community Showcase');
    expect(container.textContent).toContain('Hero Banner');
    expect(container.textContent).toContain('Welcome Heading');
    expect(container.textContent).toContain('<h1>');
    expect(container.textContent).toContain('gallery.hero.title');

    // Click section button
    const sectionBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Welcome Heading')
    );
    expect(sectionBtn).toBeDefined();

    await act(async () => {
      sectionBtn?.click();
    });

    expect(onFocusSection).toHaveBeenCalled();

    // Click data point button
    const dpBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('gallery.hero.title')
    );
    expect(dpBtn).toBeDefined();

    await act(async () => {
      dpBtn?.click();
    });

    expect(onOpenDataPoints).toHaveBeenCalled();
  });
});
