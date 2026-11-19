// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterSortingField } from '@/components/admin/news/NewsletterSortingField';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type InputProps = {
  onChange?: (event: { target: { value: string } }) => void;
};

function setInputValue(input: HTMLInputElement, value: string) {
  const propsKey = Object.keys(input).find((key) => key.startsWith('__reactProps$'));
  if (!propsKey) throw new Error('React props were not attached to the sort field');
  const props = (input as unknown as Record<string, InputProps>)[propsKey];
  if (!props?.onChange) throw new Error('sort field has no onChange handler');
  props.onChange({ target: { value } });
}

describe('NewsletterSortingField', () => {
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

  it('passes archive order changes through and keeps the ordering copy with the field', async () => {
    const onChange = vi.fn();

    await act(async () => {
      root.render(<NewsletterSortingField sortOrder={10} onChange={onChange} />);
    });

    const section = container.querySelector('details');
    const input = container.querySelector<HTMLInputElement>('#civic-news-sort');
    const label = container.querySelector('label[for="civic-news-sort"]');
    if (!section || !input) throw new Error('sorting field did not render');

    expect(section.querySelector('summary')?.textContent).toContain('Archive ordering');
    expect(label?.textContent).toContain('Sort order');
    expect(container.textContent).toContain('Lower numbers appear first.');
    expect(input.value).toBe('10');

    await act(async () => {
      setInputValue(input, '-5');
    });
    expect(onChange).toHaveBeenLastCalledWith(-5);

    await act(async () => {
      setInputValue(input, '25');
    });
    expect(onChange).toHaveBeenLastCalledWith(25);
  });

  it('treats an emptied sort order as zero rather than producing NaN', async () => {
    const onChange = vi.fn();

    await act(async () => {
      root.render(<NewsletterSortingField sortOrder={10} onChange={onChange} />);
    });

    const input = container.querySelector<HTMLInputElement>('#civic-news-sort');
    if (!input) throw new Error('sorting field did not render');

    await act(async () => {
      setInputValue(input, '');
    });

    expect(onChange).toHaveBeenLastCalledWith(0);
  });
});
