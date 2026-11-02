// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as mobilizeActions from '@/lib/actions/mobilize';
import { MobilizeSyncPanel } from '../MobilizeSyncPanel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/actions/mobilize', () => ({
  getMobilizeSettings: vi.fn(),
  getMobilizeSyncRuns: vi.fn(),
  previewMobilizeSource: vi.fn(),
  importMobilizeEvent: vi.fn(),
  saveMobilizeSettings: vi.fn(),
  runMobilizeSyncNow: vi.fn(),
  setMobilizeRule: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

describe('MobilizeSyncPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockSettings: mobilizeActions.MobilizeSettingsRecord = {
    enabled: true,
    org_id: 93,
    zipcode: '95608',
    max_dist: 25,
    locality_allowlist: ['Fair Oaks', 'Carmichael'],
    include_virtual: false,
    high_priority_only: false,
    auto_publish: true,
  };

  const mockPreview: mobilizeActions.MobilizePreview = {
    settings: mockSettings,
    filteredOut: 0,
    inPersonTogether: 2,
    virtualTogether: 0,
    rows: [
      {
        id: 967302,
        title: 'Monthly Gathering',
        place: 'Carmichael, CA',
        when: 'Tuesday, Nov 10 · 6:30 PM',
        eventType: 'MEETING',
        isVirtual: false,
        highPriority: false,
        browserUrl: 'https://www.mobilize.us/indivisible/event/967302/',
        include: true,
        reason: 'locality',
        alreadyImported: false,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.mocked(mobilizeActions.getMobilizeSettings).mockResolvedValue({
      success: true,
      data: mockSettings,
    });
    vi.mocked(mobilizeActions.getMobilizeSyncRuns).mockResolvedValue({
      success: true,
      data: [],
    });
    vi.mocked(mobilizeActions.previewMobilizeSource).mockResolvedValue({
      success: true,
      data: mockPreview,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders settings and direct single event import card (issue #153)', async () => {
    await act(async () => {
      root.render(<MobilizeSyncPanel />);
    });

    expect(container.textContent).toContain('Scope');
    expect(container.textContent).toContain(
      'Directly import any single Mobilize event link (issue #153)'
    );
    expect(container.textContent).toContain('What would be imported');
    expect(container.textContent).toContain('Monthly Gathering');

    const input = container.querySelector<HTMLInputElement>(
      'input[placeholder="https://www.mobilize.us/nokings/event/1074514/?followup_modal_context=..."]'
    );
    expect(input).not.toBeNull();
  });

  it('directly imports an event when URL is provided and button is clicked', async () => {
    vi.mocked(mobilizeActions.importMobilizeEvent).mockResolvedValue({
      success: true,
      data: {
        slug: 'nokings-event-1074514',
        title: 'No Kings Protest',
        converted: false,
        warnings: [],
      },
    });

    await act(async () => {
      root.render(<MobilizeSyncPanel />);
    });

    const input = container.querySelector<HTMLInputElement>(
      'input[placeholder="https://www.mobilize.us/nokings/event/1074514/?followup_modal_context=..."]'
    );
    expect(input).not.toBeNull();

    await act(async () => {
      if (input) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )?.set;
        valueSetter?.call(
          input,
          'https://www.mobilize.us/nokings/event/1074514/?followup_modal_context=organization_newsletter_custom_recommendations'
        );
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const importBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Import Event')
    );
    expect(importBtn).toBeDefined();

    await act(async () => {
      importBtn?.click();
    });

    expect(mobilizeActions.importMobilizeEvent).toHaveBeenCalledWith(
      'https://www.mobilize.us/nokings/event/1074514/?followup_modal_context=organization_newsletter_custom_recommendations'
    );
    expect(toast.success).toHaveBeenCalledWith('Added “No Kings Protest” to the calendar');
  });
});
