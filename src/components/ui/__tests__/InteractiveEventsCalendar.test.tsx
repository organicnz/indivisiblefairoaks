// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractiveEventsCalendar } from '@/components/ui/InteractiveEventsCalendar';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockEditContext = {
  isAdmin: false,
  loading: false,
  target: null,
};

vi.mock('@/components/layout/useEditContext', () => ({
  useEditContext: () => mockEditContext,
}));

describe('InteractiveEventsCalendar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders November 10 chapter meeting, No Kings 4, and ongoing singing protest by default', async () => {
    await act(async () => {
      root.render(<InteractiveEventsCalendar />);
    });

    expect(container.textContent).toContain('Monthly Chapter Gathering & Food Bank Drive');
    expect(container.textContent).toContain('Tuesday, November 10, 2026');
    expect(container.textContent).toContain("St. Michael's Episcopal Church");

    expect(container.textContent).toContain('No Kings 4: Peaceful Protest & Stand-Out');
    expect(container.textContent).toContain('Saturday, October 17, 2026');
    expect(container.textContent).toContain('Fair Oaks Blvd & Sunrise Blvd');

    expect(container.textContent).toContain(
      'Carmichael Resistance Choir: Street Corner Singing Protest'
    );
    expect(container.textContent).toContain('Ongoing Every Saturday Afternoon');
  });

  it('filters events by category when chips are clicked', async () => {
    await act(async () => {
      root.render(<InteractiveEventsCalendar />);
    });

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const meetingsButton = buttons.find((b) => b.textContent?.trim() === 'Meetings');
    expect(meetingsButton).toBeDefined();

    await act(async () => {
      meetingsButton?.click();
    });

    expect(container.textContent).toContain('Monthly Chapter Gathering & Food Bank Drive');
    expect(container.textContent).not.toContain('No Kings 4');
    expect(container.textContent).not.toContain(
      'Carmichael Resistance Choir: Street Corner Singing Protest'
    );

    const ralliesButton = buttons.find((b) => b.textContent?.trim() === 'Rallies & Street Action');
    await act(async () => {
      ralliesButton?.click();
    });

    expect(container.textContent).toContain('No Kings 4');
    expect(container.textContent).not.toContain('Monthly Chapter Gathering');
  });

  it('filters events by search query in real time', async () => {
    await act(async () => {
      root.render(<InteractiveEventsCalendar />);
    });

    const searchInput = container.querySelector<HTMLInputElement>('input[type="text"]');
    expect(searchInput).not.toBeNull();

    await act(async () => {
      if (searchInput) {
        searchInput.value = 'Singing Protest';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        // Also trigger onChange if needed
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(searchInput, 'Singing Protest');
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Check search filtering
    expect(container.textContent).toContain(
      'Carmichael Resistance Choir: Street Corner Singing Protest'
    );
  });

  it('provides accessible Google Calendar URLs and ICS download controls', async () => {
    await act(async () => {
      root.render(<InteractiveEventsCalendar />);
    });

    const calLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[title*="Google Calendar"]')
    );
    expect(calLinks.length).toBeGreaterThan(0);
    const meetingCalLink = calLinks.find((a) => a.href.includes('20261110T183000'));
    expect(meetingCalLink).toBeDefined();

    const icsButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[title*="iCal"]')
    );
    expect(icsButtons.length).toBeGreaterThan(0);

    // Mock URL.createObjectURL and click to test ics export
    const createObjectUrlMock = vi.fn().mockReturnValue('blob:mock-ics');
    window.URL.createObjectURL = createObjectUrlMock;
    window.URL.revokeObjectURL = vi.fn();

    await act(async () => {
      icsButtons[0]?.click();
    });

    expect(createObjectUrlMock).toHaveBeenCalled();
  });

  it('renders unified Add Event dropdown for admins and triggers modal options', async () => {
    mockEditContext.isAdmin = true;

    await act(async () => {
      root.render(<InteractiveEventsCalendar />);
    });

    const dropdownTrigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add or import event"]'
    );
    expect(dropdownTrigger).not.toBeNull();
    expect(dropdownTrigger?.textContent).toContain('Add Event');

    // Click trigger to open dropdown menu (Radix listens to pointerdown)
    await act(async () => {
      dropdownTrigger?.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
      );
    });

    // Check both options are rendered
    expect(document.body.textContent).toContain('Import Mobilize');

    // Click "Import Mobilize"
    const importItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((el) =>
      el.textContent?.includes('Import Mobilize')
    );
    expect(importItem).toBeDefined();

    await act(async () => {
      importItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Import Mobilize Event');
  });

  it('expands search input on button click and collapses when cleared', async () => {
    await act(async () => {
      root.render(<InteractiveEventsCalendar />);
    });

    const searchButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Search events"]'
    );
    expect(searchButton).not.toBeNull();

    await act(async () => {
      searchButton?.click();
    });

    const searchInput = container.querySelector<HTMLInputElement>('input[type="text"]');
    expect(searchInput).not.toBeNull();

    await act(async () => {
      if (searchInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(searchInput, 'Meeting');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const clearButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Clear search"]'
    );
    expect(clearButton).not.toBeNull();

    await act(async () => {
      clearButton?.click();
    });

    expect(searchInput?.value).toBe('');
  });

  it('scrolls filters horizontally on vertical mouse wheel event', async () => {
    await act(async () => {
      root.render(<InteractiveEventsCalendar />);
    });

    const filtersContainer = container.querySelector<HTMLDivElement>('div.overflow-x-auto');
    expect(filtersContainer).not.toBeNull();

    if (filtersContainer) {
      filtersContainer.scrollLeft = 0;
      await act(async () => {
        const wheelEvent = new WheelEvent('wheel', {
          bubbles: true,
          deltaY: 120,
          deltaX: 0,
        });
        filtersContainer.dispatchEvent(wheelEvent);
      });
      expect(filtersContainer.scrollLeft).toBe(120);
    }
  });
});
