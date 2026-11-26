// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VoterGuidesSection } from '@/components/voter-info/VoterGuidesSection';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VOTER_GUIDE_DRIVE_IDS = [
  '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy',
  '1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN',
  '11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2',
  '1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U',
] as const;

function archiveHref(driveId: string) {
  return `https://archive.example/${driveId}`;
}

describe('VoterGuidesSection archive mode', () => {
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

  async function renderArchive() {
    await act(async () => {
      root.render(<VoterGuidesSection dataPoints={{}} legacyHref={archiveHref} mode="2026" />);
    });
  }

  it('renders the 2026 section anchor, historical note, and four archive documents', async () => {
    await renderArchive();

    const section = container.querySelector('#voter-guides-2026');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('aria-labelledby')).toBe('voter-guides-2026-heading');
    expect(container.querySelector('#voter-guides-2026-heading')?.textContent).toContain(
      '2026 Voter Guide & Ballot Recommendations'
    );

    expect(container.textContent).toContain('2026 election archive');
    expect(container.textContent).toContain('Historical reference from the 2026 election');
    expect(container.textContent).toContain('These are not live election');
    expect(container.textContent).toContain('recommendations.');

    expect(container.textContent).toContain('Sacramento Voter Guide');
    expect(container.textContent).toContain('Ballot Recommendations');
    expect(container.textContent).toContain('Hands Off Our Vote 2026 Toolkit');
    expect(container.textContent).toContain('Key Dates for the Election');

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    for (const driveId of VOTER_GUIDE_DRIVE_IDS) {
      const link = links.find((a) => a.getAttribute('href') === archiveHref(driveId));
      expect(link, driveId).toBeDefined();
      expect(link?.target).toBe('_blank');
      expect(link?.rel).toContain('noopener');
    }

    expect(
      links.find((a) => a.getAttribute('href') === archiveHref(VOTER_GUIDE_DRIVE_IDS[0]))
        ?.textContent
    ).toContain('Sacramento Voter Guide');
    expect(
      links.find((a) => a.getAttribute('href') === archiveHref(VOTER_GUIDE_DRIVE_IDS[1]))
        ?.textContent
    ).toContain('Ballot Recommendations');
    expect(
      links.find((a) => a.getAttribute('href') === archiveHref(VOTER_GUIDE_DRIVE_IDS[2]))
        ?.textContent
    ).toContain('Hands Off Our Vote 2026 Toolkit');
    expect(
      links.find((a) => a.getAttribute('href') === archiveHref(VOTER_GUIDE_DRIVE_IDS[3]))
        ?.textContent
    ).toContain('Key Dates for the Election');
  });

  it('does not render the 2026 block in the default rights mode', async () => {
    await act(async () => {
      root.render(<VoterGuidesSection dataPoints={{}} legacyHref={archiveHref} />);
    });

    expect(container.querySelector('#voter-guides-2026')).toBeNull();
    expect(container.textContent).toContain('Voter Rights & Educational Guides');
    expect(container.textContent).not.toContain('Understanding the SAVE America Act');
  });

  it('renders the SAVE America Act spotlight as a click-to-load video', async () => {
    await renderArchive();

    expect(container.textContent).toContain('Understanding the SAVE America Act');
    expect(container.textContent).toContain('Analysis by Lawyer Oyer');

    const playButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label*="Play film"][aria-label*="SAVE America Act"]'
    );
    expect(playButton).not.toBeNull();
    expect(container.querySelector('iframe')).toBeNull();

    await act(async () => {
      playButton?.click();
    });

    const iframe = container.querySelector<HTMLIFrameElement>('iframe[src*="0a9zLvWVqgQ"]');
    expect(iframe).not.toBeNull();
    expect(iframe?.title).toContain('The SAVE America Act');
    expect(iframe?.allowFullscreen).toBe(true);
  });
});
