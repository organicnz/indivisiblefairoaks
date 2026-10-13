// @vitest-environment jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRMPanel } from '@/components/visual-edit/CRMPanel';

const getCRMContacts = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    contacts: [
      {
        id: 'c1',
        email: 'test@test.org',
        first_name: 'Test',
        last_name: 'Person',
        do_not_email: false,
        tags: ['test'],
        status: 'supporter',
        phone: null,
        address: null,
        city: null,
        zip_code: null,
        district: 'CA-06',
        notes: null,
        total_donated_cents: 0,
        source: 'manual',
      },
    ],
    totalCount: 1,
  })
);

const exportCRMContacts = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    csv: 'id,email\nc1,test@test.org',
    count: 1,
    matchedCount: 1,
    truncated: false,
  })
);

const saveCRMContact = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    success: true,
    contact: {
      id: 'c1',
      email: 'test@test.org',
      first_name: 'Test',
      last_name: 'Person',
      do_not_email: false,
      tags: ['test', 'volunteer'],
      status: 'active_volunteer',
      notes: null,
      activities: [],
      updated_at: '2026-10-12T00:00:00Z',
    },
  })
);

const bulkUpdateCRMContacts = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    success: true,
    updatedCount: 1,
  })
);

const bulkDeleteCRMContacts = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    success: true,
    deletedCount: 1,
  })
);

const getCRMExistingTags = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    tags: ['test', 'volunteer', 'donor'],
    truncated: false,
    scanned: 3,
  })
);

const getCRMContactDetail = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    contact: {
      id: 'c1',
      email: 'test@test.org',
      first_name: 'Test',
      last_name: 'Person',
      do_not_email: false,
      tags: ['test'],
      status: 'supporter',
      notes: null,
      district: 'CA-06',
      activities: [],
    },
    activities: [
      { id: 'a1', type: 'note', title: 'Note 1', description: 'Body', created_at: '2026-01-01' },
      {
        id: 'a2',
        type: 'email_sent',
        title: 'Broadcast Sent',
        description: 'Hello',
        created_at: '2026-01-02',
      },
    ],
  })
);

const setCRMEmailConsent = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true })
);

vi.mock('@/lib/actions/crm', () => ({
  getCRMContacts,
  exportCRMContacts,
  saveCRMContact,
  bulkUpdateCRMContacts,
  bulkDeleteCRMContacts,
  getCRMExistingTags,
  getCRMContactDetail,
  getCRMSegments: vi
    .fn()
    .mockResolvedValue({
      segments: [{ id: 's1', name: 'Volunteers', query: 'volunteer' }],
      truncated: false,
    }),
  getCRMTasksForContact: vi.fn().mockResolvedValue([
    { id: 't1', title: 'Call voter', status: 'open', due_at: null },
    { id: 't2', title: 'Sent sticker', status: 'done', due_at: null },
  ]),
  setCRMEmailConsent,
  addCRMNote: vi.fn().mockResolvedValue({ success: true }),
  updateCRMNote: vi.fn().mockResolvedValue({ success: true }),
  deleteCRMNote: vi.fn().mockResolvedValue({ success: true }),
  setCRMTaskStatus: vi.fn().mockResolvedValue({ success: true }),
  deleteCRMTask: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/lib/crm-filters', () => ({
  consentLabel: (v: boolean | null) => (v === null ? 'Never asked' : v ? 'Opted out' : 'Opted in'),
  ConsentFilter: null,
  splitActiveValues: (s: string) => s.split(',').filter(Boolean),
}));

vi.mock('@/components/admin/ConfirmAction', () => ({
  ConfirmAction: ({ label, onConfirm, children }: any) => (
    <button
      type="button"
      data-testid="confirm-trigger"
      data-label={label}
      onClick={() => onConfirm()}
    >
      {children || label}
    </button>
  ),
}));

