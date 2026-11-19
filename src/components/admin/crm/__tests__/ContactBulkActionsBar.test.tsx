// @vitest-environment jsdom-same-realm
'use client';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactBulkActionsBar } from '@/components/admin/crm/ContactBulkActionsBar';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ContactBulkActionsBar option order', () => {
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

  it('keeps the pre-refactor status, consent, and label order', async () => {
    await act(async () => {
      root.render(
        <ContactBulkActionsBar
          count={2}
          busy={false}
          tagInput=""
          districtInput=""
          onClear={vi.fn()}
          onTagInputChange={vi.fn()}
          onDistrictInputChange={vi.fn()}
          onBulkStatus={vi.fn()}
          onBulkAddTag={vi.fn()}
          onBulkDistrict={vi.fn()}
          onBulkConsent={vi.fn()}
          onBulkDelete={vi.fn()}
        />
      );
    });

    const selects = Array.from(document.body.querySelectorAll<HTMLSelectElement>('select'));
    expect(selects).toHaveLength(2);

    const options = (select: HTMLSelectElement) =>
      Array.from(select.options)
        .slice(1)
        .map((option) => [option.value, option.textContent?.trim()]);

    expect(options(selects[0] as HTMLSelectElement)).toEqual([
      ['active_volunteer', 'Active Volunteer'],
      ['organizer', 'Organizer'],
      ['choir', 'Resistance Choir'],
      ['donor', 'Donor'],
      ['supporter', 'Supporter'],
      ['inactive', 'Inactive'],
    ]);
    expect(options(selects[1] as HTMLSelectElement)).toEqual([
      ['opted_in', 'Opt in'],
      ['opted_out', 'Opt out'],
      ['unasked', 'Mark unasked'],
    ]);
  });
});
