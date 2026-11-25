// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decodeBase64 } from '@/lib/base64';
import { compressEvidenceImage, extractEvidenceImageUrls } from '@/lib/ice-crawl-images';

// A real 1x1 PNG. Using a published constant rather than generating one keeps
// the test focused on the pipeline, not on an encoder.
const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('extractEvidenceImageUrls', () => {
  it('reads og:image and twitter:image, resolves relative values, and dedupes', () => {
    const html = [
      '<meta property="og:image" content="https://cdn.example.org/photo.jpg">',
      '<meta name="twitter:image" content="/fallback.png">',
      '<meta property="og:image:url" content="https://cdn.example.org/photo.jpg">',
      '<meta property="og:title" content="not an image">',
    ].join('\n');
    expect(extractEvidenceImageUrls(html, 'https://news.example.org/story')).toEqual([
      'https://cdn.example.org/photo.jpg',
      'https://news.example.org/fallback.png',
    ]);
  });

  it('drops non-HTTP schemes and honours the limit', () => {
    const html = [
      '<meta property="og:image" content="data:image/png;base64,AAAA">',
      '<meta property="og:image" content="https://cdn.example.org/a.jpg">',
      '<meta property="og:image" content="https://cdn.example.org/b.jpg">',
      '<meta property="og:image" content="https://cdn.example.org/c.jpg">',
    ].join('\n');
    expect(extractEvidenceImageUrls(html, 'https://news.example.org/', 2)).toEqual([
      'https://cdn.example.org/a.jpg',
      'https://cdn.example.org/b.jpg',
    ]);
  });

  it('decodes entity-escaped query strings and tolerates a reversed attribute order', () => {
    const html =
      '<meta content="https://cdn.example.org/p.jpg?w=1200&amp;h=800" property="og:image">';
    expect(extractEvidenceImageUrls(html, 'https://news.example.org/')).toEqual([
      'https://cdn.example.org/p.jpg?w=1200&h=800',
    ]);
  });

  it('reads JSON-LD images and a content-sized first image', () => {
    const html = [
      '<script type="application/ld+json">',
      JSON.stringify({ '@type': 'NewsArticle', image: { url: 'https://cdn.example.org/ld.jpg' } }),
      '</script>',
      '<img src="/logo.png" width="80" height="80">',
      '<img src="https://cdn.example.org/content.jpg" width="800" height="450">',
    ].join('\n');
    expect(extractEvidenceImageUrls(html, 'https://news.example.org/story', 3)).toEqual([
      'https://cdn.example.org/ld.jpg',
      'https://cdn.example.org/content.jpg',
    ]);
  });

  it('ignores a sub-200px image and data URLs when no metadata exists', () => {
    const html =
      '<img src="data:image/png;base64,AAAA">' +
      '<img src="https://cdn.example.org/pixel.gif" width="1" height="1">';
    expect(extractEvidenceImageUrls(html, 'https://news.example.org/story')).toEqual([]);
  });

  it('returns nothing for a page with no preview image', () => {
    expect(
      extractEvidenceImageUrls('<html><body>No image</body></html>', 'https://x.test/')
    ).toEqual([]);
  });
});

describe('compressEvidenceImage', () => {
  it('re-encodes to a WebP and reports the real dimensions', async () => {
    const input = decodeBase64(ONE_PIXEL_PNG);
    expect(input).not.toBeNull();
    const compressed = await compressEvidenceImage(input as Uint8Array);
    expect(compressed).not.toBeNull();
    expect(compressed?.width).toBe(1);
    expect(compressed?.height).toBe(1);
    const bytes = compressed?.data ?? new Uint8Array();
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WEBP');
  });

  it('returns null instead of throwing on bytes that are not an image', async () => {
    const garbage = new TextEncoder().encode('this is definitely not an image');
    expect(await compressEvidenceImage(garbage)).toBeNull();
  });
});
