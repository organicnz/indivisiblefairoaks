// @vitest-environment jsdom-same-realm

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MeetingMaterials } from '../MeetingMaterials';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('MeetingMaterials Component', () => {
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

  it('renders initial meeting reviews tab by default', async () => {
    await act(async () => {
      root.render(<MeetingMaterials />);
    });

    expect(container.textContent).toContain('Meeting Reviews & Printable Handouts');
    expect(container.textContent).toContain('General Chapter Meeting: Final Election Push & Ballot Strategy');
    expect(container.textContent).toContain('Browse Full Meeting Minutes & Archive on Drive');
  });

  it('switches to printable handouts tab when clicked', async () => {
    await act(async () => {
      root.render(<MeetingMaterials />);
    });

    const handoutsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Printable Handouts')
    );
    expect(handoutsBtn).toBeTruthy();

    await act(async () => {
      handoutsBtn?.click();
    });

    expect(container.textContent).toContain('Chapter Meeting Agenda & Action Checklist');
    expect(container.textContent).toContain('Civic Action Phone Script: Defending California Democracy');
    expect(container.textContent).toContain('Fair Oaks & Carmichael Voter Registration Walk Flyer');
    expect(container.textContent).toContain('Carmichael Resistance Choir Songbook & Chants');
    expect(container.textContent).toContain('Open Handouts Drive');
  });

  it('allows selecting different meeting reviews in the reviews tab', async () => {
    await act(async () => {
      root.render(<MeetingMaterials />);
    });

    const sepBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Fall Mobilization & Candidate Forum Debrief')
    );
    expect(sepBtn).toBeTruthy();

    await act(async () => {
      sepBtn?.click();
    });

    expect(container.textContent).toContain('Presentation by NorCal Resist coalition partners');

    // Select August 2026 town hall
    const augBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Summer Town Hall & Legislative Advocacy Review')
    );
    expect(augBtn).toBeTruthy();

    await act(async () => {
      augBtn?.click();
    });

    expect(container.textContent).toContain('Coordinated with Indivisible Yolo and Sacramento chapters');
    expect(container.textContent).toContain('Join choir practice Thursday evenings at Carmichael Park');
  });

  it('switches between reviews and handouts tabs back and forth', async () => {
    await act(async () => {
      root.render(<MeetingMaterials />);
    });

    const handoutsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Printable Handouts')
    );
    await act(async () => {
      handoutsBtn?.click();
    });
    expect(container.textContent).toContain('Chapter Meeting Agenda & Action Checklist');

    const reviewsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Meeting Reviews')
    );
    await act(async () => {
      reviewsBtn?.click();
    });
    expect(container.textContent).toContain('General Chapter Meeting: Final Election Push & Ballot Strategy');
  });
});
