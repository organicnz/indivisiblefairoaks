// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractiveNewslettersList } from '@/components/ui/InteractiveNewslettersList';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockDataPoints = {
  dataPoints: {} as Record<string, string>,
  get: (_key: string, fallback = '') => fallback,
  loading: false,
  refresh: vi.fn(),
};

vi.mock('@/hooks/useDataPoints', () => ({
  useDataPoints: () => mockDataPoints,
}));

vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: () => ({ isAdmin: false, loading: false, target: null }),
}));

vi.mock('@/lib/actions/civic', () => ({
  deleteCivicNewsletter: vi.fn(),
  saveCivicNewsletter: vi.fn(),
  getCivicNewslettersAdmin: vi.fn(),
}));

describe('InteractiveNewslettersList', () => {
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

  it('shows an honest empty archive rather than invented fallback bulletins', async () => {
    await act(async () => {
      root.render(<InteractiveNewslettersList initialNewsletters={[]} />);
    });

    expect(container.textContent).toContain('No chapter bulletins have been published yet');
    expect(container.textContent).not.toContain('Summer Action Bulletin');
    expect(container.textContent).not.toContain('Mid-Year Grassroots Review');
  });
});
