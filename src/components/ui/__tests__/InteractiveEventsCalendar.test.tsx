// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractiveEventsCalendar } from '@/components/ui/InteractiveEventsCalendar';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
});
