// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ArchivePage from '@/app/archive/page';
import type { LegacyArchive } from '@/lib/queries/legacy';

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

const getLegacyArchive = vi.hoisted(() => vi.fn());

vi.mock('@/lib/queries/legacy', () => ({
  getLegacyArchive,
  // The page resolves the four 2026 Drive ids through these helpers. The real
  // implementations only touch rows the empty archive does not have, and the
  // fallback URL is what an empty or failed read renders anyway.
  legacyDocumentForDriveId: () => null,
  legacyDocumentUrl: () => null,
}));

vi.mock('@/lib/queries/civic', () => ({
  getDataPoints: vi.fn(async () => ({})),
}));

vi.mock('@/components/cms/CopyRegion', () => ({
  CopyRegion: ({ id, children }: { id: string; children: React.ReactNode }) => (
    <div data-copy-region={id}>{children}</div>
  ),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EMPTY_ARCHIVE: LegacyArchive = { pages: [], assets: [], links: [], documents: [] };

const VOTER_GUIDE_DRIVE_IDS = [
  '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy',
  '1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN',
  '11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2',
  '1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U',
] as const;

describe('ArchivePage with no legacy capture', () => {
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
    vi.restoreAllMocks();
  });

  async function renderPage() {
    const page = await ArchivePage();
    await act(async () => {
      root.render(page);
    });
  }

  function expectArchivedGuidesRendered() {
    expect(container.querySelector('#voter-guides-2026')).not.toBeNull();
    expect(container.querySelector('[data-copy-region="archive-voter-guides"]')).not.toBeNull();
    expect(container.querySelector('#voter-guides-2026-heading')?.textContent).toContain(
      '2026 Voter Guide & Ballot Recommendations'
    );
    expect(container.textContent).toContain('Historical reference from the 2026 election');
    expect(container.textContent).toContain('Understanding the SAVE America Act');

    const html = container.innerHTML;
    for (const driveId of VOTER_GUIDE_DRIVE_IDS) {
      expect(html, driveId).toContain(driveId);
    }
  }

  it('renders the 2026 guides when the legacy archive query is empty', async () => {
    getLegacyArchive.mockResolvedValueOnce(EMPTY_ARCHIVE);

    await renderPage();

    expectArchivedGuidesRendered();
    // The legacy notice still explains why the Google Sites index is absent.
    expect(container.textContent).toContain('The archive is being prepared');
  });

  it('renders the 2026 guides when the legacy archive query rejects', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    getLegacyArchive.mockRejectedValueOnce(new Error('legacy_public_pages unavailable'));

    await renderPage();

    expectArchivedGuidesRendered();
    expect(container.textContent).toContain('The archive is being prepared');
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('legacy archive read failed'),
      expect.any(Error)
    );
  });
});
