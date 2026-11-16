// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReportSightingButton } from '@/components/ice-alerts/ReportSightingDialog';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ReportSightingButton', () => {
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

  it('opens the private chapter intake and the national report choices', async () => {
    await act(async () => {
      root.render(<ReportSightingButton />);
    });

    const trigger = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Report a sighting')
    );
    expect(trigger).toBeDefined();

    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('accepts private, text-only reports');
    expect(dialog?.textContent).toContain('Nothing is published automatically');
    expect(dialog?.textContent).toContain('Text REPORT to 877-322-2299');
    expect(dialog?.textContent).toContain('Open the online report form');
    expect(dialog?.querySelector('form')).toBeNull();
    expect(dialog?.querySelector('a[href="/ice-alerts/report"]')).not.toBeNull();

    const textLink = dialog?.querySelector<HTMLAnchorElement>(
      'a[href="sms:8773222299?body=REPORT"]'
    );
    expect(textLink).not.toBeNull();

    const webLink = dialog?.querySelector<HTMLAnchorElement>('a[href="https://stopice.net/"]');
    expect(webLink).not.toBeNull();
    expect(webLink?.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
