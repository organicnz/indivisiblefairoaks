// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getContentList = vi.hoisted(() => vi.fn());
const requireAdmin = vi.hoisted(() => vi.fn());

vi.mock('@/lib/actions/content', () => ({ getContentList }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminPage: requireAdmin }));
vi.mock('@/components/admin/content/ContentList', () => ({
  ContentList: () => null,
}));

const { default: AdminContentPage } = await import('@/app/admin/content/page');

describe('AdminContentPage filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue(undefined);
    getContentList.mockResolvedValue({ rows: [], totalCount: 0, hiddenCount: 0 });
  });

  it('passes the unreachable filter and normalized params to the server query', async () => {
    await AdminContentPage({
      searchParams: Promise.resolve({
        status: 'draft',
        type: 'post',
        q: '  meeting  ',
        page: '2',
        hide: 'unreachable',
      }),
    });

    expect(getContentList).toHaveBeenCalledWith({
      status: 'draft',
      type: 'post',
      query: 'meeting',
      page: 2,
      pageSize: 25,
      hideUnreachable: true,
    });
  });

  it('does not hide unreachable rows unless the filter is set', async () => {
    await AdminContentPage({ searchParams: Promise.resolve({}) });
    expect(getContentList).toHaveBeenCalledWith(
      expect.objectContaining({ hideUnreachable: false })
    );
  });
});
