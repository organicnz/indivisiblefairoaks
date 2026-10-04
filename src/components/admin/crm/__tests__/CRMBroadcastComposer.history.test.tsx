import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast as sonnerToast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRMBroadcastComposer } from '@/components/admin/crm/CRMBroadcastComposer';
import type { CRMBroadcast } from '@/lib/actions/crm';
import {
  getBroadcastProgress,
  getBroadcastRecipientCount,
  previewCRMBroadcast,
  saveCRMBroadcastDraft,
} from '@/lib/actions/crm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn(), info: vi.fn() },
}));
vi.mock('@/lib/actions/crm', () => ({
  deleteCRMBroadcastDraft: vi.fn(),
  getBroadcastProgress: vi.fn(),
  getBroadcastRecipientCount: vi.fn().mockResolvedValue({ count: 128, excludedCount: 0 }),
  previewCRMBroadcast: vi.fn(),
  saveCRMBroadcastDraft: vi.fn(),
  sendCRMBroadcast: vi.fn(),
  sendCRMBroadcastSelfTest: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const broadcast = (over: Partial<CRMBroadcast> = {}): CRMBroadcast =>
  ({
    id: crypto.randomUUID(),
    subject: 'Chapter meeting Tuesday',
    body: 'Come to the meeting.',
    target_tags: [],
    target_status: [],
    target_districts: [],
    recipient_count: 128,
    sent_count: 128,
    failed_count: 0,
    status: 'sent',
    sent_at: '2026-09-20T18:00:00.000Z',
    dispatched_at: '2026-09-20T18:00:00.000Z',
    created_by: null,
    created_at: '2026-09-20T18:00:00.000Z',
    test_only: false,
    test_recipient: null,
    ...over,
  }) as CRMBroadcast;

/**
 * A preview sits in the same history as a real campaign, and every column has to
 * say so.
 *
 * The audience column is the one that matters. A test row is saved with no
 * filters at all, so rendering it the way a campaign renders would read
 * "All Constituents" next to a green "sent" — telling a chapter organizer that a
 * blast had gone out when nobody had received anything.
 */
describe('broadcast history labelling', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.mocked(sonnerToast.error).mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (broadcasts: CRMBroadcast[]) => {
    act(() => {
      root.render(
        <CRMBroadcastComposer initialBroadcasts={broadcasts} segments={[]} existingTags={[]} />
      );
    });
  };

  const text = () => container.textContent ?? '';

  it('describes a real campaign normally', () => {
    render([broadcast()]);
    expect(text()).toContain('All Constituents');
    expect(text()).not.toContain('Nobody');
  });

  it('never claims a test reached the whole list', () => {
    render([
      broadcast({
        subject: '[TEST — not sent to the list] Chapter meeting Tuesday',
        recipient_count: 1,
        test_only: true,
        test_recipient: 'organizer@indivisiblefairoaks.org',
      }),
    ]);

    expect(text()).not.toContain('All Constituents');
    expect(text()).toContain('Nobody — sent only to you');
    expect(text()).toContain('1 (you)');
  });

  it('marks a test row and does not badge it a successful send', () => {
    render([broadcast({ test_only: true, recipient_count: 1 })]);
    // Scoped to the status cell: "Sent Date" is a column heading elsewhere on the
    // page, and a document-wide assertion would be testing the table, not the
    // badge. The green check beside "sent" is what reads as a successful blast.
    const statusCell = container.querySelectorAll('tbody tr td')[3];
    expect(statusCell?.textContent?.trim().toLowerCase()).toBe('test');
  });

  it('counts tests separately from campaigns in the heading note', () => {
    render([broadcast(), broadcast({ test_only: true, recipient_count: 1 })]);
    expect(text()).toContain('1 row is a test sent to yourself');
    expect(text()).toContain('Nobody else received it');
  });

  it('pluralises the note for several tests', () => {
    render([broadcast({ test_only: true }), broadcast({ test_only: true })]);
    expect(text()).toContain('2 rows are a test sent to yourself');
    expect(text()).toContain('Nobody else received them');
  });

  it('shows no note when there are no tests', () => {
    render([broadcast(), broadcast()]);
    expect(text()).not.toContain('test sent to yourself');
  });
});

/**
 * The composer's failure paths. Every one of these used to end in a silent
 * wrong answer: a count that failed read as "0 constituents", a preview that
 * failed read as "add a subject and message", a draft save that left the
 * button spinning forever, and a progress feed that froze on its last number.
 */
describe('broadcast composer failure states', () => {
  let container: HTMLDivElement;
  let root: Root;
  const toast = vi.mocked(sonnerToast);

  beforeEach(() => {
    // Each test below overrides the count, so `mockReset` restores the factory's
    // default first — a queued rejection would otherwise fire in the next test.
    vi.mocked(getBroadcastRecipientCount).mockReset();
    vi.mocked(getBroadcastRecipientCount).mockResolvedValue({ count: 128, excludedCount: 0 });
    vi.mocked(sonnerToast.error).mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (broadcasts: CRMBroadcast[] = []) => {
    act(() => {
      root.render(
        <CRMBroadcastComposer initialBroadcasts={broadcasts} segments={[]} existingTags={[]} />
      );
    });
  };

  const text = () => container.textContent ?? '';

  const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype,
      'value'
    )?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const fillComposer = () => {
    act(() => {
      setNativeValue(
        container.querySelector('#broadcast-subject') as HTMLInputElement,
        'Rally this Saturday'
      );
      setNativeValue(
        container.querySelector('#broadcast-body') as HTMLTextAreaElement,
        'Join us at the park.'
      );
    });
  };

  const clickButton = (label: string) => {
    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(label)
    );
    if (!button) throw new Error(`button not found: ${label}`);
    act(() => {
      button.click();
    });
  };

  const settle = async (ms: number) => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });
  };

  it('says the count is unavailable instead of showing zero when the count fails', async () => {
    vi.mocked(getBroadcastRecipientCount).mockRejectedValueOnce(new Error('db down'));

    render();
    await settle(400);

    expect(text()).toContain('Count unavailable');
    expect(text()).toContain('The audience could not be counted');
  });

  it('names how many matching contacts are opted out and excluded', async () => {
    vi.mocked(getBroadcastRecipientCount).mockResolvedValueOnce({
      count: 1200,
      excludedCount: 37,
    });

    render();
    await settle(400);

    expect(text()).toContain('37 matching contacts are opted out and excluded');
  });

  it('falls back to the generic exclusion copy when nobody is opted out', async () => {
    vi.mocked(getBroadcastRecipientCount).mockResolvedValueOnce({
      count: 1200,
      excludedCount: 0,
    });

    render();
    await settle(400);

    expect(text()).toContain('Opted-out contacts are excluded automatically');
  });

  it('says the preview could not be built instead of asking for a subject', async () => {
    vi.mocked(previewCRMBroadcast).mockRejectedValueOnce(new Error('preview down'));

    render();
    fillComposer();
    clickButton('Sensory Preview');
    await settle(100);

    expect(text()).toContain('The preview could not be built');
    expect(text()).not.toContain('Add a subject and message to see the preview.');
  });

  it('re-enables the save button and reports when a draft save throws', async () => {
    vi.mocked(saveCRMBroadcastDraft).mockRejectedValueOnce(new Error('network'));

    render();
    fillComposer();
    clickButton('Save draft');
    await settle(100);

    expect(toast.error).toHaveBeenCalledWith(
      'Draft could not be saved — the text is still in the composer'
    );
    expect(text()).toContain('Save draft');
    expect(text()).not.toContain('Saving…');
  });

  it('lists the draft it just saved under unsent drafts', async () => {
    vi.mocked(saveCRMBroadcastDraft).mockResolvedValueOnce({
      success: true,
      broadcastId: 'draft-1',
    });

    render();
    fillComposer();
    clickButton('Save draft');
    await settle(100);

    expect(text()).toContain('Rally this Saturday');
  });

  it('tells the author when the progress feed is lost instead of freezing', async () => {
    vi.mocked(getBroadcastProgress).mockRejectedValueOnce(new Error('db down'));

    render([broadcast({ status: 'sending', recipient_count: 500, sent_count: 120 })]);
    await settle(100);

    expect(toast.error).toHaveBeenCalledWith(
      'Lost the progress feed — reload to check the campaign'
    );
  });
});
