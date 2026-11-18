// @vitest-environment jsdom-same-realm
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/queries/civic', () => ({
  getCoalitionLinks: vi.fn(async () => []),
  getDataPoints: vi.fn(async () => ({})),
}));

vi.mock('@/components/ui/DataPoint', () => ({
  DataPoint: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/cms/CopyRegion', () => ({
  CopyRegion: ({ id, children }: { id: string; children?: ReactNode }) => (
    <div data-copy-region={id}>{children}</div>
  ),
}));

vi.mock('@/components/ui/InteractiveLinksDirectory', () => ({
  InteractiveLinksDirectory: () => <div data-testid="links-directory" />,
}));

import LinksPage, { metadata } from '@/app/links/page';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Links page Link Tree naming', () => {
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
    document.body.innerHTML = '';
  });

  it('uses Link Tree in the page metadata', () => {
    expect(String(metadata.title)).toBe('Link Tree & Civic Directory');
    expect(String(metadata.description)).toContain('Official chapter Link Tree');
  });

  it('renders Link Tree in the eyebrow and headline', async () => {
    const page = await LinksPage();

    await act(async () => {
      root.render(page);
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Link Tree & Civic Directory');
    expect(text).toContain('Link Tree & Coalition Directory');
    expect(text).not.toContain('Coalition & Action Directory');
  });
});
