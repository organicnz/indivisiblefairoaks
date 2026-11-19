// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getIceCrawlStore = vi.hoisted(() => vi.fn());
const getSourceReportForRefinement = vi.hoisted(() => vi.fn());
const saveSourceReportRefinement = vi.hoisted(() => vi.fn());
const refineSourceReportWithAi = vi.hoisted(() => vi.fn());

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, connection: vi.fn(async () => undefined) };
});

vi.mock('@/lib/ice-crawl-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ice-crawl-store')>();
  return {
    ...actual,
    getIceCrawlStore,
    getSourceReportForRefinement,
    saveSourceReportRefinement,
  };
});

vi.mock('@/lib/ice-source-refine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ice-source-refine')>();
  return { ...actual, refineSourceReportWithAi };
});

const { POST } = await import('@/app/api/ice-source-reports/refine/route');

const ID = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f';
const DIGEST = [
  'Federal immigration authorities took eight people into custody in Boston, Massachusetts, during a coordinated operation, officials said.',
  'The action followed a months-long inquiry, according to the agency, which said several federal and local partners took part. No injuries were reported, and the source did not identify those detained or describe possible charges.',
].join('\n\n');

const COPIED_DIGEST = [
  'ICE agents arrested eight people in Boston, MA during a multi-agency operation.',
  'The agency said the arrests followed a months-long investigation into a network that allegedly moved people across state lines.',
  'Officials said the operation involved several federal and local partners and that no one was injured.',
].join(' ');

const REPORT = {
  id: ID,
  source_url: 'https://www.ice.gov/news/releases/example',
  source_title: 'ICE Boston operation',
  title: 'ICE Boston operation',
  text_content: [
    'ICE agents arrested eight people in Boston, MA during a multi-agency operation.',
    'The agency said the arrests followed a months-long investigation into a network that allegedly moved people across state lines.',
    'Officials said the operation involved several federal and local partners and that no one was injured.',
    'The source did not identify the people taken into custody or describe the charges they may face.',
  ].join(' '),
  refined_text: null,
  refined_at: null,
};

function request(body: unknown) {
  return new Request('http://localhost/api/ice-source-reports/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ice-source-reports/refine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIceCrawlStore.mockReturnValue({});
    getSourceReportForRefinement.mockResolvedValue(REPORT);
    saveSourceReportRefinement.mockResolvedValue(true);
    refineSourceReportWithAi.mockResolvedValue({ isReport: true, text: DIGEST });
  });

  it('rejects an invalid report id before touching the archive', async () => {
    const response = await POST(request({ id: 'not-a-uuid' }));

    expect(response.status).toBe(400);
    expect(getSourceReportForRefinement).not.toHaveBeenCalled();
  });

  it('returns a previously cached digest only when it still passes the copy checks', async () => {
    getSourceReportForRefinement.mockResolvedValue({
      ...REPORT,
      refined_text: DIGEST,
      refined_at: '2026-11-19T12:00:00.000Z',
    });

    const response = await POST(request({ id: ID }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      text: DIGEST,
      refinedAt: '2026-11-19T12:00:00.000Z',
      cached: true,
    });
    expect(JSON.stringify(payload)).not.toContain(REPORT.text_content);
    expect(refineSourceReportWithAi).not.toHaveBeenCalled();
  });

  it('regenerates a cached digest that copied the source instead of serving it', async () => {
    getSourceReportForRefinement.mockResolvedValue({
      ...REPORT,
      refined_text: COPIED_DIGEST,
      refined_at: '2026-11-19T12:00:00.000Z',
    });

    const response = await POST(request({ id: ID }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, text: DIGEST, cached: false });
    expect(JSON.stringify(payload)).not.toContain(COPIED_DIGEST);
    expect(refineSourceReportWithAi).toHaveBeenCalledWith({
      text: REPORT.text_content,
      sourceUrl: REPORT.source_url,
      sourceTitle: REPORT.source_title,
    });
    expect(saveSourceReportRefinement).toHaveBeenCalledWith({}, ID, DIGEST, expect.any(String));
  });

  it('never falls back to an unsafe cached digest when regeneration fails', async () => {
    getSourceReportForRefinement.mockResolvedValue({
      ...REPORT,
      refined_text: COPIED_DIGEST,
      refined_at: '2026-11-19T12:00:00.000Z',
    });
    refineSourceReportWithAi.mockResolvedValueOnce(null);

    const response = await POST(request({ id: ID }));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(JSON.stringify(payload)).not.toContain(COPIED_DIGEST);
    expect(saveSourceReportRefinement).not.toHaveBeenCalled();
  });

  it('generates, caches and returns a new digest', async () => {
    const response = await POST(request({ id: ID }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, text: DIGEST, cached: false });
    expect(JSON.stringify(payload)).not.toContain(REPORT.text_content);
    expect(refineSourceReportWithAi).toHaveBeenCalledWith({
      text: REPORT.text_content,
      sourceUrl: REPORT.source_url,
      sourceTitle: REPORT.source_title,
    });
    expect(saveSourceReportRefinement).toHaveBeenCalledWith({}, ID, DIGEST, expect.any(String));
  });

  it('does not fall back to raw text when refinement fails', async () => {
    refineSourceReportWithAi.mockResolvedValue(null);

    const response = await POST(request({ id: ID }));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toMatchObject({ ok: false, code: 'refinement-unavailable' });
    expect(JSON.stringify(payload)).not.toContain(REPORT.text_content);
    expect(saveSourceReportRefinement).not.toHaveBeenCalled();
  });

  it('returns a clear non-report result and does not cache it', async () => {
    refineSourceReportWithAi.mockResolvedValue({ isReport: false, text: '' });

    const response = await POST(request({ id: ID }));
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload).toMatchObject({ ok: false, code: 'not-a-report' });
    expect(saveSourceReportRefinement).not.toHaveBeenCalled();
  });
});
