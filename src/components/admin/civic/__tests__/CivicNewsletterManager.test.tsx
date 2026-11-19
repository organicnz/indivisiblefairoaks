// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CivicNewsletterManager } from '@/components/admin/civic/CivicNewsletterManager';
import type { CivicNewsletterRecord } from '@/lib/actions/civic';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/actions/civic', () => ({
  deleteCivicNewsletter: vi.fn(),
  getCivicNewslettersAdmin: vi.fn(),
  saveCivicNewsletter: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function setInputValue(input: HTMLInputElement, value: string) {
  const propsKey = Object.keys(input).find((key) => key.startsWith('__reactProps$'));
  if (!propsKey) throw new Error('React props were not attached to the input');
  const props = (
    input as unknown as Record<
      string,
      { onChange?: (event: { target: { value: string } }) => void }
    >
  )[propsKey];
  if (!props?.onChange) throw new Error('input has no onChange handler');
  props.onChange({ target: { value } });
}

const newsletters: CivicNewsletterRecord[] = [
  {
    slug: 'fall-bulletin',
    title: 'Fall Bulletin',
    date_label: 'October 2026',
    description: 'Election defense across Sacramento County.',
    topics: ['Elections'],
    sort_order: 10,
    published_at: '2026-10-01T00:00:00Z',
  },
  {
    slug: 'choir-night',
    title: 'Choir Night',
    date_label: 'September 2026',
    description: 'Music and organizing in the park.',
    topics: ['Choir Actions'],
    sort_order: 20,
    published_at: '2026-09-01T00:00:00Z',
  },
];

describe('CivicNewsletterManager', () => {
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

  it('filters the admin list with the same query contract and reports the result count', async () => {
    await act(async () => {
      root.render(<CivicNewsletterManager initialNewsletters={newsletters} />);
    });

    expect(container.textContent).toContain('Fall Bulletin');
    expect(container.textContent).toContain('Choir Night');

    const search = container.querySelector<HTMLInputElement>(
      '[data-testid="admin-newsletter-search"]'
    );
    if (!search) throw new Error('admin newsletter search did not render');

    await act(async () => {
      setInputValue(search, 'choir');
    });

    expect(container.textContent).toContain('Choir Night');
    expect(container.textContent).not.toContain('Fall Bulletin');
    expect(container.textContent).toContain('Showing 1 of 2 bulletins matching');
    expect(container.textContent).toContain('“choir”');

    const clear = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Clear newsletter search"]'
    );
    expect(clear).not.toBeNull();
    await act(async () => {
      clear?.click();
    });

    expect(container.textContent).toContain('Fall Bulletin');
    expect(container.textContent).toContain('Choir Night');
  });

  it('offers an explicit clear action when the admin search has no matches', async () => {
    await act(async () => {
      root.render(<CivicNewsletterManager initialNewsletters={newsletters} />);
    });

    const search = container.querySelector<HTMLInputElement>(
      '[data-testid="admin-newsletter-search"]'
    );
    if (!search) throw new Error('admin newsletter search did not render');

    await act(async () => {
      setInputValue(search, 'not-a-real-bulletin');
    });

    expect(container.textContent).toContain('No newsletters found');
    const clear = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      /clear search/i.test(button.textContent ?? '')
    );
    expect(clear).not.toBeUndefined();
    await act(async () => {
      clear?.click();
    });

    expect(container.textContent).toContain('Fall Bulletin');
    expect(container.textContent).toContain('Choir Night');
  });

  it('filters the admin list by topic and returns to the complete archive', async () => {
    await act(async () => {
      root.render(<CivicNewsletterManager initialNewsletters={newsletters} />);
    });

    const topic = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.trim().startsWith('Choir Actions')
    );
    expect(topic).not.toBeUndefined();

    await act(async () => {
      topic?.click();
    });

    expect(container.textContent).toContain('Choir Night');
    expect(container.textContent).not.toContain('Fall Bulletin');
    expect(container.textContent).toContain('Showing 1 of 2 bulletins in Choir Actions');

    const allTopics = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.trim().startsWith('All Topics')
    );
    expect(allTopics).not.toBeUndefined();

    await act(async () => {
      allTopics?.click();
    });

    expect(container.textContent).toContain('Fall Bulletin');
    expect(container.textContent).toContain('Choir Night');
  });
});
