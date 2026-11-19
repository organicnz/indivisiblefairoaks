// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('newsletter stats sentence fallbacks', () => {
  it('uses the regex fallback when Intl.Segmenter is unavailable', async () => {
    vi.resetModules();
    vi.stubGlobal('Intl', {});

    const { analyzeNewsText } = await import('@/lib/news-text/newsletter-stats');
    expect(analyzeNewsText('One. Two!').sentences).toBe(2);
  });

  it('uses the regex fallback when the segmenter returns no segments', async () => {
    vi.resetModules();
    class EmptySegmenter {
      segment() {
        return [];
      }
    }
    vi.stubGlobal('Intl', { Segmenter: EmptySegmenter });

    const { analyzeNewsText } = await import('@/lib/news-text/newsletter-stats');
    expect(analyzeNewsText('One. Two!').sentences).toBe(2);
  });

  it('keeps the paragraph when the sentence regex finds no tokens', async () => {
    vi.resetModules();
    vi.stubGlobal('Intl', {});
    vi.spyOn(String.prototype, 'match').mockReturnValue(null);

    const { analyzeNewsText } = await import('@/lib/news-text/newsletter-stats');
    expect(analyzeNewsText('No punctuation here').sentences).toBe(1);
  });
});
