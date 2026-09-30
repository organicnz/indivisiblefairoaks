import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentEditor } from '@/components/admin/content/ContentEditor';

const saveContent = vi.hoisted(() => vi.fn());
const getContentRevisions = vi.hoisted(() => vi.fn());
const restoreContentRevision = vi.hoisted(() => vi.fn());
const getContentForEdit = vi.hoisted(() => vi.fn());
const setContentStatus = vi.hoisted(() => vi.fn());
const deleteContent = vi.hoisted(() => vi.fn());
const duplicateContent = vi.hoisted(() => vi.fn());
const uploadContentImage = vi.hoisted(() => vi.fn());
const deleteContentImage = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@/lib/actions/content', () => ({
  saveContent,
  getContentRevisions,
  restoreContentRevision,
  getContentForEdit,
  setContentStatus,
  deleteContent,
  duplicateContent,
  uploadContentImage,
  deleteContentImage,
}));
vi.mock('sonner', () => ({ toast }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

/**
 * A restore the author cannot inspect first is a blind control: every row is
 * a timestamp, and timestamps all look alike after a long editing session.
 * These tests pin the two halves of the fix — each row says what restoring it
 * would change, and the restore itself goes through an inline confirm step
 * rather than a native dialog (which cannot be automated, so the path would
 * go untested).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const revision = (over: Record<string, unknown> = {}) => ({
  id: 11,
  content_id: 7,
  title: 'Earlier title',
  slug: 'meeting-notes',
  body: '<p>Short</p>',
  excerpt: null,
  type: 'post',
  status: 'draft',
  metadata: {},
  created_at: '2026-09-20T18:00:00.000Z',
  created_by: null,
  ...over,
});

describe('ContentEditor version history', () => {
  let container: HTMLDivElement;
  let root: Root;

  const initial = {
    id: 7,
    slug: 'meeting-notes',
    title: 'Current title',
    body: '<p>Current body text</p>',
    excerpt: '',
    type: 'post',
    status: 'publish' as const,
    featuredImage: '',
    publishedAt: null as string | null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    saveContent.mockResolvedValue({ success: true, data: { id: 7 } });
    getContentRevisions.mockResolvedValue({ success: true, data: { revisions: [revision()] } });
    restoreContentRevision.mockResolvedValue({ success: true, data: { id: 7 } });
    getContentForEdit.mockResolvedValue({
      title: 'Earlier title',
      slug: 'meeting-notes',
      excerpt: null,
      type: 'post',
      status: 'draft',
      featured_image: null,
      body: '<p>Short</p>',
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const render = () => {
    act(() => {
      root.render(<ContentEditor initial={initial} siteHost="indivisiblefairoaks.org" />);
    });
  };

  const openHistory = async () => {
    const history = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'History'
    ) as HTMLButtonElement;
    act(() => {
      history.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await act(async () => {});
  };

  const button = (text: string) =>
    [...container.querySelectorAll('button')].find((b) => b.textContent === text) as
      | HTMLButtonElement
      | undefined;

  it('labels each row with its status instead of only a timestamp', async () => {
    render();
    await openHistory();
    expect(container.textContent).toContain('Earlier title');
    expect(container.textContent).toContain('draft');
  });

  it('shows what a restore would change before asking', async () => {
    render();
    await openHistory();
    act(() => {
      button('3 changes from what’s on screen')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
    // Title, Status and Body differ; slug, type and excerpt do not.
    expect(container.textContent).toContain('Title:');
    expect(container.textContent).toContain('Current title');
    expect(container.textContent).toContain('Status:');
    expect(restoreContentRevision).not.toHaveBeenCalled();
  });

  it('restores only through the inline confirm step, and cancel backs out', async () => {
    render();
    await openHistory();

    act(() => {
      button('Restore')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
    expect(container.textContent).toContain('Confirm restore');
    expect(restoreContentRevision).not.toHaveBeenCalled();

    act(() => {
      button('Keep editing')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
    expect(container.textContent).not.toContain('Confirm restore');
    expect(restoreContentRevision).not.toHaveBeenCalled();

    act(() => {
      button('Restore')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
    await act(async () => {
      button('Confirm restore')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
    expect(restoreContentRevision).toHaveBeenCalledTimes(1);
    expect(restoreContentRevision).toHaveBeenCalledWith(7, 11);
    expect(toast.success).toHaveBeenCalledWith('Version restored');
  });
});
