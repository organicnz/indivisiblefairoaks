// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ArchivePage from '@/app/archive/page';
import { VOTER_GUIDES_2026_DRIVE_IDS } from '@/components/voter-info/voter-guides-2026';
import type { LegacyArchive, LegacyDocumentRow } from '@/lib/queries/legacy';

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
  // A hosted row gets a URL, so a document that leaks back into the legacy
  // article produces a second, countable link rather than an invisible one.
  legacyDocumentUrl: (
    document: Pick<LegacyDocumentRow, 'public_url' | 'file_path' | 'external_url'>
  ) =>
    document.public_url ??
    (document.file_path ? `https://storage.test/${document.file_path}` : document.external_url),
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

const VOTER_GUIDE_DRIVE_IDS = Object.values(VOTER_GUIDES_2026_DRIVE_IDS);

function legacyDocument(overrides: Partial<LegacyDocumentRow>): LegacyDocumentRow {
  return {
    id: 'doc-1',
    slug: 'document',
    title: 'Document',
    category: 'voter',
    description: '',
    source_page_path: '/voter-information',
    file_path: null,
    public_url: null,
    external_url: null,
    mime_type: 'application/pdf',
    byte_size: 1024,
    rights: 'public',
    published_at: null,
    sort_order: 0,
    drive_id: null,
    youtube_id: null,
    ...overrides,
  };
}

describe('ArchivePage', () => {
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

  it('renders every moved 2026 guide once and keeps the other documents in the article', async () => {
    // All four ids, not one sample: a set that silently loses an entry has to
    // fail here, not on the deployed page.
    const moved = VOTER_GUIDE_DRIVE_IDS.map((driveId, index) =>
      legacyDocument({
        id: `moved-${index}`,
        title: `Moved 2026 Guide ${index + 1}`,
        drive_id: driveId,
        file_path: `documents/voter/moved-2026-guide-${index + 1}.pdf`,
      })
    );
    const earlier = legacyDocument({
      id: 'earlier',
      title: 'Earlier Voter Guide',
      drive_id: 'earlier-drive-id',
      file_path: 'documents/voter/earlier-guide.pdf',
    });
    const secondEarlier = legacyDocument({
      id: 'earlier-2',
      title: 'Earlier Voter Letter',
      drive_id: 'earlier-2-drive-id',
      file_path: 'documents/voter/earlier-letter.pdf',
    });
    getLegacyArchive.mockResolvedValueOnce({
      ...EMPTY_ARCHIVE,
      pages: [
        {
          id: 'page-voter',
          source_path: '/voter-information',
          source_url: 'https://example.test/voter-information',
          title: 'Voter Information',
          page_kind: 'guide',
          destination: '',
          summary: '',
          body_text: '',
          captured_at: '2026-10-01T00:00:00Z',
          sort_order: 0,
        },
      ],
      documents: [...moved, earlier, secondEarlier],
    });

    await renderPage();

    expectArchivedGuidesRendered();

    // The article keeps every other voter document and none of the moved ones.
    const article = container.querySelector('article');
    expect(article?.textContent).toContain('Earlier Voter Guide');
    expect(article?.textContent).toContain('Earlier Voter Letter');
    for (const document of moved) {
      expect(article?.textContent).not.toContain(document.title);
    }

    // Each moved guide is rendered exactly once on the page: its only link is
    // the 2026 card's Drive fallback, and its hosted copy never appears.
    const hrefs = Array.from(container.querySelectorAll('a')).map(
      (anchor) => anchor.getAttribute('href') ?? ''
    );
    for (const driveId of VOTER_GUIDE_DRIVE_IDS) {
      expect(
        hrefs.filter((href) => href.includes(driveId)),
        driveId
      ).toHaveLength(1);
    }
    expect(hrefs.some((href) => href.includes('moved-2026-guide-'))).toBe(false);
    expect(container.textContent?.match(/Moved 2026 Guide/g)).toBeNull();

    // The surviving documents are not duplicated either.
    expect(container.textContent?.match(/Earlier Voter Guide/g)).toHaveLength(1);
    expect(container.textContent?.match(/Earlier Voter Letter/g)).toHaveLength(1);
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
