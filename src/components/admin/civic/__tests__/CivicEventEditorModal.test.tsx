// @vitest-environment jsdom-same-realm
'use client';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CivicEventEditorModal } from '@/components/admin/civic/CivicEventEditorModal';
import * as mobilizeActions from '@/lib/actions/mobilize';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/actions/mobilize', () => ({
  getMobilizeEventPreview: vi.fn(),
}));

describe('CivicEventEditorModal', () => {
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
    vi.restoreAllMocks();
  });

  it('renders modal and auto-fills event details from Mobilize link', async () => {
    vi.mocked(mobilizeActions.getMobilizeEventPreview).mockResolvedValue({
      success: true,
      data: {
        title: 'Weekly Community Organizing Call',
        category: 'Meetings',
        date_label: 'Thursday, Nov 12, 2026',
        time_label: '6:00 PM – 7:30 PM',
        starts_at: '2026-11-13T02:00:00.000Z',
        ends_at: '2026-11-13T03:30:00.000Z',
        location_name: 'Online via Zoom',
        address: 'Fair Oaks, CA',
        description: 'Organizing for grassroots voter power.',
        rsvp_url: 'https://www.mobilize.us/indivisible/event/1011420/',
        external_url: 'https://www.mobilize.us/indivisible/event/1011420/',
        warnings: [],
      },
    });

    await act(async () => {
      root.render(
        <CivicEventEditorModal isOpen={true} onClose={vi.fn()} event={null} onSaved={vi.fn()} />
      );
    });

    expect(document.body.textContent).toContain('Create Civic Event');
    expect(document.body.textContent).toContain('Auto-fill from Mobilize Link');

    const mobilizeInput = document.body.querySelector<HTMLInputElement>('#modal-mobilize-url');
    expect(mobilizeInput).not.toBeNull();

    await act(async () => {
      if (mobilizeInput) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        setter?.call(mobilizeInput, 'https://www.mobilize.us/indivisible/event/1011420/');
        mobilizeInput.dispatchEvent(new Event('input', { bubbles: true }));
        mobilizeInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const autofillBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Auto-fill')
    );
    expect(autofillBtn).toBeDefined();

    await act(async () => {
      autofillBtn?.click();
    });

    expect(mobilizeActions.getMobilizeEventPreview).toHaveBeenCalledWith(
      'https://www.mobilize.us/indivisible/event/1011420/'
    );

    const titleInput = document.body.querySelector<HTMLInputElement>('#civic-event-title');
    expect(titleInput?.value).toBe('Weekly Community Organizing Call');
  });
});
