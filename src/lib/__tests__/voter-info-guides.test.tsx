// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VoterInfoPage, { metadata } from '@/app/voter-info/page';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/components/cms/CopyRegion', () => ({
  CopyRegion: ({ id, children }: { id: string; children: React.ReactNode }) => (
    <div data-copy-region={id}>{children}</div>
  ),
}));

vi.mock('@/components/ui/VgpuCivicConstellation', () => ({
  VgpuCivicConstellation: () => <div data-testid="constellation" />,
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

  it('renders official 2026 voter guide and ballot recommendation links', async () => {
    await act(async () => {
      root.render(<VoterInfoPage />);
    });

    expect(container.textContent).toContain('2026 Voter Guide & Ballot Recommendations');
    expect(container.textContent).toContain('Sacramento Voter Guide');
    expect(container.textContent).toContain('Ballot Recommendations');
    expect(container.textContent).toContain('Candidate & Measure Brief');
    expect(container.textContent).toContain('Voter Information Doc');

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));

    const voterGuideLink = links.find((a) =>
      a.href.includes('10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy')
    );
    expect(voterGuideLink).toBeDefined();
    expect(voterGuideLink?.target).toBe('_blank');
    expect(voterGuideLink?.rel).toContain('noopener');

    const ballotRecLink = links.find((a) =>
      a.href.includes('1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN')
    );
    expect(ballotRecLink).toBeDefined();
    expect(ballotRecLink?.target).toBe('_blank');
    expect(ballotRecLink?.rel).toContain('noopener');

    const briefLink = links.find((a) =>
      a.href.includes('11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2')
    );
    expect(briefLink).toBeDefined();
    expect(briefLink?.target).toBe('_blank');

    const docLink = links.find((a) =>
      a.href.includes('1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U')
    );
    expect(docLink).toBeDefined();
    expect(docLink?.target).toBe('_blank');
  });

  it('contains target anchors for navigation sublinks', async () => {
    await act(async () => {
      root.render(<VoterInfoPage />);
    });

    expect(container.querySelector('#representatives')).not.toBeNull();
    expect(container.querySelector('#guides')).not.toBeNull();
    expect(container.querySelector('#hotlines')).not.toBeNull();
  });
});
