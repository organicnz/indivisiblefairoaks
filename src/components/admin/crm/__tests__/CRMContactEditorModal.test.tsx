// @vitest-environment jsdom-same-realm
'use client';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRMContactEditorModal } from '@/components/admin/crm/CRMContactEditorModal';
import { findCRMContactByEmail, saveCRMContact, setCRMEmailConsent } from '@/lib/actions/crm';
import type { CRMContact } from '@/types/crm';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const saveContact = vi.mocked(saveCRMContact);
const setConsent = vi.mocked(setCRMEmailConsent);
const findContact = vi.mocked(findCRMContactByEmail);
const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: routerPush }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/actions/crm', () => ({
  findCRMContactByEmail: vi.fn(),
  saveCRMContact: vi.fn(),
  setCRMEmailConsent: vi.fn(),
}));

vi.mock('@/components/admin/crm/composer/CRMMediaLibraryModal', () => ({
  CRMMediaLibraryModal: () => null,
}));

vi.mock('@/components/admin/crm/CRMMergeModal', () => ({
  CRMMergeModal: ({
    keep,
    initialCandidate,
    isOpen,
    onClose,
    onMerged,
  }: {
    keep: CRMContact;
    initialCandidate?: CRMContact | null;
    isOpen: boolean;
    onClose: () => void;
    onMerged?: () => void;
  }) =>
    isOpen ? (
      <div
        data-testid="merge-modal"
        data-keep={keep.id}
        data-candidate={initialCandidate?.id ?? ''}
      >
        <button
          type="button"
          onClick={() => {
            onMerged?.();
            onClose();
          }}
        >
          Confirm merge
        </button>
      </div>
    ) : null,
}));

const contact = {
  id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
  email: 'jane@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  phone: null,
  address: null,
  city: 'Fair Oaks',
  zip_code: null,
  district: 'CA-06',
  status: 'supporter',
  tags: [],
  notes: null,
  do_not_email: null,
  updated_at: '2026-01-01T00:00:00.000Z',
} as unknown as CRMContact;

