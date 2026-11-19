// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterTopicFilter } from '@/components/newsletters/NewsletterTopicFilter';
import { ALL_NEWSLETTER_TOPICS } from '@/lib/news-text';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('NewsletterTopicFilter', () => {
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

  it('includes visible counts in recognizable singular and plural labels', async () => {
    await act(async () => {
      root.render(
        <NewsletterTopicFilter
          topics={[ALL_NEWSLETTER_TOPICS, 'Housing', 'Choir']}
          activeTopic={ALL_NEWSLETTER_TOPICS}
          onTopicChange={vi.fn()}
          counts={{
            all: 7,
            byTopic: {
              housing: 3,
              choir: 1,
            },
          }}
        />
      );
    });

    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')];
    const chip = (label: string) => {
      const button = buttons.find((candidate) => candidate.textContent?.includes(label));
      if (!button) throw new Error(`${label} topic chip did not render`);
      return button;
    };

    const allTopics = chip(ALL_NEWSLETTER_TOPICS);
    const housing = chip('Housing');
    const choir = chip('Choir');

    expect(allTopics.getAttribute('aria-label')).toBe('All Topics 7 bulletins');
    expect(housing.getAttribute('aria-label')).toBe('Housing 3 bulletins');
    expect(choir.getAttribute('aria-label')).toBe('Choir 1 bulletin');

    // WCAG 2.5.3: every visible label must be contained in the accessible name.
    for (const chipButton of [allTopics, housing, choir]) {
      const visibleText = chipButton.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      expect(chipButton.getAttribute('aria-label')).toContain(visibleText);
    }

    const housingCount = housing.querySelector<HTMLSpanElement>('span.ml-1');
    expect(housingCount?.textContent).toBe('3');
    expect(housingCount?.hasAttribute('aria-hidden')).toBe(false);
  });
});
