// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFetchMock } from './fetch-mock';

const DHS_PAGE = [
  'Measuring CX and SD | Homeland Security',
  'Skip to main content',
  'An official website of the United States government',
  'Here’s how you know',
  'Official websites use .gov',
  'Press Enter to Search',
  'Open Menu',
  'Topics',
  'Immigration and Customs Enforcement',
  'Law Enforcement',
  'Measuring CX and SD',
  'Learn how to measure customer experience and the quality of government service delivery.',
  'Last Updated: 08/31/2026',
  'Was this page helpful?',
  'Yes',
  'No',
].join('\n');

const ICE_PAGE = [
  'ICE Boston operation takes 8 dangerous alien gang members off the streets | ICE',
  'Skip to main content',
  'Topics',
  'Immigration and Customs Enforcement',
  'News',
  'Release Date',
  'ICE agents arrested eight people in Boston, MA during a multi-agency operation.',
  'The agency said the arrests followed a months-long investigation.',
  'Was this page helpful?',
].join('\n');

const ICE_NAV_PAGE = [
  'ICE Boston operation takes 8 dangerous alien gang members off the streets | ICE',
  'Quick Links',
  'Menu',
  'Main Navigation',
  'About Us',
  'Enforcement and Removal Operations',
  'Homeland Security Investigations',
  'Newsroom',
  'Media Inquiries',
  'Share on Facebook',
  'Print this Page',
  'November 16, 2026Boston, MA, United StatesEnforcement and Removal',
  'ICE Boston operation takes 8 dangerous alien gang members off the streets',
  'ICE agents arrested eight people in Boston, MA during a multi-agency operation.',
  'Was this page helpful?',
].join('\n');

const LONG_ICE_PAGE = [
  'ICE Boston operation takes 8 dangerous alien gang members off the streets | ICE',
  'Skip to main content',
  'Topics',
  'Immigration and Customs Enforcement',
  'News',
  'Release Date',
  'ICE agents arrested eight people in Boston, MA during a multi-agency operation.',
  'The agency said the arrests followed a months-long investigation into a network that allegedly moved people across state lines.',
  'Officials said the operation involved several federal and local partners and that no one was injured.',
  'The source did not identify the people taken into custody or describe the charges they may face.',
  'Was this page helpful?',
].join('\n');

const GOOD_DIGEST = [
  'Federal immigration authorities took eight people into custody in Boston, Massachusetts, during a coordinated operation, officials said.',
  'The action followed a months-long inquiry, according to the agency, which said several federal and local partners took part. No injuries were reported, and the source did not identify those detained or describe possible charges.',
].join('\n\n');

const FACTUAL_SOURCE =
  'Over the weekend, U.S. Customs and Border Protection Air and Marine Operations agents, U.S. Border Patrol agents, U.S. Coast Guard crews and military partners intercepted four separate maritime smuggling vessels off the Southern California coast, apprehending 81 people.';
const FACTUAL_DIGEST = [
  'Federal agents stopped four boats carrying 81 people off Southern California, the agency said.',
  'The account described how military partners intercepted four separate maritime smuggling vessels off the Southern California coast. It said the incidents occurred over one weekend and involved several agencies.',
  'No injuries were reported. The source did not identify the people taken into custody or describe the charges they may face.',
].join('\n\n');

const CBP_SOURCE = [
  'Over the weekend, U.S. Customs and Border Protection Air and Marine Operations agents, U.S. Border Patrol agents, U.S. Coast Guard crews and military partners intercepted four separate maritime smuggling vessels off the Southern California coast, apprehending 81 people.',
  'The enforcement actions began at 12:45 p.m. on Saturday, Nov. 7, when Air and Marine Operations crews and partners simultaneously interdicted two vessels off the coast of Catalina Island.',
].join(' ');
const CBP_DIGEST = CBP_SOURCE.replace('Over the weekend,', 'During the weekend,');
const LIGHTLY_EDITED_CBP_DIGEST =
  'U.S. Customs and Border Protection (CBP) and partner agencies intercepted four maritime smuggling vessels off Southern California over the weekend, apprehending a total of 81 people. The operations began at 12:45 p.m. on Saturday, Nov. 7, when Air and Marine Operations crews and naval partners simultaneously interdicted two vessels near Catalina Island.';

