// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as civicActions from '@/lib/actions/civic';
import { CivicLinkManager } from '../CivicLinkManager';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/actions/civic', () => ({
  getCoalitionLinksAdmin: vi.fn(),
  deleteCoalitionLink: vi.fn(),
  saveCoalitionLink: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../CivicLinkEditorModal', () => ({
  CivicLinkEditorModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="mock-link-editor-modal">
        <button type="button" onClick={onClose}>
          Close Modal
        </button>
      </div>
    ) : null,
}));

describe('CivicLinkManager', () => {
  let container: HTMLDivElement;
  let root: Root;

  const sampleLinks: civicActions.CoalitionLinkRecord[] = [
    {
      slug: 'indivisible-national',
      name: 'Indivisible National',
      category: 'Coalition',
      url: 'https://indivisible.org',
      description: 'National grassroots movement organizing for democracy.',
      badge: null,
      sort_order: 10,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      slug: 'sac-county-elections',
      name: 'Sacramento County Elections',
      category: 'Voter Info',
      url: 'https://elections.saccounty.gov',
      description: 'Official voter registration and ballot drop-off locations.',
      badge: 'Official',
      sort_order: 20,
      created_at: '2026-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    vi.mocked(civicActions.getCoalitionLinksAdmin).mockResolvedValue({
      success: true,
      data: sampleLinks,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('loads and renders coalition links', async () => {
    await act(async () => {
      root.render(<CivicLinkManager />);
    });

    expect(container.textContent).toContain('Indivisible National');
    expect(container.textContent).toContain('Sacramento County Elections');
  });

  it('filters links by search query', async () => {
    await act(async () => {
      root.render(<CivicLinkManager />);
    });

    const searchInput = container.querySelector(
      'input[placeholder*="Search links"]'
    ) as HTMLInputElement;
    expect(searchInput).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(searchInput, 'Sacramento');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).not.toContain('Indivisible National');
    expect(container.textContent).toContain('Sacramento County Elections');
  });

  it('filters links by category dropdown', async () => {
    await act(async () => {
      root.render(<CivicLinkManager />);
    });

    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'value'
      )?.set;
      setter?.call(select, 'Coalition');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Indivisible National');
    expect(container.textContent).not.toContain('Sacramento County Elections');
  });

  it('opens link editor modal when New Coalition Link is clicked', async () => {
    await act(async () => {
      root.render(<CivicLinkManager />);
    });

    const addBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.toLowerCase().includes('new coalition link')
    );
    expect(addBtn).toBeTruthy();

    await act(async () => {
      addBtn?.click();
    });

    expect(container.querySelector('[data-testid="mock-link-editor-modal"]')).toBeTruthy();
  });
});
