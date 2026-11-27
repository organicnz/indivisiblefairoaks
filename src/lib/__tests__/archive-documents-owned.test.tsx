// @vitest-environment jsdom-same-realm
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ArchivePage from '@/app/archive/page';
import type { LegacyArchive, LegacyDocumentRow } from '@/lib/queries/legacy';

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co' },
}));

vi.mock('@/lib/supabase-server', () => ({
  createPublicClient: () => ({}),
}));

const getLegacyArchive = vi.hoisted(() => vi.fn());

// Only the query is stubbed: `legacyDocumentForDriveId` and
// `legacyDocumentUrl` stay real, because the precedence they implement
// (owned copy first, Drive fallback second) is the behaviour under test.
vi.mock('@/lib/queries/legacy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/queries/legacy')>();
  return { ...actual, getLegacyArchive };
});

vi.mock('@/lib/queries/civic', () => ({
  getDataPointsForKeys: vi.fn(async () => ({})),
}));

vi.mock('@/components/cms/CopyRegion', () => ({
  CopyRegion: ({ id, children }: { id: string; children: React.ReactNode }) => (
    <div data-copy-region={id}>{children}</div>
  ),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STORAGE_BASE = 'https://project.supabase.co/storage/v1/object/public/legacy-documents';

const DOCUMENTS = [
  {
    driveId: '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy',
    slug: 'calmatters-2026-voter-guide-non-partisan-2026-1tf9z6kn',
  },
  {
    driveId: '1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN',
    slug: 'ca-voter-information-guide-2026-2bqhekvi',
  },
  {
    driveId: '11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2',
    slug: 'hands-off-our-vote-2026-toolkit-3r709bjc',
  },
  {
    driveId: '1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U',
    slug: 'key-dates-for-the-election-3e0tig0n',
  },
] as const;

function documentRow({
  driveId,
  slug,
  mirrored,
}: {
  driveId: string;
  slug: string;
  mirrored: boolean;
}): LegacyDocumentRow {
  return {
    id: `doc-${slug}`,
    slug,
    title: slug,
    category: 'voter',
    description: '',
    source_page_path: '/voter-information',
    file_path: mirrored ? `documents/voter/${slug}.pdf` : null,
    public_url: null,
    external_url: `https://drive.google.com/file/d/${driveId}/preview`,
    mime_type: 'application/pdf',
    byte_size: 100,
    rights: 'third_party',
    published_at: null,
    sort_order: 0,
    drive_id: driveId,
    youtube_id: null,
  };
}

function archiveWith(documents: LegacyDocumentRow[]): LegacyArchive {
  return { pages: [], assets: [], links: [], documents };
}

describe('archive 2026 cards: owned copy vs Drive fallback', () => {
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

  async function renderArchive(documents: LegacyDocumentRow[]) {
    getLegacyArchive.mockResolvedValueOnce(archiveWith(documents));
    const page = await ArchivePage();
    await act(async () => {
      root.render(page);
    });
    return Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).map((a) => a.href);
  }

  it('points every mirrored document at its owned bucket copy', async () => {
    const hrefs = await renderArchive(
      DOCUMENTS.map((doc) => documentRow({ ...doc, mirrored: true }))
    );

    for (const { driveId, slug } of DOCUMENTS) {
      const owned = `${STORAGE_BASE}/documents/voter/${slug}.pdf`;
      expect(hrefs, slug).toContain(owned);
      // The Drive fallback must no longer be reachable from the four cards.
      expect(
        hrefs.some((href) => href.includes(driveId) && href.includes('drive.google')),
        driveId
      ).toBe(false);
    }
  });

  it('keeps the Drive fallback when a document has no owned copy yet', async () => {
    const hrefs = await renderArchive(
      DOCUMENTS.map((doc) => documentRow({ ...doc, mirrored: false }))
    );

    for (const { driveId, slug } of DOCUMENTS) {
      expect(
        hrefs.some((href) => href.includes(driveId)),
        slug
      ).toBe(true);
      expect(hrefs, slug).not.toContain(`${STORAGE_BASE}/documents/voter/${slug}.pdf`);
    }
  });

  it('mixes the two: a verified copy wins, an unverified one falls back', async () => {
    const hrefs = await renderArchive([
      documentRow({ ...DOCUMENTS[0], mirrored: true }),
      documentRow({ ...DOCUMENTS[1], mirrored: false }),
      documentRow({ ...DOCUMENTS[2], mirrored: false }),
      documentRow({ ...DOCUMENTS[3], mirrored: false }),
    ]);

    expect(hrefs).toContain(`${STORAGE_BASE}/documents/voter/${DOCUMENTS[0].slug}.pdf`);
    expect(hrefs.some((href) => href.includes(DOCUMENTS[0].driveId))).toBe(false);
    expect(hrefs.some((href) => href.includes(DOCUMENTS[1].driveId))).toBe(true);
  });
});