describe('source text refinement', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('removes known navigation and truncates the feedback survey', async () => {
    const { cleanSourceTextFallback } = await import('@/lib/ice-source-refine');
    const cleaned = cleanSourceTextFallback(DHS_PAGE);
    expect(cleaned).toContain('Measuring CX and SD');
    expect(cleaned).toContain('Learn how to measure customer experience');
    expect(cleaned).not.toContain('Skip to main content');
    expect(cleaned).not.toContain('Immigration and Customs Enforcement');
    expect(cleaned).not.toContain('Was this page helpful?');
  });

  it('starts ICE pages at the article toolbar instead of the site navigation', async () => {
    const { cleanSourceTextFallback } = await import('@/lib/ice-source-refine');
    const cleaned = cleanSourceTextFallback(ICE_NAV_PAGE);
    expect(cleaned).toContain('November 16, 2026');
    expect(cleaned).toContain('ICE agents arrested eight people');
    expect(cleaned).not.toContain('Quick Links');
    expect(cleaned).not.toContain('Main Navigation');
    expect(cleaned).not.toContain('Print this Page');
    expect(cleaned).not.toContain('Was this page helpful?');
  });

  it('recognizes an article and rejects a generic agency page or statistics page', async () => {
    const { isLikelySourceReport } = await import('@/lib/ice-source-refine');
    expect(isLikelySourceReport(ICE_PAGE)).toBe(true);
    expect(isLikelySourceReport(DHS_PAGE)).toBe(false);
    expect(
      isLikelySourceReport(
        'Custody and Transfer Statistics\nFiscal Year 2027\nICE ERO custody totals by month.'
      )
    ).toBe(false);
    expect(
      isLikelySourceReport(
        'Law Enforcement\nImmigration and Customs Enforcement\nICE agents arrested eight people.'
      )
    ).toBe(false);
    expect(
      isLikelySourceReport(
        'Civil Rights and Civil Liberties Results and Reports\nICE enforcement reports and statistics.'
      )
    ).toBe(false);
  });

  it('asks the AI endpoint for every HTML page and whole-page fallback', async () => {
    const { shouldRefineSourceText } = await import('@/lib/ice-source-refine');
    expect(shouldRefineSourceText('fallback', 'short')).toBe(true);
    expect(shouldRefineSourceText('feed', DHS_PAGE)).toBe(false);
    expect(shouldRefineSourceText('ai', DHS_PAGE)).toBe(false);
    expect(shouldRefineSourceText('html', DHS_PAGE)).toBe(true);
    expect(shouldRefineSourceText('html', 'A short clean article body.')).toBe(true);
    expect(shouldRefineSourceText('html', 'x'.repeat(4_001))).toBe(true);
  });

  it('calls the Supabase endpoint and only accepts grounded refined text', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'service-key');
    vi.resetModules();
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            isReport: true,
            text: 'ICE agents arrested eight people in Boston, MA during a multi-agency operation.\nThe agency said the arrests followed a months-long investigation.',
            generatedBy: 'ai',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    );
    installFetchMock(fetchMock);

    const { refineSourceTextWithAi } = await import('@/lib/ice-source-refine');
    const result = await refineSourceTextWithAi({
      text: ICE_PAGE,
      sourceUrl: 'https://www.ice.gov/news/releases/example',
      sourceTitle: 'ICE Boston operation',
    });

    expect(result?.isReport).toBe(true);
    expect(result?.text).toContain('months-long investigation');
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://project.supabase.co/functions/v1/ice-source-refine');
    const body = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));
    expect(body.text).toContain('ICE agents arrested');
    expect(body.text).not.toContain('Skip to main content');
    expect(body.sourceUrl).toBe('https://www.ice.gov/news/releases/example');
  });

  it('rejects a model response that contains text not present in the source', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'service-key');
    vi.resetModules();
    installFetchMock(
      vi.fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
          new Response(
            JSON.stringify({
              isReport: true,
              text: 'ICE agents arrested three people in a location that is not in the source.',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
      )
    );

    const { refineSourceTextWithAi } = await import('@/lib/ice-source-refine');
    expect(await refineSourceTextWithAi({ text: ICE_PAGE })).toBeNull();
  });

  it('requests a paraphrased digest and accepts it only after safety checks', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'service-key');
    vi.resetModules();
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ isReport: true, text: GOOD_DIGEST, generatedBy: 'ai', mode: 'refine' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    );
    installFetchMock(fetchMock);

    const { refineSourceReportWithAi } = await import('@/lib/ice-source-refine');
    const result = await refineSourceReportWithAi({
      text: LONG_ICE_PAGE,
      sourceUrl: 'https://www.ice.gov/news/releases/example',
      sourceTitle: 'ICE Boston operation',
    });

    expect(result).toEqual({ isReport: true, text: GOOD_DIGEST });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://project.supabase.co/functions/v1/ice-source-refine');
    const body = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));
    expect(body.mode).toBe('refine');
    expect(body.text).toContain('ICE agents arrested');
  });

  it('sends the complete source text instead of stopping at the old 24k cap', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'service-key');
    vi.resetModules();
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ isReport: true, text: GOOD_DIGEST, generatedBy: 'ai', mode: 'refine' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    );
    installFetchMock(fetchMock);

    const filler = Array.from(
      { length: 500 },
      (_, index) => `Supporting source line ${index} with background that follows the report.`
    ).join('\n');
    const longSource = `${LONG_ICE_PAGE.replace('\nWas this page helpful?', '')}\n${filler}\nEND-OF-SOURCE-MARKER`;
    expect(longSource.length).toBeGreaterThan(24_000);

    const { refineSourceReportWithAi } = await import('@/lib/ice-source-refine');
    const result = await refineSourceReportWithAi({
      text: longSource,
      sourceUrl: 'https://www.ice.gov/news/releases/example',
      sourceTitle: 'ICE Boston operation',
    });

    expect(result).toEqual({ isReport: true, text: GOOD_DIGEST });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));
    expect(body.text).toContain('END-OF-SOURCE-MARKER');
    expect(body.text.length).toBeGreaterThan(24_000);
  });

  it('rejects a digest that copies the source or invents a number', async () => {
    const { isSafeSourceDigest } = await import('@/lib/ice-source-refine');
    const copied = LONG_ICE_PAGE.split('\n').slice(6, 10).join(' ');
    expect(isSafeSourceDigest(LONG_ICE_PAGE, copied)).toBe(false);
    expect(
      isSafeSourceDigest(
        LONG_ICE_PAGE,
        'Federal immigration agents detained 17 people in Boston, MA during a multi-agency operation, the agency said.\n\nThe agency said the arrests followed a months-long investigation.'
      )
    ).toBe(false);

    expect(
      isSafeSourceDigest(
        LONG_ICE_PAGE,
        'Federal immigration authorities took eight people into custody in Boston, Massachusetts, during a coordinated operation, officials said.\n\nThe action followed a months-long inquiry, according to the agency, which said several federal and local partners took part. No injuries were reported.'
      )
    ).toBe(true);
    expect(isSafeSourceDigest(FACTUAL_SOURCE, FACTUAL_DIGEST)).toBe(true);
    expect(isSafeSourceDigest(CBP_SOURCE, CBP_DIGEST)).toBe(false);
    expect(isSafeSourceDigest(CBP_SOURCE, LIGHTLY_EDITED_CBP_DIGEST)).toBe(false);
  });
});
