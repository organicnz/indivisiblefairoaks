// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

type ChatRequest = {
  messages: Array<{ role: string; content: string }>;
};

function chunkFromRequest(init?: RequestInit) {
  const body = JSON.parse(String(init?.body ?? '{}')) as ChatRequest;
  const prompt = body.messages.find((message) => message.role === 'user')?.content ?? '';
  return prompt.split('PAGE TEXT:\n')[1] ?? '';
}

function chatResponse(content: string, finishReason = 'stop') {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: finishReason }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

function reportJson(text: string, index: number) {
  return JSON.stringify([
    {
      title: `Report ${index}`,
      text,
      publishedAt: null,
      city: 'Fair Oaks',
      stateCode: 'CA',
      kind: 'enforcement',
    },
  ]);
}

function longPage() {
  return Array.from(
    { length: 120 },
    (_, index) =>
      `Report ${index}: Residents reported ICE agents and vehicles near Fair Oaks, CA. ` +
      'Neighbors documented the vehicles from a distance and shared the time with the group. '.repeat(3)
  ).join('\n\n');
}

describe('AI crawler orchestration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('sends every long-page chunk and merges the reports', async () => {
    vi.stubEnv('ZAI_API_KEY', 'test-key');
    vi.resetModules();
    const { extractWithAi } = await import('@/lib/ice-crawl');

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const chunk = chunkFromRequest(init);
      const paragraphs = chunk
        .split('\n\n')
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.includes('Residents reported ICE'));
      return chatResponse(reportJson(paragraphs[0], fetchMock.mock.calls.length));
    });
    vi.stubGlobal('fetch', fetchMock);

    const page = longPage();
    const reports = await extractWithAi(
      page,
      'https://example.org/reports',
      'ICE reports — Example',
      null
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reports).toHaveLength(2);
    expect(reports.every((report) => report.sourceTitle === 'ICE reports — Example')).toBe(true);
    expect(reports.every((report) => report.city === 'Fair Oaks')).toBe(true);
    expect(reports.every((report) => report.stateCode === 'CA')).toBe(true);
  });

  it('splits a chunk when the model hits its output limit', async () => {
    vi.stubEnv('ZAI_API_KEY', 'test-key');
    vi.resetModules();
    const { extractWithAi } = await import('@/lib/ice-crawl');

    let calls = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        return chatResponse('{"reports":[', 'length');
      }
      const chunk = chunkFromRequest(init);
      const paragraphs = chunk
        .split('\n\n')
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.includes('Residents reported ICE'));
      return chatResponse(reportJson(paragraphs[0], calls));
    });
    vi.stubGlobal('fetch', fetchMock);

    const reports = await extractWithAi(
      longPage().slice(0, 12_000),
      'https://example.org/reports',
      'ICE reports — Example',
      null
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(reports).toHaveLength(2);
    expect(reports.every((report) => report.text.includes('Residents reported ICE'))).toBe(true);
  });
});
