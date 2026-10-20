// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `src/config/site.ts` and `src/lib/metadata.ts` both import `@/lib/env`, which
// Zod-parses process.env at module load. `NEXT_SKIP_ENV_VALIDATION=1` is the
// switch env.ts already exposes for this, so the modules can be imported without
// a populated .env. It has to be set before the import is evaluated, hence the
// dynamic import in beforeEach.
async function loadSite(siteUrl: string) {
  vi.resetModules();
  vi.stubEnv('NEXT_SKIP_ENV_VALIDATION', '1');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', siteUrl);
  return {
    site: await import('@/config/site'),
    metadata: await import('@/lib/metadata'),
  };
}

const PRODUCTION = 'https://indivisiblefairoaks.org';
const STAGING = 'https://test.indivisiblefairoaks.org';

describe('site identity', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports the production apex as the production site', async () => {
    const { site } = await loadSite(PRODUCTION);
    expect(site.SITE_URL).toBe(PRODUCTION);
    expect(site.IS_PRODUCTION_SITE).toBe(true);
  });

  it('treats any other host as non-production', async () => {
    const { site } = await loadSite(STAGING);
    expect(site.IS_PRODUCTION_SITE).toBe(false);
  });

  it('does not mistake a lookalike host for production', async () => {
    // The subdomain suffix trap: a naive endsWith check would pass here.
    const { site } = await loadSite('https://evil-indivisiblefairoaks.org');
    expect(site.IS_PRODUCTION_SITE).toBe(false);
  });

  it('strips trailing slashes so joined URLs never double up', async () => {
    const { site } = await loadSite(`${PRODUCTION}/`);
    expect(site.SITE_URL).toBe(PRODUCTION);
    expect(site.siteUrl('/about')).toBe(`${PRODUCTION}/about`);
    expect(site.siteUrl('about')).toBe(`${PRODUCTION}/about`);
    expect(site.siteUrl('/')).toBe(PRODUCTION);
  });

  it('indexes the production apex and noindexes everywhere else', async () => {
    const prod = await loadSite(PRODUCTION);
    expect(prod.site.rootRobots()).toEqual({ index: true, follow: true });

    const staging = await loadSite(STAGING);
    expect(staging.site.rootRobots()).toEqual({ index: false, follow: false });
  });

  it('emits an Organization node with a logo, sameAs and area served', async () => {
    const { site } = await loadSite(PRODUCTION);
    const org = site.organizationJsonLd();

    expect(org['@type']).toBe('NGO');
    expect(org['@id']).toBe(`${PRODUCTION}/#organization`);
    expect(org.url).toBe(PRODUCTION);
    // Google's Article rich results require a publisher logo.
    expect(org.logo).toMatchObject({ width: 512, height: 512 });
    expect(org.logo.url).toMatch(/^https:\/\//);
    expect(org.sameAs).toContain('https://indivisible.org');
    expect(org.areaServed).toEqual(expect.arrayContaining([expect.stringContaining('Carmichael')]));
    expect(org.address).toMatchObject({ addressLocality: 'Carmichael', addressCountry: 'US' });
  });

  it('emits a WebSite node whose SearchAction targets the real search route', async () => {
    const { site } = await loadSite(PRODUCTION);
    const website = site.webSiteJsonLd();
    expect(website['@type']).toBe('WebSite');
    expect(website.potentialAction.target.urlTemplate).toBe(
      `${PRODUCTION}/search?q={search_term_string}`
    );
    // Referencing the org by @id keeps one entity instead of two definitions.
    expect(website.publisher).toEqual({ '@id': `${PRODUCTION}/#organization` });
  });

  it('anchors structured data to the configured host, not a hardcoded one', async () => {
    const { site } = await loadSite(STAGING);
    expect(site.organizationJsonLd().url).toBe(STAGING);
    expect(site.webSiteJsonLd().url).toBe(STAGING);
  });
});