describe('CRMContactEditorModal consent', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    saveContact.mockReset();
    setConsent.mockReset();
    findContact.mockReset();
    routerPush.mockReset();
    findContact.mockResolvedValue({ contact: null });
    saveContact.mockResolvedValue({
      success: true,
      contactId: contact.id,
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    setConsent.mockResolvedValue({ success: true });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  const renderEditor = async (value?: CRMContact, onClose = vi.fn()) => {
    await act(async () => {
      root.render(
        <CRMContactEditorModal contact={value} isOpen onClose={onClose} onSaved={vi.fn()} />
      );
    });
    return onClose;
  };

  const setEmail = async (value: string) => {
    const input = document.body.querySelector<HTMLInputElement>('#email');
    expect(input).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      if (input) {
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  };

  const submit = async () => {
    const form = document.body.querySelector('form');
    expect(form).not.toBeNull();
    await act(async () => {
      form?.requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  };

  const buttonByText = (text: string) => {
    const button = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.includes(text) ?? false
    );
    expect(button).not.toBeUndefined();
    return button;
  };

  it('keeps the pre-refactor status and district option order and labels', async () => {
    await renderEditor();

    const selectOptions = (selector: string) => {
      const select = document.body.querySelector<HTMLSelectElement>(selector);
      expect(select).not.toBeNull();
      return Array.from(select?.options ?? []).map((option) => [
        option.value,
        option.textContent?.trim(),
      ]);
    };

    expect(selectOptions('#status')).toEqual([
      ['supporter', 'Supporter (Standard Member)'],
      ['active_volunteer', 'Active Volunteer'],
      ['choir', 'Resistance Choir Member'],
      ['donor', 'Grassroots Donor'],
      ['organizer', 'Chapter Organizer / Board'],
      ['inactive', 'Inactive'],
    ]);
    expect(selectOptions('#district')).toEqual([
      ['CA-06', 'CA-06 (Bera / Matsui)'],
      ['CA-03', 'CA-03 (Kiley / Sierra)'],
      ['CA-07', 'CA-07'],
      ['Other', 'Other / Regional'],
    ]);
  });

  it('shows all three states and routes a changed state through the dedicated consent action', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <CRMContactEditorModal contact={contact} isOpen onClose={onClose} onSaved={onSaved} />
      );
    });

    expect(document.body.textContent).toContain('Email Consent');
    expect(document.body.textContent).toContain('Never asked');
    expect(document.body.textContent).toContain('Opted out');
    expect(document.body.textContent).toContain('Agreed');

    const radios = Array.from(
      document.body.querySelectorAll<HTMLInputElement>('input[name="email-consent"]')
    );
    expect(radios).toHaveLength(3);
    const unasked = radios.find((radio) => radio.value === 'unasked');
    expect(unasked?.checked).toBe(true);

    const optedOut = radios.find((radio) => radio.value === 'opted_out');
    expect(optedOut).not.toBeUndefined();
    await act(async () => {
      optedOut?.click();
    });
    expect(optedOut?.checked).toBe(true);
    expect(document.body.textContent).toContain('recorded separately on the contact timeline');

    await submit();

    expect(saveContact).toHaveBeenCalledTimes(1);
    const payload = saveContact.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ id: contact.id, email: contact.email });
    expect(payload).not.toHaveProperty('do_not_email');
    expect(setConsent).toHaveBeenCalledWith({
      contactId: contact.id,
      doNotEmail: 'opted_out',
    });
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('defaults a new contact to never asked without calling the consent action', async () => {
    await renderEditor();

    expect(document.body.textContent).toContain('New constituents default to “Never asked”');
    const unasked = document.body.querySelector<HTMLInputElement>(
      'input[name="email-consent"][value="unasked"]'
    );
    expect(unasked?.checked).toBe(true);

    await setEmail('new@example.com');
    await submit();

    expect(saveContact).toHaveBeenCalledTimes(1);
    expect(saveContact.mock.calls[0]?.[0]).not.toHaveProperty('do_not_email');
    expect(setConsent).not.toHaveBeenCalled();
  });

  it('preflights a new email and offers the existing contact instead of writing', async () => {
    const existing = {
      ...contact,
      id: 'existing-contact-id',
      email: 'existing@example.com',
      first_name: 'Existing',
      last_name: 'Person',
    } as CRMContact;
    findContact.mockResolvedValue({ contact: existing });
    const onClose = await renderEditor();

    await setEmail('  Existing@Example.com  ');
    await submit();

    expect(findContact).toHaveBeenCalledWith({ email: 'existing@example.com' });
    expect(saveContact).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('That email already belongs to Existing Person');
    expect(document.body.textContent).toContain('existing@example.com');
    expect(document.body.textContent).toContain('Open existing');
    expect(document.body.textContent).toContain('Merge duplicate');

    await act(async () => {
      buttonByText('Open existing')?.click();
    });

    expect(routerPush).toHaveBeenCalledWith('/admin/crm/existing-contact-id');
    expect(onClose).toHaveBeenCalled();
  });

  it('preflights an edited email against other contacts and preseeds the merge', async () => {
    const existing = {
      ...contact,
      id: 'existing-contact-id',
      email: 'existing@example.com',
      first_name: 'Existing',
      last_name: 'Person',
    } as CRMContact;
    findContact.mockResolvedValue({ contact: existing });
    const onClose = await renderEditor(contact);

    await setEmail('existing@example.com');
    await submit();

    expect(findContact).toHaveBeenCalledWith({
      email: 'existing@example.com',
      excludeContactId: contact.id,
    });
    expect(saveContact).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('merge them into this constituent');

    await act(async () => {
      buttonByText('Merge duplicate')?.click();
    });

    const mergeModal = document.body.querySelector<HTMLElement>('[data-testid="merge-modal"]');
    expect(mergeModal?.dataset.keep).toBe(contact.id);
    expect(mergeModal?.dataset.candidate).toBe(existing.id);

    await act(async () => {
      buttonByText('Confirm merge')?.click();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the same duplicate panel when the unique constraint wins the race', async () => {
    const existing = {
      ...contact,
      id: 'race-winner-id',
      email: 'race@example.com',
      first_name: 'Race',
      last_name: 'Winner',
    } as CRMContact;
    saveContact.mockResolvedValue({
      success: false,
      reason: 'duplicate_email',
      error: 'That email already belongs to another constituent.',
      duplicateContact: existing,
    });
    await renderEditor();

    await setEmail('race@example.com');
    await submit();

    expect(findContact).toHaveBeenCalledWith({ email: 'race@example.com' });
    expect(saveContact).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('That email already belongs to Race Winner');
    expect(document.body.textContent).toContain('Open existing');
    expect(document.body.textContent).toContain('Merge duplicate');
  });

  it('records an explicit initial consent choice after creating the contact', async () => {
    saveContact.mockResolvedValue({
      success: true,
      contactId: 'new-contact-id',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    await renderEditor();

    const optedIn = document.body.querySelector<HTMLInputElement>(
      'input[name="email-consent"][value="opted_in"]'
    );
    expect(optedIn).not.toBeNull();
    await act(async () => {
      optedIn?.click();
    });

    await setEmail('new@example.com');
    await submit();

    expect(saveContact).toHaveBeenCalledTimes(1);
    expect(saveContact.mock.calls[0]?.[0]).not.toHaveProperty('do_not_email');
    expect(setConsent).toHaveBeenCalledWith({
      contactId: 'new-contact-id',
      doNotEmail: 'opted_in',
    });
  });
});
