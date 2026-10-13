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

vi.mock('@/lib/actions/crm', () => ({
  getCRMContacts,
  exportCRMContacts,
  saveCRMContact,
  getCRMContactDetail: vi.fn().mockResolvedValue({
    contact: {
      id: 'c1',
      email: 'test@test.org',
      first_name: 'Test',
      last_name: 'Person',
      do_not_email: false,
      tags: ['test'],
      status: 'supporter',
      notes: null,
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
  }),
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
  setCRMEmailConsent: vi.fn().mockResolvedValue({ success: true }),
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
});