describe('pageMetadata', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('always sets a canonical and a matching og:url', async () => {
    const { metadata } = await loadSite(PRODUCTION);
    const result = metadata.pageMetadata({
      title: 'About',
      description: 'About the chapter.',
      path: '/about',
    });

    // The original bug: a root-level openGraph.url was inherited by every page
    // that declared its own openGraph without a url, so 15+ routes shipped the
    // homepage as their share permalink.
    expect(result.alternates?.canonical).toBe('/about');
    expect(result.openGraph).toMatchObject({ url: `${PRODUCTION}/about`, title: 'About' });
    expect(result.twitter).toMatchObject({ title: 'About', card: 'summary_large_image' });
  });

  it('returns a bare title so the root template can append the brand', async () => {
    const { metadata } = await loadSite(PRODUCTION);
    const result = metadata.pageMetadata({
      title: 'About',
      description: 'About the chapter.',
      path: '/about',
    });
    expect(result.title).toBe('About');
  });

  it('gives every page a social card, defaulting to the root OG image', async () => {
    const { metadata } = await loadSite(PRODUCTION);
    const result = metadata.pageMetadata({ title: 'About', description: 'x', path: '/about' });
    // Without this default, pages that declare their own `openGraph` lose the
    // file-convention image and ship no card at all.
    expect(result.openGraph?.images).toEqual([
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Indivisible Fair Oaks-Carmichael',
      },
    ]);
    expect(result.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(result.twitter?.images).toEqual(['/opengraph-image']);
  });

  it('accepts a bare string, a URL and a single object for images', async () => {
    const { metadata } = await loadSite(PRODUCTION);
    // `og:image` may be a string, a URL, or a descriptor object; all three must
    // survive to the card and unwrap correctly for `twitter.images`.
    const asString = metadata.pageMetadata({
      title: 'A',
      description: 'B',
      path: '/a',
      images: 'https://cdn.example/a.png',
    });
    expect(asString.twitter?.images).toEqual(['https://cdn.example/a.png']);

    const asUrl = metadata.pageMetadata({
      title: 'A',
      description: 'B',
      path: '/a',
      images: new URL('https://cdn.example/a.png'),
    });
    expect(asUrl.twitter?.images).toEqual(['https://cdn.example/a.png']);

    const asList = metadata.pageMetadata({
      title: 'A',
      description: 'B',
      path: '/a',
      images: ['https://cdn.example/a.png', 'https://cdn.example/b.png'],
    });
    expect(asList.twitter?.images).toEqual([
      'https://cdn.example/a.png',
      'https://cdn.example/b.png',
    ]);
  });

  it('lets a page override the default card with its own image', async () => {
    const { metadata } = await loadSite(PRODUCTION);
    const withImage = metadata.pageMetadata({
      title: 'Yard sign',
      description: 'A sign.',
      path: '/products/s',
      images: [{ url: 'https://cdn.example/s.png' }],
    });
    expect(withImage.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(withImage.openGraph?.images).toEqual([{ url: 'https://cdn.example/s.png' }]);
    expect(withImage.twitter?.images).toEqual(['https://cdn.example/s.png']);
  });

  it('carries article timestamps only for article type', async () => {
    const { metadata } = await loadSite(PRODUCTION);
    const article = metadata.pageMetadata({
      title: 'A post',
      description: 'Body.',
      path: '/a-post',
      type: 'article',
      publishedTime: '2026-01-01T00:00:00.000Z',
      modifiedTime: '2026-02-01T00:00:00.000Z',
      authors: ['Indivisible Fair Oaks-Carmichael'],
    });
    expect(article.openGraph).toMatchObject({
      type: 'article',
      publishedTime: '2026-01-01T00:00:00.000Z',
      modifiedTime: '2026-02-01T00:00:00.000Z',
    });

    const page = metadata.pageMetadata({ title: 'A page', description: 'Body.', path: '/a-page' });
    expect(page.openGraph).not.toHaveProperty('publishedTime');
  });

  it('inherits the staging noindex unless explicitly overridden', async () => {
    const staging = await loadSite(STAGING);
    expect(
      staging.metadata.pageMetadata({ title: 'A', description: 'B', path: '/a' }).robots
    ).toEqual({ index: false, follow: false });

    const production = await loadSite(PRODUCTION);
    expect(
      production.metadata.pageMetadata({ title: 'A', description: 'B', path: '/a' }).robots
    ).toEqual({ index: true, follow: true });
  });

  it('noindexes private surfaces', async () => {
    const { metadata } = await loadSite(PRODUCTION);
    const result = metadata.privateMetadata({
      title: 'Your Cart',
      description: 'Review your items.',
      path: '/cart',
    });
    expect(result.robots).toEqual({ index: false, follow: false });
  });
});

describe('metaDescription', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('leaves short text untouched', async () => {
    const { metadata } = await loadSite(PRODUCTION);
    expect(metadata.metaDescription('Short and sweet')).toBe('Short and sweet');
  });

  it('collapses whitespace', async () => {
    const { metadata } = await loadSite(PRODUCTION);
    expect(metadata.metaDescription('a\n\n  b\tc')).toBe('a b c');
  });

  it('truncates on a word boundary and appends an ellipsis', async () => {
    const { metadata } = await loadSite(PRODUCTION);
    const input = `${'word '.repeat(60)}end`;
    const result = metadata.metaDescription(input, 40);
    expect(result.length).toBeLessThanOrEqual(41);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toMatch(/wor…$/);
  });

  it('does not cut mid-word when there is no usable space', async () => {
    const { metadata } = await loadSite(PRODUCTION);
    const result = metadata.metaDescription('x'.repeat(200), 20);
    expect(result).toBe(`${'x'.repeat(20)}…`);
  });
});
