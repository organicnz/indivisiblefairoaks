// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RapidAlertChannels } from '@/components/ice-alerts/RapidAlertChannels';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('RapidAlertChannels', () => {
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

  it('links to the national text and Signal channels without claiming to operate them', async () => {
    await act(async () => {
      root.render(<RapidAlertChannels />);
    });

    const textLink = container.querySelector<HTMLAnchorElement>(
      'a[href="sms:8773222299?body=JOIN"]'
    );
    expect(textLink).not.toBeNull();
    expect(textLink?.textContent).toContain('Text JOIN');
    expect(container.textContent).toContain('Text JOIN');
    expect(container.textContent).toContain('Text REPORT');
    expect(container.textContent).toContain('877-322-2299');

    const reportLink = container.querySelector<HTMLAnchorElement>(
      'a[href="sms:8773222299?body=REPORT"]'
    );
    expect(reportLink).not.toBeNull();
    expect(reportLink?.textContent).toContain('Text REPORT');

    const signalLink = container.querySelector<HTMLAnchorElement>(
      'a[href="https://stopice.net/signal/"]'
    );
    expect(signalLink).not.toBeNull();
    expect(signalLink?.getAttribute('target')).toBe('_blank');
    expect(signalLink?.getAttribute('rel')).toBe('noopener noreferrer');

    expect(container.textContent).toContain('accepts private reports only through its reviewed intake form');
    expect(container.textContent).toContain('does not operate or monitor');
  });
});
