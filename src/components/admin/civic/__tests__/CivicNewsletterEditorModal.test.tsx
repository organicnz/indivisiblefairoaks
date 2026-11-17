// @vitest-environment jsdom-same-realm
'use client';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CivicNewsletterEditorModal } from '@/components/admin/civic/CivicNewsletterEditorModal';
import type { CivicNewsletterRecord } from '@/lib/actions/civic';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/actions/civic', () => ({
  saveCivicNewsletter: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const newsletter: CivicNewsletterRecord = {
  slug: 'summer-bulletin',
  title: 'Summer Bulletin',
  date_label: 'July 2026',
  description: 'Summer organizing update.',
  topics: ['Election Defense'],
  sort_order: 10,
  published_at: '2026-07-01T00:00:00Z',
};

describe('CivicNewsletterEditorModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, newsletter }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the publication time in Pacific and saves the same instant back', async () => {
    await act(async () => {
      root.render(
        <CivicNewsletterEditorModal
          isOpen={true}
          onClose={vi.fn()}
          newsletter={newsletter}
          onSaved={vi.fn()}
        />
      );
    });

    const publishedAt = document.querySelector<HTMLInputElement>('#civic-news-published-at');
    expect(publishedAt?.value).toBe('2026-06-30T17:00');

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    await act(async () => {
      form?.requestSubmit();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/civic/newsletters', expect.any(Object));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { published_at: string };
    expect(body.published_at).toBe('2026-07-01T00:00:00.000Z');
  });
});
