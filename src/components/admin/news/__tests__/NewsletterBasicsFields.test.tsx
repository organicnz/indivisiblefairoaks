// @vitest-environment jsdom-same-realm
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterBasicsFields } from '@/components/admin/news/NewsletterBasicsFields';
import { NEWSLETTER_LIMITS } from '@/lib/newsletters';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type InputProps = {
  onChange?: (event: { target: { value: string } }) => void;
  onBlur?: () => void;
};

function reactProps(element: HTMLElement): InputProps {
  const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
  if (!propsKey) throw new Error('React props were not attached to the field');
  return (element as unknown as Record<string, InputProps>)[propsKey];
}

function setInputValue(input: HTMLInputElement, value: string) {
  const onChange = reactProps(input).onChange;
  if (!onChange) throw new Error('field has no onChange handler');
  onChange({ target: { value } });
}

function blurInput(input: HTMLInputElement) {
  const onBlur = reactProps(input).onBlur;
  if (!onBlur) throw new Error('field has no onBlur handler');
  onBlur();
}

describe('NewsletterBasicsFields', () => {
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

  it('generates a canonical public identifier from the current title', async () => {
    const titleRef = createRef<HTMLInputElement>();
    const onSlugChange = vi.fn();

    await act(async () => {
      root.render(
        <NewsletterBasicsFields
          title="Café & Conversation"
          slug=""
          dateLabel=""
          titleInputRef={titleRef}
          onTitleChange={vi.fn()}
          onSlugChange={onSlugChange}
          onDateLabelChange={vi.fn()}
        />
      );
    });

    const generate = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Generate the public identifier from the title"]'
    );
    if (!generate) throw new Error('slug generation button did not render');

    expect(titleRef.current).not.toBeNull();
    await act(async () => {
      generate.click();
    });

    expect(onSlugChange).toHaveBeenCalledWith('cafe-conversation');
  });

  it('normalizes a manually typed identifier when the field loses focus', async () => {
    const onSlugChange = vi.fn();

    await act(async () => {
      root.render(
        <NewsletterBasicsFields
          title=""
          slug="  Café  Night  "
          dateLabel=""
          titleInputRef={createRef<HTMLInputElement>()}
          onTitleChange={vi.fn()}
          onSlugChange={onSlugChange}
          onDateLabelChange={vi.fn()}
        />
      );
    });

    const slug = container.querySelector<HTMLInputElement>('#civic-news-slug');
    if (!slug) throw new Error('slug field did not render');

    await act(async () => {
      blurInput(slug);
    });

    expect(onSlugChange).toHaveBeenCalledWith('cafe-night');
  });

  it('shows the stored identifier and applies the shared field limits', async () => {
    const onDateLabelChange = vi.fn();

    await act(async () => {
      root.render(
        <NewsletterBasicsFields
          title="Summer Action Bulletin"
          slug=""
          dateLabel="July 2026"
          titleInputRef={createRef<HTMLInputElement>()}
          onTitleChange={vi.fn()}
          onSlugChange={vi.fn()}
          onDateLabelChange={onDateLabelChange}
        />
      );
    });

    const title = container.querySelector<HTMLInputElement>('#civic-news-title');
    const slug = container.querySelector<HTMLInputElement>('#civic-news-slug');
    const dateLabel = container.querySelector<HTMLInputElement>('#civic-news-date-label');
    if (!title || !slug || !dateLabel) throw new Error('basics fields did not render');

    expect(container.textContent).toMatch(/Stored identifier:\s*summer-action-bulletin/);
    expect(title.maxLength).toBe(NEWSLETTER_LIMITS.title);
    expect(slug.maxLength).toBe(NEWSLETTER_LIMITS.slug);
    expect(dateLabel.maxLength).toBe(NEWSLETTER_LIMITS.dateLabel);
    expect(slug.getAttribute('aria-describedby')).toBe('civic-news-slug-help');

    await act(async () => {
      setInputValue(dateLabel, 'August 2026');
    });
    expect(onDateLabelChange).toHaveBeenCalledWith('August 2026');
  });
});
