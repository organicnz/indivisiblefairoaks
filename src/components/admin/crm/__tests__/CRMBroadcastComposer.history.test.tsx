import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRMBroadcastComposer } from '@/components/admin/crm/CRMBroadcastComposer';
import type { CRMBroadcast } from '@/lib/actions/crm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/actions/crm', () => ({
  deleteCRMBroadcastDraft: vi.fn(),
  getBroadcastProgress: vi.fn(),
  getBroadcastRecipientCount: vi.fn(),
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
