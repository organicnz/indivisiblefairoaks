// @vitest-environment jsdom-same-realm
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import type { ComponentProps } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRMContactList } from '@/components/admin/crm/CRMContactList';

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock('@/lib/actions/crm', () => ({
  bulkDeleteCRMContacts: vi.fn(),
  bulkUpdateCRMContacts: vi.fn(),
  deleteCRMContact: vi.fn(),
  deleteCRMSegment: vi.fn(),
  exportCRMContacts: vi.fn(),
  saveCRMContact: vi.fn(),
  saveCRMSegment: vi.fn(),
  setCRMEmailConsent: vi.fn(),
  triggerHistoricalCRMSync: vi.fn(),
}));

vi.mock('@/components/admin/crm/CRMContactActionBar', () => ({
  CRMContactActionBar: () => null,
}));

// The harness only needs a way to toggle a row; the real table is not what this
// state transition test is about.
vi.mock('@/components/admin/crm/CRMContactTable', () => ({
  CRMContactTable: ({
    contacts,
    selectedIds,
    onToggleSelect,
  }: {
    contacts: Array<{ id: string }>;
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
  }) => (
    <div>
      <span data-testid="selected-count">{selectedIds.size}</span>
      {contacts.map((contact) => (
        <button
          key={contact.id}
          type="button"
          data-testid={`select-${contact.id}`}
          onClick={() => onToggleSelect(contact.id)}
        >
          Select {contact.id}
        </button>
      ))}
    </div>
  ),
}));

type Props = ComponentProps<typeof CRMContactList>;

const CONTACTS = [{ id: 'a' }, { id: 'b' }] as unknown as Props['initialContacts'];
const NEXT_PAGE_CONTACTS = [{ id: 'c' }] as unknown as Props['initialContacts'];
const SEGMENT = {
  id: 'seg-1',
  name: 'Choir locals',
  query: '',
  statuses: ['choir'],
  districts: [],
  tags: [],
  consent: null,
  created_at: '2026-01-01T00:00:00Z',
} as unknown as Props['segments'][number];

const BASE_PROPS: Props = {
  initialContacts: CONTACTS,
  totalCount: 2,
  currentQuery: '',
  currentStatus: 'all',
  currentDistrict: 'all',
  currentTag: 'all',
  currentConsent: 'all',
  currentPage: 1,
  pageSize: 25,
  existingTags: [],
  segments: [],
};

describe('CRMContactList bulk selection scope', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    push.mockClear();
    refresh.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (overrides: Partial<Props> = {}) => {
    act(() => {
      root.render(<CRMContactList {...BASE_PROPS} {...overrides} />);
    });
  };

  const click = (testId: string) => {
    const element = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    expect(element).not.toBeNull();
    act(() => element?.click());
  };

  const clickButton = (label: string) => {
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label
    );
    expect(button).not.toBeNull();
    act(() => button?.click());
  };

  const setStatusFilter = (value: string) => {
    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Filter by engagement status"]'
    );
    expect(select).not.toBeNull();
    act(() => {
      if (!select) return;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'value'
      )?.set;
      setter?.call(select, value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  const selectedCount = () =>
    container.querySelector('[data-testid="selected-count"]')?.textContent;
  const hasBulkBar = () =>
    Array.from(container.querySelectorAll('button')).some(
      (button) => button.textContent?.trim() === 'Clear'
    );

  it('clears the selection when a changed filter is applied', () => {
    render();
    click('select-a');
    expect(hasBulkBar()).toBe(true);
    expect(selectedCount()).toBe('1');

    setStatusFilter('donor');
    clickButton('Apply Filters');
    expect(push).toHaveBeenCalledWith('/admin/crm?status=donor');

    // The navigation re-renders the directory with the new applied filters.
    render({ currentStatus: 'donor', initialContacts: NEXT_PAGE_CONTACTS });

    expect(selectedCount()).toBe('0');
    expect(hasBulkBar()).toBe(false);
  });

  it('clears the selection when filters are reset', () => {
    render({ currentStatus: 'donor' });
    click('select-a');

    clickButton('Reset');
    expect(push).toHaveBeenCalledWith('/admin/crm?');

    render({ currentStatus: 'all', initialContacts: NEXT_PAGE_CONTACTS });

    expect(selectedCount()).toBe('0');
    expect(hasBulkBar()).toBe(false);
  });

  it('clears the selection when a quick filter changes the applied set', () => {
    render();
    click('select-a');

    clickButton('Volunteers');
    expect(push).toHaveBeenCalledWith('/admin/crm?status=active_volunteer');

    render({ currentStatus: 'active_volunteer', initialContacts: NEXT_PAGE_CONTACTS });

    expect(selectedCount()).toBe('0');
    expect(hasBulkBar()).toBe(false);
  });

  it('clears the selection when a saved segment replaces the applied set', () => {
    render({ segments: [SEGMENT] });
    click('select-a');

    clickButton('Choir locals');
    expect(push).toHaveBeenCalledWith('/admin/crm?status=choir');

    render({
      currentStatus: 'choir',
      initialContacts: NEXT_PAGE_CONTACTS,
      segments: [SEGMENT],
    });

    expect(selectedCount()).toBe('0');
    expect(hasBulkBar()).toBe(false);
  });

  it('clears the selection when applied filters change outside applyFilters', () => {
    render();
    click('select-a');
    expect(hasBulkBar()).toBe(true);

    render({ currentStatus: 'donor', initialContacts: NEXT_PAGE_CONTACTS });

    expect(selectedCount()).toBe('0');
    expect(hasBulkBar()).toBe(false);
  });

  it('keeps off-page selections when only the page changes', () => {
    render();
    click('select-a');
    expect(hasBulkBar()).toBe(true);

    render({ currentPage: 2, initialContacts: NEXT_PAGE_CONTACTS });

    expect(hasBulkBar()).toBe(true);
    expect(selectedCount()).toBe('1');
  });
});
