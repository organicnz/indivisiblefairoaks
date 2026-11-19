// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRMPanelContactHeader } from '@/components/visual-edit/CRMPanelContactHeader';
import type { CRMContact } from '@/types/unified';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const contact = (doNotEmail: boolean | null): CRMContact =>
  ({
    id: 'c1',
    email: 'test@test.org',
    first_name: 'Test',
    last_name: 'Person',
    status: 'supporter',
    do_not_email: doNotEmail,
  }) as CRMContact;

describe('CRMPanelContactHeader email consent gates', () => {
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
    document.body.innerHTML = '';
  });

  const render = async (doNotEmail: boolean | null) => {
    await act(async () => {
      root.render(
        <CRMPanelContactHeader
          selectedContact={contact(doNotEmail)}
          copiedField={null}
          onCopy={vi.fn()}
          onBack={vi.fn()}
          onSetStatus={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );
    });
  };

  const sendEmail = () =>
    document.body.querySelector<HTMLAnchorElement>('a[aria-label="Send email"]');
  const composeBroadcast = () =>
    document.body.querySelector<HTMLAnchorElement>('a[aria-label="Compose broadcast"]');
  const disabledSendEmail = () =>
    document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Send email disabled: record email consent first"]'
    );
  const disabledComposeBroadcast = () =>
    document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Compose broadcast disabled: record email consent first"]'
    );

  it('keeps mailto and broadcast compose links for an opted-in contact', async () => {
    await render(false);

    expect(sendEmail()?.getAttribute('href')).toBe('mailto:test@test.org');
    expect(composeBroadcast()?.getAttribute('href')).toBe(
      '/admin/crm/broadcasts?recipient=test%40test.org'
    );
    expect(disabledSendEmail()).toBeNull();
    expect(disabledComposeBroadcast()).toBeNull();
    expect(document.body.textContent).not.toContain('Consent required before sending');
  });

  it('replaces both send links with disabled actions for an opted-out contact', async () => {
    await render(true);

    expect(sendEmail()).toBeNull();
    expect(composeBroadcast()).toBeNull();
    expect(disabledSendEmail()?.disabled).toBe(true);
    expect(disabledComposeBroadcast()?.disabled).toBe(true);
    expect(disabledSendEmail()?.title).toMatch(/opted out of email/i);
    expect(document.body.textContent).toContain('Consent required before sending');
  });

  it('replaces both send links with disabled actions for a never-asked contact', async () => {
    await render(null);

    expect(sendEmail()).toBeNull();
    expect(composeBroadcast()).toBeNull();
    expect(disabledSendEmail()?.disabled).toBe(true);
    expect(disabledComposeBroadcast()?.disabled).toBe(true);
    expect(disabledSendEmail()?.title).toMatch(/consent has not been recorded/i);
    expect(document.body.textContent).toContain('Consent required before sending');
  });
});
