// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  InteractiveLinksDirectory,
  type LinkItem,
} from '@/components/ui/InteractiveLinksDirectory';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SAMPLE_LINKS: LinkItem[] = [
  {
    slug: 'sister-district',
    name: 'Sister District Project',
    category: 'Electoral Allies',
    url: 'https://sisterdistrict.com',
    description: 'Electing Democrats to state legislatures.',
    badge: 'State Races',
    sort_order: 10,
  },
  {
    slug: 'sac-food-bank',
    name: 'Sacramento Food Bank',
    category: 'Mutual Aid',
    url: 'https://sacramentofoodbank.org',
    description: 'Local food distributions in Sacramento County.',
    badge: 'Community',
    sort_order: 20,
  },
];

describe('InteractiveLinksDirectory', () => {
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

  it('renders provided coalition links and badges', async () => {
    await act(async () => {
      root.render(<InteractiveLinksDirectory initialLinks={SAMPLE_LINKS} />);
    });

    expect(container.textContent).toContain('Sister District Project');
    expect(container.textContent).toContain('Sacramento Food Bank');
    expect(container.textContent).toContain('State Races');
    expect(container.textContent).toContain('Community');
  });

  it('filters links by category', async () => {
    await act(async () => {
      root.render(<InteractiveLinksDirectory initialLinks={SAMPLE_LINKS} />);
    });

    const categoryButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const mutualAidBtn = categoryButtons.find((b) => b.textContent?.includes('Mutual Aid'));
    expect(mutualAidBtn).toBeDefined();

    await act(async () => {
      mutualAidBtn?.click();
    });

    expect(container.textContent).toContain('Sacramento Food Bank');
    expect(container.textContent).not.toContain('Sister District Project');
  });

  it('searches links by text query', async () => {
    await act(async () => {
      root.render(<InteractiveLinksDirectory initialLinks={SAMPLE_LINKS} />);
    });

    const searchInput = container.querySelector<HTMLInputElement>('input[type="text"]');
    expect(searchInput).not.toBeNull();

    await act(async () => {
      if (searchInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(searchInput, 'District');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(container.textContent).toContain('Sister District Project');
  });
});
