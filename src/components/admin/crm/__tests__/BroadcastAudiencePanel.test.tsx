// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BroadcastAudiencePanel } from '@/components/admin/crm/BroadcastAudiencePanel';
import {
  CRM_CONTACT_BROADCAST_STATUS_OPTIONS,
  CRM_CONTACT_DISTRICT_OPTIONS,
} from '@/lib/crm-contact-options';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const statusLabels = CRM_CONTACT_BROADCAST_STATUS_OPTIONS.map((option) => option.broadcastLabel);
const districtLabels = CRM_CONTACT_DISTRICT_OPTIONS.filter(
  (option) => option.value !== 'Other'
).map((option) => option.filterLabel);

function renderPanel(overrides: Partial<Parameters<typeof BroadcastAudiencePanel>[0]> = {}) {
  return (
    <BroadcastAudiencePanel
      segments={[]}
      segmentsTruncated={false}
      selectedStatuses={[]}
      selectedDistricts={[]}
      selectedTags={[]}
      onStatusesChange={vi.fn()}
      onDistrictsChange={vi.fn()}
      onTagsChange={vi.fn()}
      onToggleStatus={vi.fn()}
      onToggleDistrict={vi.fn()}
      onToggleTag={vi.fn()}
      tagChips={[]}
      hiddenTagCount={0}
      tagsMayBeIncomplete={false}
      tagsMissingFromChips={[]}
      onSegmentConsentMismatch={vi.fn()}
      {...overrides}
    />
  );
}

describe('BroadcastAudiencePanel audience options', () => {
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

  const mount = async (overrides: Partial<Parameters<typeof BroadcastAudiencePanel>[0]> = {}) => {
    await act(async () => {
      root.render(renderPanel(overrides));
    });
  };

  const buttonByText = (text: string) => {
    const button = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.trim() === text
    );
    expect(button).not.toBeUndefined();
    return button as HTMLButtonElement;
  };

  it('renders the shared broadcast status and district labels, excluding directory-only districts', async () => {
    await mount();

    expect(
      Array.from(document.body.querySelectorAll('button')).map((button) =>
        button.textContent?.trim()
      )
    ).toEqual([...statusLabels, ...districtLabels]);
  });

  it('emits the shared option values when a status or district is toggled', async () => {
    const onToggleStatus = vi.fn();
    const onToggleDistrict = vi.fn();
    await mount({ onToggleStatus, onToggleDistrict });

    const choir = CRM_CONTACT_BROADCAST_STATUS_OPTIONS.find((option) => option.value === 'choir');
    const ca06 = CRM_CONTACT_DISTRICT_OPTIONS.find((option) => option.value === 'CA-06');
    expect(choir).toBeDefined();
    expect(ca06).toBeDefined();

    await act(async () => {
      buttonByText(choir?.broadcastLabel ?? '').click();
    });
    await act(async () => {
      buttonByText(ca06?.filterLabel ?? '').click();
    });

    expect(onToggleStatus).toHaveBeenCalledWith('choir');
    expect(onToggleDistrict).toHaveBeenCalledWith('CA-06');
  });
});
