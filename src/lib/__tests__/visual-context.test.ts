// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAdminClient, type MockTableConfig } from './supabase-mock';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getContentForEdit: vi.fn(),
  getContentBySlugForEdit: vi.fn(),
  getContentRevisions: vi.fn(),
  getCRMEdgeFunctionHealth: vi.fn(),
  getCRMMediaFiles: vi.fn(),
  getCRMSegments: vi.fn(),
  getCRMStats: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: () => mocks.requireAdmin(),
}));

vi.mock('@/lib/actions/content', () => ({
  getContentForEdit: mocks.getContentForEdit,
  getContentBySlugForEdit: mocks.getContentBySlugForEdit,
  getContentRevisions: mocks.getContentRevisions,
}));

vi.mock('@/lib/actions/crm', () => ({
  getCRMEdgeFunctionHealth: mocks.getCRMEdgeFunctionHealth,
  getCRMMediaFiles: mocks.getCRMMediaFiles,
  getCRMSegments: mocks.getCRMSegments,
  getCRMStats: mocks.getCRMStats,
}));

const { getVisualPageContext } = await import('@/lib/actions/visual');

function setAdmin(gallery: MockTableConfig = {}, events: MockTableConfig = {}) {
  mocks.requireAdmin.mockResolvedValue({
    adminClient: createMockAdminClient({ gallery_photos: gallery, events }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCRMEdgeFunctionHealth.mockResolvedValue({
    database: true,
    storage: true,
    edgeFunction: true,
  });
  mocks.getCRMMediaFiles.mockResolvedValue({
    items: [],
    folders: ['crm', 'content', 'gallery'],
  });
  mocks.getCRMSegments.mockResolvedValue({ segments: [], truncated: false });
  mocks.getCRMStats.mockResolvedValue(null);
  mocks.getContentForEdit.mockResolvedValue(null);
  mocks.getContentBySlugForEdit.mockResolvedValue(null);
  mocks.getContentRevisions.mockResolvedValue({ success: true, data: { revisions: [] } });
});

describe('getVisualPageContext catalog counts', () => {
  it('returns exact counts when both queries succeed', async () => {
    setAdmin({ count: 2 }, { count: 5 });

    const ctx = await getVisualPageContext({ pathname: '/' });

    expect(ctx.catalog).toEqual({ galleryPhotos: 2, events: 5 });
  });

  it('marks only the gallery count unknown when its query fails', async () => {
    setAdmin({ count: 2, error: { message: 'gallery down' } }, { count: 5 });

    const ctx = await getVisualPageContext({ pathname: '/' });

    expect(ctx.catalog).toEqual({ galleryPhotos: null, events: 5 });
  });

  it('marks only the gallery count unknown when its exact count is omitted', async () => {
    setAdmin({ count: null }, { count: 5 });

    const ctx = await getVisualPageContext({ pathname: '/' });

    expect(ctx.catalog).toEqual({ galleryPhotos: null, events: 5 });
  });

  it('marks only the event count unknown when its exact count is omitted', async () => {
    setAdmin({ count: 2 }, { count: null });

    const ctx = await getVisualPageContext({ pathname: '/' });

    expect(ctx.catalog).toEqual({ galleryPhotos: 2, events: null });
  });

  it('marks media unavailable when the media read fails', async () => {
    setAdmin({ count: 2 }, { count: 5 });
    mocks.getCRMMediaFiles.mockRejectedValue(new Error('media down'));

    const ctx = await getVisualPageContext({ pathname: '/' });

    expect(ctx.mediaUnavailable).toBe(true);
    expect(ctx.media.items).toEqual([]);
  });

  it('marks segments unavailable when the segment read fails', async () => {
    setAdmin({ count: 2 }, { count: 5 });
    mocks.getCRMSegments.mockRejectedValue(new Error('segments down'));

    const ctx = await getVisualPageContext({ pathname: '/' });

    expect(ctx.segmentsUnavailable).toBe(true);
    expect(ctx.segments).toEqual([]);
  });

  it('marks revisions unavailable when the revision read fails', async () => {
    setAdmin({ count: 2 }, { count: 5 });
    mocks.getContentBySlugForEdit.mockResolvedValue({
      id: 7,
      slug: 'about',
      title: 'About',
    });
    mocks.getContentRevisions.mockResolvedValue({
      success: false,
      error: 'revisions down',
    });

    const ctx = await getVisualPageContext({ pathname: '/about' });

    expect(ctx.revisionsUnavailable).toBe(true);
    expect(ctx.revisions).toEqual([]);
  });
});
