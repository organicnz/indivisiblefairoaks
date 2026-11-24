// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VoterInfoPage, { metadata } from '@/app/voter-info/page';

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/components/cms/CopyRegion', () => ({
  CopyRegion: ({ id, children }: { id: string; children: React.ReactNode }) => (
    <div data-copy-region={id}>{children}</div>
  ),
}));

vi.mock('@/components/ui/VgpuGeomagneticCusp', () => ({
  VgpuGeomagneticCusp: () => <div data-testid="geomagnetic-cusp" />,
}));

vi.mock('@/components/ui/SacramentoRepresentativeFinder', () => ({
  SacramentoRepresentativeFinder: () => <div data-testid="rep-finder" />,
}));

describe('VoterInfoPage & 2026 Voter Guides', () => {
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

  it('exports valid metadata for search indexing', () => {
    expect(metadata.title).toBe('Voter Information & Guides');
    expect(metadata.description).toContain('Sacramento County');
  });

  it('renders official 2026 voter guide, toolkit, and key-date links', async () => {
    const page = await VoterInfoPage();
    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain('2026 Voter Guide & Ballot Recommendations');
    expect(container.textContent).toContain('Sacramento Voter Guide');
    expect(container.textContent).toContain('Ballot Recommendations');
    expect(container.textContent).toContain('Hands Off Our Vote 2026 Toolkit');
    expect(container.textContent).toContain('Key Dates for the Election');
    // No candidate-specific document exists in the archive; do not resurrect
    // the old Candidate & Measure Brief label around an unrelated file.
    expect(container.textContent).not.toContain('Candidate & Measure Brief');
    expect(container.textContent).not.toContain('Voter Information Doc');
    expect(container.textContent).toContain('Voter Information Archives');
    expect(container.textContent).toContain('not a live election guide');
    expect(container.textContent).not.toContain('Voter guides from the old site');

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));

    const voterGuideLink = links.find((a) => a.href.includes('10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy'));
    expect(voterGuideLink).toBeDefined();
    expect(voterGuideLink?.target).toBe('_blank');
    expect(voterGuideLink?.rel).toContain('noopener');

    const ballotRecLink = links.find((a) => a.href.includes('1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN'));
    expect(ballotRecLink).toBeDefined();
    expect(ballotRecLink?.target).toBe('_blank');
    expect(ballotRecLink?.rel).toContain('noopener');

    const briefLink = links.find((a) => a.href.includes('11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2'));
    expect(briefLink).toBeDefined();
    expect(briefLink?.target).toBe('_blank');
    expect(briefLink?.textContent).toContain('Hands Off Our Vote 2026 Toolkit');
    expect(briefLink?.textContent).toContain(
      'National election protection and ballot measure toolkit for the 2026 election.'
    );
    expect(briefLink?.textContent).toContain('Download Toolkit');

    const docLink = links.find((a) => a.href.includes('1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U'));
    expect(docLink).toBeDefined();
    expect(docLink?.target).toBe('_blank');
    expect(docLink?.textContent).toContain('Key Dates for the Election');
    expect(docLink?.textContent).toContain(
      'Official election deadline schedule, including voter registration, vote-by-mail, and Election Day dates.'
    );
    expect(docLink?.textContent).toContain('View Key Dates');

    const fiveCallsLink = links.find((a) => a.href.includes('5calls.org'));
    expect(fiveCallsLink).toBeDefined();
    expect(fiveCallsLink?.target).toBe('_blank');

    const rightsRestoredLink = links.find(
      (a) => a.href === 'https://www.sos.ca.gov/elections/voting-rights-restored'
    );
    expect(rightsRestoredLink).toBeDefined();

    const voterBillOfRightsLink = links.find(
      (a) => a.href === 'https://www.sos.ca.gov/elections/voter-bill-rights'
    );
    expect(voterBillOfRightsLink).toBeDefined();

    const unhousedVoterLink = links.find(
      (a) =>
        a.href ===
        'https://elections.cdn.sos.ca.gov/statewide-elections/2025-special/trusted-info-homelessness.pdf'
    );
    expect(unhousedVoterLink).toBeDefined();

    const archiveLink = links.find((a) => a.getAttribute('href') === '/archive#voter-information');
    expect(archiveLink).toBeDefined();
    expect(archiveLink?.textContent).toContain('Open the 2026 voter archive');
  });

  it('renders the SAVE America Act spotlight as a click-to-load video', async () => {
    const page = await VoterInfoPage();
    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain('Understanding the SAVE America Act');
    expect(container.textContent).toContain('Analysis by Lawyer Oyer');

    // The raw iframe loaded YouTube before the reader asked for it and left a
    // black box whenever the player was blocked. Assert the local poster and
    // intent gate instead.
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
