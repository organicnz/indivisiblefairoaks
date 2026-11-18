// @vitest-environment jsdom-same-realm
'use client';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CivicNewsletterEditorModal } from '@/components/admin/civic/CivicNewsletterEditorModal';
import { type CivicNewsletterRecord, saveCivicNewsletter } from '@/lib/actions/civic';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/actions/civic', () => ({
  saveCivicNewsletter: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const newsletter: CivicNewsletterRecord = {
  slug: 'summer-bulletin',
  title: 'Summer Bulletin',
  date_label: 'July 2026',
  description: 'Summer organizing update.',
  topics: ['Election Defense'],
  sort_order: 10,
  published_at: '2026-07-01T00:00:00Z',
};

describe('CivicNewsletterEditorModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  const saveNewsletter = vi.mocked(saveCivicNewsletter);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    saveNewsletter.mockReset();
    saveNewsletter.mockResolvedValue({ success: true, data: newsletter });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the publication time in Pacific and saves the same instant through one action', async () => {
    const onSaved = vi.fn();
    await act(async () => {
      root.render(
        <CivicNewsletterEditorModal
          isOpen={true}
          onClose={vi.fn()}
          newsletter={newsletter}
          onSaved={onSaved}
        />
      );
    });

    const publishedAt = document.querySelector<HTMLInputElement>('#civic-news-published-at');
    expect(publishedAt?.value).toBe('2026-06-30T17:00');

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    await act(async () => {
      form?.requestSubmit();
      await Promise.resolve();
    });

    expect(saveNewsletter).toHaveBeenCalledTimes(1);
    const payload = saveNewsletter.mock.calls[0]?.[0];
    expect(payload?.published_at).toBe('2026-07-01T00:00:00.000Z');
    expect(payload?.original_slug).toBe('summer-bulletin');
    expect(onSaved).toHaveBeenCalledWith(newsletter, 'summer-bulletin');
  });

  it('adds a topic to the draft and shows it in the public preview', async () => {
    await act(async () => {
      root.render(
        <CivicNewsletterEditorModal
          isOpen={true}
          onClose={vi.fn()}
          newsletter={null}
          onSaved={vi.fn()}
        />
      );
    });

    const input = document.querySelector<HTMLInputElement>('#civic-news-topic-input');
    if (!input) throw new Error('topic input did not render');

    /*
     * jsdom does not reproduce React's value tracker for a controlled input,
     * so dispatch through the component's own onChange prop. This is the same
     * state update a real keystroke produces, and it keeps the regression test
     * on the add behavior rather than on a DOM emulation detail.
     */
    const propsKey = Object.keys(input).find((key) => key.startsWith('__reactProps$'));
    if (!propsKey) throw new Error('React props were not attached to the topic input');
    const props = (
      input as unknown as Record<
        string,
        { onChange?: (event: { target: { value: string } }) => void }
      >
    )[propsKey];
    if (!props?.onChange) throw new Error('topic input has no onChange handler');

    await act(async () => {
      props.onChange?.({ target: { value: 'Election Defense' } });
    });

    const addButton = [...document.querySelectorAll('button')].find((button) =>
      /add tag/i.test(button.textContent ?? '')
    );
    if (!addButton) throw new Error('Add tag button did not render');

    await act(async () => {
      addButton.click();
      await Promise.resolve();
    });

    const preview = document.querySelector('[aria-label="Public archive preview"]');
    expect(preview?.textContent).toContain('Election Defense');

    // A second add of the same tag must not create a duplicate chip.
    await act(async () => {
      props.onChange?.({ target: { value: 'Election Defense' } });
    });
    await act(async () => {
      addButton.click();
      await Promise.resolve();
    });
    expect((preview?.textContent?.match(/Election Defense/g) ?? []).length).toBe(1);
  });
});
