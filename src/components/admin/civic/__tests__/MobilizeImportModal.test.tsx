// @vitest-environment jsdom-same-realm
'use client';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobilizeImportModal } from '@/components/admin/civic/MobilizeImportModal';
import * as mobilizeActions from '@/lib/actions/mobilize';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/actions/mobilize', () => ({
  importMobilizeEvent: vi.fn(),
}));

describe('MobilizeImportModal', () => {
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

  it('renders modal with url input and imports event on submit', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    vi.mocked(mobilizeActions.importMobilizeEvent).mockResolvedValue({
      success: true,
      data: {
        slug: 'mobilize-1074514',
        title: 'Carmichael Community Action',
        converted: false,
        warnings: [],
      },
    });

    await act(async () => {
      root.render(<MobilizeImportModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />);
    });

    expect(document.body.textContent).toContain('Import Mobilize Event');

    const input = document.body.querySelector<HTMLInputElement>('#mobilize-import-url');
    expect(input).not.toBeNull();

    await act(async () => {
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        setter?.call(input, 'https://www.mobilize.us/nokings/event/1074514/');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const submitBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Import Event')
    );
    expect(submitBtn).toBeDefined();

    await act(async () => {
      submitBtn?.click();
    });

    expect(mobilizeActions.importMobilizeEvent).toHaveBeenCalledWith(
      'https://www.mobilize.us/nokings/event/1074514/'
    );
    expect(onSuccess).toHaveBeenCalledWith({
      slug: 'mobilize-1074514',
      title: 'Carmichael Community Action',
    });
    expect(onClose).toHaveBeenCalled();
  });
});
