// @vitest-environment jsdom-same-realm
'use client';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CivicNewsletterEditorModal } from '@/components/admin/civic/CivicNewsletterEditorModal';
import { type CivicNewsletterRecord, saveCivicNewsletter } from '@/lib/actions/civic';
import { sendCivicNewsletterTest } from '@/lib/actions/civic-newsletter-broadcast';
import { NEWSLETTER_LONG_SENTENCE_WORDS } from '@/lib/news-text';
import { NEWSLETTER_LIMITS } from '@/lib/newsletters';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/actions/civic', () => ({
  saveCivicNewsletter: vi.fn(),
}));

vi.mock('@/lib/actions/civic-newsletter-broadcast', () => ({
  sendCivicNewsletterTest: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
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

const newsletter: CivicNewsletterRecord = {
  slug: 'summer-bulletin',
  title: 'Summer Bulletin',
  date_label: 'July 2026',
  description: 'Summer organizing update.',
  body: 'The full summer issue text.',
  pdf_url: 'https://example.org/summer-bulletin.pdf',
  archive_url: 'https://example.org/archive/summer-bulletin',
  topics: ['Election Defense'],
  sort_order: 10,
  published_at: '2026-07-01T00:00:00Z',
};

describe('CivicNewsletterEditorModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  const saveNewsletter = vi.mocked(saveCivicNewsletter);
  const sendTest = vi.mocked(sendCivicNewsletterTest);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    saveNewsletter.mockReset();
    saveNewsletter.mockResolvedValue({ success: true, data: newsletter });
    sendTest.mockReset();
    sendTest.mockResolvedValue({ success: true, testRecipient: 'admin@example.org' });
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
    expect(payload?.body).toBe('The full summer issue text.');
    expect(payload?.pdf_url).toBe('https://example.org/summer-bulletin.pdf');
    expect(payload?.archive_url).toBe('https://example.org/archive/summer-bulletin');
    expect(onSaved).toHaveBeenCalledWith(newsletter, 'summer-bulletin');
  });

  it('splits a pasted topic list and reports summary word count', async () => {
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

    const topicInput = document.querySelector<HTMLInputElement>('#civic-news-topic-input');
    const description = document.querySelector<HTMLTextAreaElement>('#civic-news-description');
    if (!topicInput || !description) throw new Error('editor fields did not render');

    expect(topicInput.maxLength).toBe(NEWSLETTER_LIMITS.topicInput);

    await act(async () => {
      setInputValue(topicInput, 'Election Defense, Choir Actions');
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
    expect(preview?.textContent).toContain('Choir Actions');
    expect(preview?.textContent).not.toContain('Election Defense, Choir Actions');

    await act(async () => {
      setInputValue(description, 'One two three four five');
    });
    expect(document.body.textContent).toContain('5 words');
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

  it('derives a canonical public identifier from an accented title', async () => {
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

    const title = document.querySelector<HTMLInputElement>('#civic-news-title');
    const slug = document.querySelector<HTMLInputElement>('#civic-news-slug');
    if (!title || !slug) throw new Error('basics fields did not render');

    await act(async () => {
      setInputValue(title, 'Café & Conversation');
    });

    expect(slug.value).toBe('cafe-conversation');
    expect(document.body.textContent).toContain('Stored identifier: cafe-conversation');
  });

  it('tidies pasted summary spacing and reports the live sentence count', async () => {
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

    const description = document.querySelector<HTMLTextAreaElement>('#civic-news-description');
    if (!description) throw new Error('summary field did not render');

    await act(async () => {
      setInputValue(description, '  One   two \r\n\r\n\r\n three  ');
    });
    expect(document.body.textContent).toContain('3 words');
    // Two paragraphs are two independent sentences/fragments even when the
    // author has not typed terminal punctuation yet.
    expect(document.body.textContent).toContain('2 sentences');

    const tidy = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      /tidy spacing/i.test(button.textContent ?? '')
    );
    if (!tidy) throw new Error('Tidy spacing button did not render');

    await act(async () => {
      tidy.click();
      await Promise.resolve();
    });

    expect(description.value).toBe('One two\n\nthree');
  });

  it('flags a summary sentence that is too long to scan', async () => {
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

    const description = document.querySelector<HTMLTextAreaElement>('#civic-news-description');
    if (!description) throw new Error('summary field did not render');

    const longSentence = `${'word '.repeat(NEWSLETTER_LONG_SENTENCE_WORDS + 1).trim()}.`;
    await act(async () => {
      setInputValue(description, longSentence);
    });

    expect(document.body.textContent).toContain('1 long sentence');
  });

  it('sends the current draft to the admin test path without saving it', async () => {
    await act(async () => {
      root.render(
        <CivicNewsletterEditorModal
          isOpen={true}
          onClose={vi.fn()}
          newsletter={newsletter}
          onSaved={vi.fn()}
        />
      );
    });

    const testButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      /send test/i.test(button.textContent ?? '')
    );
    if (!testButton) throw new Error('Send test button did not render');

    await act(async () => {
      testButton.click();
      await Promise.resolve();
    });

    expect(sendTest).toHaveBeenCalledTimes(1);
    expect(sendTest).toHaveBeenCalledWith({
      title: 'Summer Bulletin',
      dateLabel: 'July 2026',
      description: 'Summer organizing update.',
      body: 'The full summer issue text.',
      pdfUrl: 'https://example.org/summer-bulletin.pdf',
      archiveUrl: 'https://example.org/archive/summer-bulletin',
      slug: 'summer-bulletin',
    });
    expect(saveNewsletter).not.toHaveBeenCalled();
  });
});
