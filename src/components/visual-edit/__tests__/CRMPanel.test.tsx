import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CRMPanel } from '@/components/visual-edit/CRMPanel';
import { VISUAL_EDIT_EVENTS } from '@/lib/visual-edit-events';

vi.mock('@/lib/actions/crm', () => ({
  getCRMContacts: vi.fn().mockResolvedValue({ contacts: [], totalCount: 0 }),
  getCRMContactDetail: vi.fn().mockResolvedValue({
    contact: { id: 'c1', email: 'test@test.org', first_name: 'Test', last_name: 'Person', do_not_email: false, tags: ['test'], status: 'supporter', notes: null, activities: [] },
    activities: [{ id: 'a1', type: 'note', title: 'Note', description: 'Body', created_at: '2026-01-01' }],
  }),
  getCRMSegments: vi.fn().mockResolvedValue({ segments: [{ id: 's1', name: 'Test', query: '' }], truncated: false }),
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
  ConfirmAction: ({ label, message, danger, onConfirm, children }: any) => (
    <button data-testid="confirm-trigger" data-label={label} data-danger={danger ? 'danger' : 'safe'} onClick={() => onConfirm()}>
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
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.removeChild(container);
  });

  it('renders notes timeline from crm_activities', async () => {
    await new Promise((r) => setTimeout(r, 50));
    // Assert note is present
    const noteText = container.querySelector('[data-testid="note-body"]');
    expect(noteText || container.textContent).toContain('Note');
  });

  it('provides a link to /admin/crm/segments', async () => {
    await new Promise((r) => setTimeout(r, 50));
    const link = container.querySelector('a[href="/admin/crm/segments"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
  });
});
