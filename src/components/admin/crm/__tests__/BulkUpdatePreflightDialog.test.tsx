// @vitest-environment jsdom-same-realm
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkUpdatePreflightDialog } from '@/components/admin/crm/BulkUpdatePreflightDialog';
import type { CRMBulkUpdatePreview } from '@/types/crm';

const STATUS_PREVIEW: CRMBulkUpdatePreview = {
  field: 'status',
  selectedCount: 4,
  foundCount: 3,
  changedCount: 2,
  unchangedCount: 1,
  plannedValue: 'organizer',
  distribution: [
    { value: 'supporter', count: 2 },
    { value: 'organizer', count: 1 },
  ],
};

describe('BulkUpdatePreflightDialog', () => {
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

  const render = async (
    preview: CRMBulkUpdatePreview | null,
    overrides: Partial<Parameters<typeof BulkUpdatePreflightDialog>[0]> = {}
  ) => {
    const onConfirm = overrides.onConfirm ?? vi.fn();
    const onCancel = overrides.onCancel ?? vi.fn();
    await act(async () => {
      root.render(
        <BulkUpdatePreflightDialog
          open
          preview={preview}
          loading={false}
          error={null}
          busy={false}
          onCancel={onCancel}
          onConfirm={onConfirm}
          {...overrides}
        />
      );
    });
    return { onConfirm, onCancel };
  };

  it('shows the selected count, current distribution, planned value, and change count', async () => {
    const { onConfirm } = await render(STATUS_PREVIEW);

    expect(document.body.textContent).toContain('Selected');
    expect(document.body.textContent).toContain('4');
    expect(document.body.textContent).toContain('Still exist');
    expect(document.body.textContent).toContain('Current status distribution');
    expect(document.body.textContent).toContain('Supporter');
    expect(document.body.textContent).toContain('Organizer');
    expect(document.body.textContent).toContain('Set status to Organizer');
    expect(document.body.textContent).toContain('2 will change; 1 already has this value.');
    expect(document.body.textContent).toContain(
      '1 of the selected contacts no longer exists and cannot be updated.'
    );

    const apply = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Apply change to 3'
    );
    expect(apply).not.toBeUndefined();
    await act(async () => apply?.click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('labels tag additions and disables a no-op confirmation', async () => {
    await render({
      field: 'tags',
      selectedCount: 2,
      foundCount: 2,
      changedCount: 0,
      unchangedCount: 2,
      plannedValue: 'canvass2026',
      distribution: [
        { value: 'canvass2026', count: 2 },
        { value: '', count: 0 },
      ],
    });

    expect(document.body.textContent).toContain('Add #canvass2026 to the selected contacts');
    expect(document.body.textContent).toContain('Every selected contact already has this tag.');
    const apply = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'No changes to apply'
    );
    expect(apply).not.toBeUndefined();
    expect(apply?.disabled).toBe(true);
  });
});
