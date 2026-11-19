// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterPublicationField } from '@/components/admin/news/NewsletterPublicationField';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type InputProps = {
  onChange?: (event: { target: { value: string } }) => void;
};

function setInputValue(input: HTMLInputElement, value: string) {
  const propsKey = Object.keys(input).find((key) => key.startsWith('__reactProps$'));
  if (!propsKey) throw new Error('React props were not attached to the publication field');
  const props = (input as unknown as Record<string, InputProps>)[propsKey];
  if (!props?.onChange) throw new Error('publication field has no onChange handler');
  props.onChange({ target: { value } });
}

describe('NewsletterPublicationField', () => {
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

  it('renders the Pacific wall time for an immediately published bulletin', async () => {
    await act(async () => {
      root.render(
        <NewsletterPublicationField
          publishedAt="2026-11-10T18:30"
          scheduled={false}
          onPublishedAtChange={vi.fn()}
          onUseCurrentTime={vi.fn()}
        />
      );
    });

    const input = container.querySelector<HTMLInputElement>('#civic-news-published-at');
    if (!input) throw new Error('publication field did not render');

    expect(input.value).toBe('2026-11-10T18:30');
    expect(container.textContent).toContain('Publishes immediately');
    expect(container.textContent).toContain('Nov 10, 2026');
    expect(container.textContent).toContain('6:30 PM PST');
  });

  it('marks a scheduled bulletin as hidden from the public archive until its time', async () => {
    await act(async () => {
      root.render(
        <NewsletterPublicationField
          publishedAt="2026-11-10T18:30"
          scheduled={true}
          onPublishedAtChange={vi.fn()}
          onUseCurrentTime={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('Scheduled for');
    expect(container.textContent).toContain('stays out of the public archive until then.');
  });

  it('passes edits and the use-now action through to the parent', async () => {
    const onPublishedAtChange = vi.fn();
    const onUseCurrentTime = vi.fn();

    await act(async () => {
      root.render(
        <NewsletterPublicationField
          publishedAt="2026-11-10T18:30"
          scheduled={false}
          onPublishedAtChange={onPublishedAtChange}
          onUseCurrentTime={onUseCurrentTime}
        />
      );
    });

    const input = container.querySelector<HTMLInputElement>('#civic-news-published-at');
    const useNow = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      /use now/i.test(button.textContent ?? '')
    );
    if (!input || !useNow) throw new Error('publication controls did not render');

    await act(async () => {
      setInputValue(input, '2026-11-10T19:00');
    });
    expect(onPublishedAtChange).toHaveBeenCalledWith('2026-11-10T19:00');

    await act(async () => {
      useNow.click();
    });
    expect(onUseCurrentTime).toHaveBeenCalledTimes(1);
  });

  it('shows an honest fallback instead of a misleading time for invalid input', async () => {
    await act(async () => {
      root.render(
        <NewsletterPublicationField
          publishedAt="not-a-date"
          scheduled={false}
          onPublishedAtChange={vi.fn()}
          onUseCurrentTime={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('Choose a valid Pacific date and time');
  });
});
