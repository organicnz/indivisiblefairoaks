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

const VOTER_GUIDE_DRIVE_IDS = [
  '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy',
  '1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN',
  '11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2',
  '1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U',
] as const;

describe('VoterInfoPage & archived 2026 voter guides', () => {
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

  it('keeps only evergreen rights guides and renders no 2026 material or archive pointer', async () => {
    const page = await VoterInfoPage();
    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain('Voter Rights & Educational Guides');
    expect(container.textContent).toContain('Who Represents You?');
    expect(container.textContent).toContain('Pre-Register at 16, Vote at 18');
    expect(container.textContent).toContain('Voting Rights Restoration');
    expect(container.textContent).toContain('Unhoused Voter Procedures');

    // The 2026 featured block belongs to /archive now. Its DataPoint keys are
    // reused there, so this page must not render them even when the CMS is empty.
    expect(container.textContent).not.toContain('2026 Voter Guide & Ballot Recommendations');
    expect(container.textContent).not.toContain('Sacramento Voter Guide');
    expect(container.textContent).not.toContain('Hands Off Our Vote 2026 Toolkit');
    expect(container.textContent).not.toContain('Key Dates for the Election');
    expect(container.textContent).not.toContain('Understanding the SAVE America Act');
    expect(container.textContent).not.toContain('Analysis by Lawyer Oyer');

    // The 2026 archive callout and the "Archives" section link now live only on
    // /archive, so this page carries no 2026 wording or pointer at all.
    expect(container.textContent).not.toContain('2026');
    expect(container.textContent).not.toContain('Voter Information Archives');
    expect(container.textContent).not.toContain('Open the 2026 voter archive');

    const sectionNav = container.querySelector('nav[aria-label="Voter information sections"]');
    expect(sectionNav).not.toBeNull();
    expect(sectionNav?.textContent).not.toContain('Archives');

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    expect(links.some((a) => a.getAttribute('href') === '#archives')).toBe(false);
    expect(links.some((a) => a.getAttribute('href')?.startsWith('/archive'))).toBe(false);

    for (const href of [
      'https://registertovote.ca.gov',
      'https://wheresmyballot.sos.ca.gov',
      'https://elections.saccounty.gov',
    ]) {
      expect(links.some((a) => a.getAttribute('href') === href)).toBe(true);
    }

    for (const driveId of VOTER_GUIDE_DRIVE_IDS) {
      expect(links.some((a) => a.href.includes(driveId))).toBe(false);
    }

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
  });
});