describe('CRMPanel', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(async () => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
    await act(async () => {
      root = createRoot(container);
      root.render(<CRMPanel isOpen onClose={() => {}} />);
    });
    // The panel is a Radix Dialog: it portals to document.body, not into the
    // render container — so every query below reads document.body, the way
    // VisualEditOverlay.test.tsx already does for its own dialog.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.removeChild(container);
    document.body.innerHTML = '';
  });

  it('renders notes timeline from crm_activities', async () => {
    // Select the constituent so its 360 loads — notes render for the
    // selected contact, never for an empty directory.
    const contactBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Test Person') ?? false
    );
    expect(contactBtn).not.toBeUndefined();
    await act(async () => {
      contactBtn?.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(document.body.textContent).toContain('Note');
  });

  it('provides a link to /admin/crm/segments', async () => {
    // The link lives in the segments view — open it the way an operator does.
    const segmentsBtn = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button')
    ).find((b) => b.textContent?.trim() === 'Segments');
    expect(segmentsBtn).not.toBeUndefined();
    await act(async () => {
      segmentsBtn?.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const link = document.body.querySelector('a[href="/admin/crm/segments"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('provides email and broadcast compose quick actions on constituent 360', async () => {
    const contactBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Test Person') ?? false
    );
    expect(contactBtn).not.toBeUndefined();
    await act(async () => {
      contactBtn?.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const mailtoLink = document.body.querySelector('a[href="mailto:test@test.org"]');
    expect(mailtoLink).not.toBeNull();

    const broadcastLink = document.body.querySelector(
      'a[href="/admin/crm/broadcasts?recipient=test%40test.org"]'
    );
    expect(broadcastLink).not.toBeNull();
  });

  it('exports constituents to CSV when clicking the export button', async () => {
    const exportBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.getAttribute('aria-label') === 'Export CSV' || b.textContent?.includes('Export')
    );
    expect(exportBtn).not.toBeUndefined();
    await act(async () => {
      exportBtn?.click();
    });
    expect(exportCRMContacts).toHaveBeenCalledTimes(1);
  });

  it('filters constituents by status dropdown', async () => {
    const statusSelect = document.body.querySelector<HTMLSelectElement>(
      'select[aria-label="Filter by constituent status"]'
    );
    expect(statusSelect).not.toBeNull();
    await act(async () => {
      if (statusSelect) {
        statusSelect.value = 'donor';
        statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    expect(getCRMContacts).toHaveBeenCalledWith(expect.objectContaining({ status: 'donor' }));
  });

  it('updates constituent status directly from the detail view', async () => {
    const contactBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Test Person') ?? false
    );
    expect(contactBtn).not.toBeUndefined();
    await act(async () => {
      contactBtn?.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const statusDropdown = document.body.querySelector<HTMLSelectElement>(
      'select[aria-label="Update constituent status"]'
    );
    expect(statusDropdown).not.toBeNull();
    await act(async () => {
      if (statusDropdown) {
        statusDropdown.value = 'active_volunteer';
        statusDropdown.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    expect(saveCRMContact).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', status: 'active_volunteer' })
    );
  });

  it('adds and removes tags directly from the constituent card', async () => {
    const contactBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Test Person') ?? false
    );
    expect(contactBtn).not.toBeUndefined();
    await act(async () => {
      contactBtn?.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Remove existing tag 'test'
    const removeBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove tag test"]'
    );
    expect(removeBtn).not.toBeNull();
    await act(async () => {
      removeBtn?.click();
    });
    expect(saveCRMContact).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', tags: [] }));
  });

  it('opens add constituent modal when clicking Add button', async () => {
    const addBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim().includes('Add') ?? false
    );
    expect(addBtn).not.toBeUndefined();
    await act(async () => {
      addBtn?.click();
    });
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
  });

  it('filters constituents when clicking a segment', async () => {
    const segmentsBtn = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button')
    ).find((b) => b.textContent?.trim() === 'Segments');
    expect(segmentsBtn).not.toBeUndefined();
    await act(async () => {
      segmentsBtn?.click();
    });

    const segmentCard = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button')
    ).find((b) => b.textContent?.includes('Volunteers') ?? false);
    expect(segmentCard).not.toBeUndefined();
    await act(async () => {
      segmentCard?.click();
    });

    expect(getCRMContacts).toHaveBeenCalledWith(expect.objectContaining({ query: 'volunteer' }));
  });

  it('filters timeline activities and tasks in the detail view', async () => {
    const contactBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Test Person') ?? false
    );
    expect(contactBtn).not.toBeUndefined();
    await act(async () => {
      contactBtn?.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Check timeline shows both activities initially
    expect(document.body.textContent).toContain('Note 1');
    expect(document.body.textContent).toContain('Broadcast Sent');

    // Filter to Notes only
    const notesTab = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Notes (1)') ?? false
    );
    expect(notesTab).not.toBeUndefined();
    await act(async () => {
      notesTab?.click();
    });
    expect(document.body.textContent).toContain('Note 1');
    expect(document.body.textContent).not.toContain('Broadcast Sent');

    // Filter tasks
    const openTasksTab = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button')
    ).find((b) => b.textContent?.includes('Open (1)') ?? false);
    expect(openTasksTab).not.toBeUndefined();
    await act(async () => {
      openTasksTab?.click();
    });
    expect(document.body.textContent).toContain('Call voter');
    expect(document.body.textContent).not.toContain('Sent sticker');
  });

  it('filters constituents by tag dropdown and allows clearing filter', async () => {
    const tagSelect = document.body.querySelector<HTMLSelectElement>(
      'select[aria-label="Filter by tag"]'
    );
    expect(tagSelect).not.toBeNull();
    await act(async () => {
      if (tagSelect) {
        tagSelect.value = 'volunteer';
        tagSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    expect(getCRMContacts).toHaveBeenCalledWith(expect.objectContaining({ tag: 'volunteer' }));

    // Verify active tag filter badge is displayed
    expect(document.body.textContent).toContain('Filtered by #volunteer');

    // Clear tag filter
    const clearBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove active tag filter"]'
    );
    expect(clearBtn).not.toBeNull();
    await act(async () => {
      clearBtn?.click();
    });
    expect(getCRMContacts).toHaveBeenCalledWith(expect.objectContaining({ tag: undefined }));
  });

  it('filters constituents when clicking tag badge in constituent 360 card', async () => {
    const contactBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Test Person') ?? false
    );
    expect(contactBtn).not.toBeUndefined();
    await act(async () => {
      contactBtn?.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const tagFilterBadgeBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Filter constituents by tag test"]'
    );
    expect(tagFilterBadgeBtn).not.toBeNull();
    await act(async () => {
      tagFilterBadgeBtn?.click();
    });
    expect(getCRMContacts).toHaveBeenCalledWith(expect.objectContaining({ tag: 'test' }));
  });

  it('toggles select-all and individual contact checkboxes', async () => {
    const selectAllCheckbox = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Select all constituents on page"]'
    );
    expect(selectAllCheckbox).not.toBeNull();

    // Select all
    await act(async () => {
      selectAllCheckbox?.click();
    });
    expect(document.body.textContent).toContain('1 selected');
    expect(document.body.textContent).toContain('Bulk Actions (1)');

    // Deselect individual
    const contactCheckbox = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Select Test Person"]'
    );
    expect(contactCheckbox).not.toBeNull();
    await act(async () => {
      contactCheckbox?.click();
    });
    expect(document.body.textContent).toContain('Select all (1)');
    expect(document.body.textContent).not.toContain('Bulk Actions (1)');
  });

  it('performs bulk status update for selected constituents', async () => {
    const selectAllCheckbox = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Select all constituents on page"]'
    );
    expect(selectAllCheckbox).not.toBeNull();
    await act(async () => {
      selectAllCheckbox?.click();
    });

    const bulkStatusSelect = document.body.querySelector<HTMLSelectElement>(
      'select[aria-label="Bulk update status"]'
    );
    expect(bulkStatusSelect).not.toBeNull();
    await act(async () => {
      if (bulkStatusSelect) {
        bulkStatusSelect.value = 'organizer';
        bulkStatusSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(bulkUpdateCRMContacts).toHaveBeenCalledWith(
      expect.objectContaining({
        contactIds: ['c1'],
        status: 'organizer',
      })
    );
  });

  it('performs bulk consent update for selected constituents', async () => {
    const selectAllCheckbox = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Select all constituents on page"]'
    );
    expect(selectAllCheckbox).not.toBeNull();
    await act(async () => {
      selectAllCheckbox?.click();
    });

    const bulkConsentSelect = document.body.querySelector<HTMLSelectElement>(
      'select[aria-label="Bulk update consent"]'
    );
    expect(bulkConsentSelect).not.toBeNull();
    await act(async () => {
      if (bulkConsentSelect) {
        bulkConsentSelect.value = 'opted_in';
        bulkConsentSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(bulkUpdateCRMContacts).toHaveBeenCalledWith(
      expect.objectContaining({
        contactIds: ['c1'],
        consent: 'opted_in',
      })
    );
  });

  it('performs bulk add tag for selected constituents', async () => {
    const selectAllCheckbox = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Select all constituents on page"]'
    );
    expect(selectAllCheckbox).not.toBeNull();
    await act(async () => {
      selectAllCheckbox?.click();
    });

    const tagInput = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Bulk tag name input"]'
    );
    expect(tagInput).not.toBeNull();
    await act(async () => {
      if (tagInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(tagInput, 'canvass2026');
        tagInput.dispatchEvent(new Event('input', { bubbles: true }));
        tagInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const applyTagBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Apply bulk tag"]'
    );
    expect(applyTagBtn).not.toBeNull();
    await act(async () => {
      applyTagBtn?.click();
    });

    expect(bulkUpdateCRMContacts).toHaveBeenCalledWith(
      expect.objectContaining({
        contactIds: ['c1'],
        addTags: ['canvass2026'],
      })
    );
  });

  it('performs bulk delete for selected constituents', async () => {
    const selectAllCheckbox = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Select all constituents on page"]'
    );
    expect(selectAllCheckbox).not.toBeNull();
    await act(async () => {
      selectAllCheckbox?.click();
    });

    const bulkDeleteTrigger = document.body.querySelector<HTMLButtonElement>(
      'button[data-label="Delete 1 constituents"]'
    );
    expect(bulkDeleteTrigger).not.toBeNull();
    await act(async () => {
      bulkDeleteTrigger?.click();
    });

    expect(bulkDeleteCRMContacts).toHaveBeenCalledWith(['c1']);
  });

  it('filters constituents by district input and clears filter', async () => {
    const districtInput = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Filter by district"]'
    );
    expect(districtInput).not.toBeNull();
    await act(async () => {
      if (districtInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(districtInput, 'CA-06');
        districtInput.dispatchEvent(new Event('input', { bubbles: true }));
        districtInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(getCRMContacts).toHaveBeenCalledWith(
      expect.objectContaining({ district: 'CA-06' })
    );

    const clearDistrictBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Clear district filter"]'
    );
    expect(clearDistrictBtn).not.toBeNull();
    await act(async () => {
      clearDistrictBtn?.click();
    });

    expect(getCRMContacts).toHaveBeenCalledWith(
      expect.objectContaining({ district: undefined })
    );
  });

  it('updates email consent immediately on constituent 360 card and refreshes timeline', async () => {
    const contactBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Test Person') ?? false
    );
    expect(contactBtn).not.toBeUndefined();
    await act(async () => {
      contactBtn?.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const optOutBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Opted out'
    );
    expect(optOutBtn).not.toBeUndefined();

    await act(async () => {
      optOutBtn?.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(setCRMEmailConsent).toHaveBeenCalledWith({
      contactId: 'c1',
      doNotEmail: 'opted_out',
    });
    expect(getCRMContactDetail).toHaveBeenCalledWith('c1');
  });

  it('clicks district button on constituent 360 card to filter directory by that district', async () => {
    const contactBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Test Person') ?? false
    );
    expect(contactBtn).not.toBeUndefined();
    await act(async () => {
      contactBtn?.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const districtFilterBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Filter directory by district CA-06"]'
    );
    expect(districtFilterBtn).not.toBeNull();
    await act(async () => {
      districtFilterBtn?.click();
    });

    expect(getCRMContacts).toHaveBeenCalledWith(
      expect.objectContaining({ district: 'CA-06' })
    );
    expect(document.body.textContent).toContain('District: CA-06');
  });

  it('performs bulk district assignment for selected constituents', async () => {
    const selectAllCheckbox = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Select all constituents on page"]'
    );
    expect(selectAllCheckbox).not.toBeNull();
    await act(async () => {
      selectAllCheckbox?.click();
    });

    const districtInput = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Bulk district input"]'
    );
    expect(districtInput).not.toBeNull();
    await act(async () => {
      if (districtInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(districtInput, 'CA-03');
        districtInput.dispatchEvent(new Event('input', { bubbles: true }));
        districtInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const applyDistrictBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Apply bulk district"]'
    );
    expect(applyDistrictBtn).not.toBeNull();
    await act(async () => {
      applyDistrictBtn?.click();
    });

    expect(bulkUpdateCRMContacts).toHaveBeenCalledWith(
      expect.objectContaining({
        contactIds: ['c1'],
        district: 'CA-03',
      })
    );
  });

  it('resets all filters when clicking the Reset all button', async () => {
    const statusSelect = document.body.querySelector<HTMLSelectElement>(
      'select[aria-label="Filter by constituent status"]'
    );
    expect(statusSelect).not.toBeNull();
    await act(async () => {
      if (statusSelect) {
        statusSelect.value = 'donor';
        statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const districtInput = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Filter by district"]'
    );
    expect(districtInput).not.toBeNull();
    await act(async () => {
      if (districtInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(districtInput, 'CA-06');
        districtInput.dispatchEvent(new Event('input', { bubbles: true }));
        districtInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(document.body.textContent).toContain('Status: Donor');
    expect(document.body.textContent).toContain('District: CA-06');

    const resetAllBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Reset all filters"]'
    );
    expect(resetAllBtn).not.toBeNull();

    await act(async () => {
      resetAllBtn?.click();
    });

    expect(getCRMContacts).toHaveBeenCalledWith(
      expect.objectContaining({
        status: undefined,
        district: undefined,
        query: undefined,
        consent: undefined,
        tag: undefined,
      })
    );

    const resetAllAfter = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Reset all filters"]'
    );
    expect(resetAllAfter).toBeNull();
  });

  it('removes individual status and consent filter chips', async () => {
    const consentSelect = document.body.querySelector<HTMLSelectElement>(
      'select[aria-label="Filter by email consent"]'
    );
    expect(consentSelect).not.toBeNull();
    await act(async () => {
      if (consentSelect) {
        consentSelect.value = 'opted_in';
        consentSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(document.body.textContent).toContain('Consent: Opted in');

    const removeConsentBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove consent filter"]'
    );
    expect(removeConsentBtn).not.toBeNull();
    await act(async () => {
      removeConsentBtn?.click();
    });

    expect(getCRMContacts).toHaveBeenCalledWith(
      expect.objectContaining({ consent: undefined })
    );
    expect(document.body.textContent).not.toContain('Consent: Opted in');
  });

  it('supports mobile back navigation to return to directory from constituent 360 card', async () => {
    const contactBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Test Person') ?? false
    );
    expect(contactBtn).not.toBeUndefined();
    await act(async () => {
      contactBtn?.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const backBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Back to constituents"]'
    );
    expect(backBtn).not.toBeNull();

    await act(async () => {
      backBtn?.click();
    });

    expect(document.body.textContent).toContain('Select a constituent to view details');
  });

  it('supports mobile back navigation from segments view', async () => {
    const segmentsBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Segments'
    );
    expect(segmentsBtn).not.toBeUndefined();
    await act(async () => {
      segmentsBtn?.click();
    });

    const backBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Back to constituents"]'
    );
    expect(backBtn).not.toBeNull();

    await act(async () => {
      backBtn?.click();
    });

    expect(document.body.textContent).toContain('Select a constituent to view details');
  });
});
