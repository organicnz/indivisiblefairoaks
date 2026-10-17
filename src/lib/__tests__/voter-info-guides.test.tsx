// @vitest-environment jsdom
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
    const page = await VoterInfoPage();
    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain('2026 Voter Guide & Ballot Recommendations');
    expect(container.textContent).toContain('Sacramento Voter Guide');
    expect(container.textContent).toContain('Ballot Recommendations');
    expect(container.textContent).toContain('Candidate & Measure Brief');
    expect(container.textContent).toContain('Voter Information Doc');

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

    const docLink = links.find((a) => a.href.includes('1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U'));
    expect(docLink).toBeDefined();
    expect(docLink?.target).toBe('_blank');
  });

  it('renders the SAVE America Act educational video spotlight with valid iframe attributes', async () => {
    const page = await VoterInfoPage();
    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain('Understanding the SAVE America Act');
    expect(container.textContent).toContain('Analysis by Lawyer Oyer');

    const iframe = container.querySelector<HTMLIFrameElement>('iframe[src*="0a9zLvWVqgQ"]');
    expect(iframe).not.toBeNull();
    expect(iframe?.title).toContain('The SAVE America Act');
    expect(iframe?.allowFullscreen).toBe(true);
  });
});
