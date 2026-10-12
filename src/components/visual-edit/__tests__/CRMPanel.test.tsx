import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRMPanel } from '@/components/visual-edit/CRMPanel';

vi.mock('@/lib/actions/crm', () => ({
  getCRMContacts: vi.fn().mockResolvedValue({
    contacts: [
      {
        id: 'c1',
        email: 'test@test.org',
        first_name: 'Test',
        last_name: 'Person',
        do_not_email: false,
        tags: [],
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
  }),
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
      { id: 'a1', type: 'note', title: 'Note', description: 'Body', created_at: '2026-01-01' },
    ],
  }),
  getCRMSegments: vi
    .fn()
    .mockResolvedValue({ segments: [{ id: 's1', name: 'Test', query: '' }], truncated: false }),
  getCRMTasksForContact: vi.fn().mockResolvedValue([]),
  setCRMEmailConsent: vi.fn().mockResolvedValue({ success: true }),
  addCRMNote: vi.fn().mockResolvedValue({ success: true }),
  updateCRMNote: vi.fn().mockResolvedValue({ success: true }),
  deleteCRMNote: vi.fn().mockResolvedValue({ success: true }),
  setCRMTaskStatus: vi.fn().mockResolvedValue({ success: true }),
  deleteCRMTask: vi.fn().mockResolvedValue({ success: true }),
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
});
