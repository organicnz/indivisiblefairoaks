import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import type { CityPoint } from '@/components/ice-alerts/types';
import { env } from '@/lib/env';
import {
  classifyReportKind,
  cleanTitle,
  extractCityState,
  extractFeedItems,
  extractFeedLinks,
  extractHtmlReport,
  extractPublishedAt,
  extractSameOriginLinks,
  extractStopIceReports,
  extractTitle,
  isIceReportText,
  normalizeText,
  readableText,
  verbatimExcerpt,
  type ExtractedReport,
} from '@/lib/ice-crawl-extract';
import {
  getIceCrawlSource,
  getIceCrawlStore,
  insertIceSourceReports,
  listIceCityPoints,
  listIceCrawlSources,
  updateIceCrawlPageReportCount,
  updateIceCrawlSource,
  upsertIceCrawlPage,
  type IceCrawlStore,
} from '@/lib/ice-crawl-store';
import type {
  IceCrawlSource,
  IceCrawlSummary,
  IceSourceReportKind,
} from '@/lib/ice-crawl-types';

const USER_AGENT =
  'IndivisibleFairOaks-ReportCrawler/1.0 (+https://indivisiblefairoaks.org; source-attributed report archive)';
const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const MAX_DEPTH = 1;
const MAX_QUEUE_LINKS = 60;
const MAX_AI_CHARS = 24_000;
const MAX_STORED_SOURCE_CHARS = 500_000;
const ZAI_ENDPOINT = 'https://api.z.ai/api/paas/v4/chat/completions';
const ZAI_MODEL = 'glm-4.5-flash';

type FetchedPage = {
  finalUrl: string;
  status: number;
  contentType: string;
  text: string;
};

type QueueItem = { url: string; depth: number };

type AiReport = {
  title?: unknown;
  text?: unknown;
  publishedAt?: unknown;
  city?: unknown;
  stateCode?: unknown;
  kind?: unknown;
};

const robotsCache = new Map<string, string[]>();
const STOPICE_MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const;

/**
 * StopICE publishes one XML file per month. Its public home page is the stable
 * source URL an admin adds, but fetching that large page wastes the page budget;
 * resolve it to the current export, with the previous two months as fallbacks
 * for the first days of a new month.
 */
export function resolveCrawlUrls(rawUrl: string, now = new Date()): string[] {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return [rawUrl];
  }
  const isStopIce =
    parsed.hostname === 'stopice.net' || parsed.hostname === 'www.stopice.net';
  if (!isStopIce || (parsed.pathname !== '/' && !parsed.searchParams.has('data'))) {
    return [rawUrl];
  }

  return [0, 1, 2].map((offset) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    return `https://stopice.net/login/data/stats/stopicenet_${STOPICE_MONTHS[date.getUTCMonth()]}_${date.getUTCFullYear()}_complete.xml`;
  });
}

function isPrivateIpv4(value: string) {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  if (parts[0] === 0 || parts[0] === 10 || parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
  if (parts[0] >= 224) return true;
  return false;
}

export function isPrivateAddress(value: string) {
  const address = value.toLowerCase().split('%')[0];
  if (address.includes(':')) {
    return (
      address === '::1' ||
      address === '::' ||
      address.startsWith('fe8') ||
      address.startsWith('fe9') ||
      address.startsWith('fea') ||
      address.startsWith('feb') ||
      address.startsWith('fc') ||
      address.startsWith('fd') ||
      address.startsWith('::ffff:127.') ||
      address.startsWith('::ffff:10.') ||
      address.startsWith('::ffff:192.168.')
    );
  }
  return isPrivateIpv4(address);
}

async function assertPublicUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only public http(s) URLs are supported.');
  }
  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not supported.');
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new Error('Only standard public web ports are supported.');
  }

  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost') ||
    host === '0.0.0.0' ||
    host === '[::1]'
  ) {
    throw new Error('Private or local network targets are not allowed.');
  }

  const addresses = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
    ? [{ address: host }]
    : await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('The source resolves to a private network address.');
  }

  return url;
}

function timeoutSignal() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return { controller, timer };
}

async function fetchPublicPage(rawUrl: string, maxBytes = MAX_BYTES): Promise<FetchedPage> {
  let current = await assertPublicUrl(rawUrl);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const { controller, timer } = timeoutSignal();
    try {
      const response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html, application/xhtml+xml, application/rss+xml, application/xml, application/json;q=0.9, */*;q=0.5',
          'User-Agent': USER_AGENT,
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error(`Source redirected without a location (${response.status}).`);
        current = await assertPublicUrl(new URL(location, current).toString());
        continue;
      }

      if (!response.ok) {
        throw new Error(`Source returned HTTP ${response.status}.`);
      }

      const contentLength = Number(response.headers.get('content-length') ?? 0);
      if (contentLength > maxBytes) {
        throw new Error('Source page is larger than the crawler limit.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Source returned no response body.');
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error('Source page is larger than the crawler limit.');
        }
        chunks.push(value);
      }

      const text = new TextDecoder().decode(
        chunks.length === 1 ? chunks[0] : new Uint8Array(chunks.flatMap((chunk) => [...chunk]))
      );
      return {
        finalUrl: current.toString(),
        status: response.status,
        contentType: response.headers.get('content-type') ?? '',
        text,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Source redirected too many times.');
}

function parseRobots(content: string) {
  const disallow: string[] = [];
  let applies = false;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      applies = value === '*';
      continue;
    }
    if (applies && key === 'disallow' && value) {
      disallow.push(value);
    }
  }
  return disallow;
}

async function robotsAllows(target: URL) {
  const origin = target.origin;
  let rules = robotsCache.get(origin);
  if (!rules) {
    try {
      const response = await fetchPublicPage(`${origin}/robots.txt`, 120_000);
      rules = parseRobots(response.text);
    } catch {
      rules = [];
    }
    robotsCache.set(origin, rules);
  }
  return !rules.some((rule) => target.pathname.startsWith(rule));
}

async function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function safeSourceUrl(value: string, fallback: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function parseKind(value: unknown, text: string): IceSourceReportKind {
  if (value === 'enforcement' || value === 'detention' || value === 'checkpoint' || value === 'other') {
    return value;
  }
  return classifyReportKind(text);
}

function aiReportToExtracted(
  value: AiReport,
  pageUrl: string,
  pageText: string,
  pagePublishedAt: string | null,
  fallbackTitle: string
): ExtractedReport | null {
  const text = typeof value.text === 'string' ? normalizeText(value.text) : '';
  const title = typeof value.title === 'string' ? value.title : fallbackTitle;
  if (text.length < 40 || !verbatimExcerpt(pageText, text)) return null;

  const rawCity = typeof value.city === 'string' ? value.city.trim() : '';
  const rawState = typeof value.stateCode === 'string' ? value.stateCode.trim().toUpperCase() : '';
  const dateValue = typeof value.publishedAt === 'string' ? value.publishedAt : '';
  const parsedDate = dateValue ? new Date(dateValue) : null;

  return {
    title: cleanTitle(title, 'Source report'),
    text: text.slice(0, MAX_STORED_SOURCE_CHARS),
    sourceUrl: pageUrl,
    publishedAt:
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toISOString()
        : pagePublishedAt,
    city: rawCity.length >= 2 && rawCity.length <= 80 ? rawCity : null,
    stateCode: /^[A-Z]{2}$/.test(rawState) ? rawState : null,
    kind: parseKind(value.kind, `${title} ${text}`),
  };
}

function parseAiJson(content: string): AiReport[] {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is AiReport => Boolean(entry) && typeof entry === 'object').slice(0, 20);
  } catch {
    return [];
  }
}

async function extractWithAi(
  pageText: string,
  pageUrl: string,
  pageTitle: string,
  pagePublishedAt: string | null
): Promise<ExtractedReport[]> {
  const key = env.ZAI_API_KEY;
  if (!key || pageText.length > MAX_AI_CHARS) return [];

  const { controller, timer } = timeoutSignal();
  try {
    const response = await fetch(ZAI_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ZAI_MODEL,
        temperature: 0.1,
        max_tokens: 1_500,
        messages: [
          {
            role: 'system',
            content:
              'You extract only source-grounded ICE/immigration enforcement reports. Return a JSON array only. Each item must contain title, text (a verbatim contiguous excerpt from the page), publishedAt (ISO or null), city (string or null), stateCode (two-letter code or null), and kind (enforcement|detention|checkpoint|other). Do not summarize, invent, or paraphrase. If the page contains no report, return [].',
          },
          {
            role: 'user',
            content: `URL: ${pageUrl}\nTITLE: ${pageTitle}\nPAGE TEXT:\n${pageText}`,
          },
        ],
      }),
    });

    if (!response.ok) return [];
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return [];

    return parseAiJson(content)
      .map((entry) =>
        aiReportToExtracted(entry, pageUrl, pageText, pagePublishedAt, pageTitle)
      )
      .filter((entry): entry is ExtractedReport => Boolean(entry));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function publishReports(
  store: IceCrawlStore,
  source: IceCrawlSource,
  pageId: string,
  pageUrl: string,
  reports: ExtractedReport[],
  method: 'feed' | 'html' | 'ai' | 'fallback'
) {
  const retrievedAt = new Date().toISOString();
  const seen = new Set<string>();
  const rows: Parameters<typeof insertIceSourceReports>[1] = [];

  for (const report of reports) {
    const text = normalizeText(report.text).slice(0, MAX_STORED_SOURCE_CHARS);
    if (text.length < 20) continue;
    const sourceUrl = safeSourceUrl(report.sourceUrl, pageUrl);
    const dedupeKey = await sha256(`${source.id}|${sourceUrl}|${text}`);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    rows.push({
      source_id: source.id,
      page_id: pageId,
      source_name: source.label,
      source_url: sourceUrl,
      source_title: null,
      source_published_at: report.publishedAt,
      source_retrieved_at: retrievedAt,
      title: cleanTitle(report.title, 'Source report'),
      text_content: text,
      city: report.city,
      state_code: report.stateCode,
      kind: report.kind,
      extraction_method: method,
      dedupe_key: dedupeKey,
      published_at: report.publishedAt ?? retrievedAt,
    });
  }

  return insertIceSourceReports(store, rows);
}

function isFeedResponse(page: FetchedPage) {
  return (
    /rss|atom|xml/i.test(page.contentType) ||
    /<rss\b|<feed\b|<\?xml\b/i.test(page.text.slice(0, 500))
  );
}

function pageTextForStorage(html: string) {
  const text = readableText(html);
  return text.slice(0, MAX_STORED_SOURCE_CHARS);
}

/**
 * Crawl one admin-approved source. Every discovered URL is either fetched and
 * stored or counted as skipped; a page limit or robots block is reported as a
 * partial run rather than disappearing.
 */
async function loadCrawlCities(store: IceCrawlStore): Promise<CityPoint[]> {
  try {
    const points = await listIceCityPoints(store);
    return points.map((point) => ({
      city: point.city,
      state: point.state,
      stateCode: point.stateCode,
      lat: point.lat,
      lng: point.lng,
      count: point.count,
    }));
  } catch {
    // A missing city snapshot must not stop a source crawl; the textual
    // fallback still preserves a state code when one is visible.
    return [];
  }
}

export async function crawlIceSource(
  source: IceCrawlSource,
  cities: readonly CityPoint[] = []
): Promise<IceCrawlSummary> {
  const store = getIceCrawlStore();
  if (!store) throw new Error('Crawler storage is not configured.');

  const now = new Date().toISOString();
  const startUrls = resolveCrawlUrls(source.url);
  const queue: QueueItem[] = startUrls.map((url) => ({ url, depth: 0 }));
  const queued = new Set(startUrls);
  const visited = new Set<string>();
  const errors: string[] = [];
  let pagesFetched = 0;
  let reportsFound = 0;
  let skipped = 0;
  let discovered = startUrls.length;

  while (queue.length > 0) {
    if (pagesFetched >= source.max_pages) break;
    const item = queue.shift();
    if (!item) break;
    if (visited.has(item.url)) {
      skipped += 1;
      continue;
    }
    visited.add(item.url);

    let target: URL;
    try {
      target = await assertPublicUrl(item.url);
    } catch (error) {
      skipped += 1;
      errors.push(error instanceof Error ? error.message : 'Invalid URL.');
      continue;
    }

    if (!(await robotsAllows(target))) {
      skipped += 1;
      errors.push(`Blocked by robots.txt: ${target.toString()}`);
      try {
        await upsertIceCrawlPage(store, source.id, {
          url: item.url,
          error: 'Blocked by robots.txt.',
          fetched_at: now,
        });
      } catch {
        // The run summary still records the blocked URL.
      }
      continue;
    }

    let page: FetchedPage;
    try {
      page = await fetchPublicPage(item.url);
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : 'Fetch failed.';
      errors.push(`${item.url}: ${message}`);
      try {
        await upsertIceCrawlPage(store, source.id, {
          url: item.url,
          error: message.slice(0, 500),
          fetched_at: now,
        });
      } catch {
        // Continue crawling independent pages.
      }
      continue;
    }

    pagesFetched += 1;
    const feed = isFeedResponse(page);
    let reports: ExtractedReport[] = [];
    let method: 'feed' | 'html' | 'ai' | 'fallback' = 'fallback';
    let pageTitle = '';

    if (feed) {
      const stopIceItems = /<report_data>/i.test(page.text)
        ? extractStopIceReports(page.text, page.finalUrl, cities)
        : [];
      const items = stopIceItems.length > 0
        ? stopIceItems
        : extractFeedItems(page.text, page.finalUrl, cities);
      reports = items.map((item) => ({
        title: item.title,
        text: item.text,
        sourceUrl: item.sourceUrl,
        publishedAt: item.publishedAt,
        city: item.city,
        stateCode: item.stateCode,
        kind: item.kind,
      }));
      method = 'feed';
      pageTitle = extractTitle(page.text);
    } else {
      pageTitle = extractTitle(page.text);
      const text = pageTextForStorage(page.text);
      const publishedAt = extractPublishedAt(page.text);
      const aiReports = await extractWithAi(text, page.finalUrl, pageTitle, publishedAt);
      if (aiReports.length > 0) {
        reports = aiReports;
        method = 'ai';
      } else {
        const report = extractHtmlReport(page.text, page.finalUrl, cities);
        if (report) {
          reports = [report];
          method = 'html';
        }
      }

      if (text && (reports.length > 0 || isIceReportText(text))) {
        // Keep the complete readable page as a fallback if extraction found
        // nothing but the page clearly discusses an ICE report.
        if (reports.length === 0 && text.length >= 40) {
          const cityState = extractCityState(`${pageTitle}\n${text}`, cities);
          reports = [
            {
              title: cleanTitle(pageTitle, 'Source report'),
              text,
              sourceUrl: page.finalUrl,
              publishedAt,
              city: cityState.city,
              stateCode: cityState.stateCode,
              kind: classifyReportKind(`${pageTitle}\n${text}`),
            },
          ];
          method = 'fallback';
        }
      }

      for (const link of extractFeedLinks(page.text, page.finalUrl).slice(0, 3)) {
        if (!queued.has(link)) {
          queued.add(link);
          discovered += 1;
          queue.push({ url: link, depth: 0 });
        }
      }

      if (item.depth < MAX_DEPTH) {
        const links = extractSameOriginLinks(page.text, page.finalUrl)
          .filter((link) => !/\.(?:jpg|jpeg|png|gif|webp|pdf|zip|mp4|mov|svg)(?:\?|$)/i.test(link))
          .slice(0, MAX_QUEUE_LINKS);
        for (const link of links) {
          if (!queued.has(link)) {
            queued.add(link);
            discovered += 1;
            queue.push({ url: link, depth: item.depth + 1 });
          }
        }
      }
    }

    let pageId: string;
    try {
      const storedPage = await upsertIceCrawlPage(store, source.id, {
        url: item.url,
        final_url: page.finalUrl,
        http_status: page.status,
        content_type: page.contentType.slice(0, 200),
        content_hash: await sha256(page.text),
        title: pageTitle || null,
        text_content: feed ? null : pageTextForStorage(page.text),
        extraction_method: method,
        report_count: reports.length,
        fetched_at: now,
      });
      pageId = storedPage.id;
    } catch (error) {
      errors.push(
        `${item.url}: ${error instanceof Error ? error.message : 'Page could not be stored.'}`
      );
      continue;
    }

    if (reports.length > 0) {
      try {
        const inserted = await publishReports(
          store,
          source,
          pageId,
          page.finalUrl,
          reports,
          method
        );
        reportsFound += inserted;
      } catch (error) {
        errors.push(
          `${item.url}: ${error instanceof Error ? error.message : 'Reports could not be stored.'}`
        );
      }
    }
    try {
      await updateIceCrawlPageReportCount(store, pageId, reports.length);
    } catch {
      // The run summary still carries the observed count.
    }
  }

  if (queue.length > 0) {
    skipped += queue.length;
    errors.push(
      `Page limit reached with ${queue.length} discovered URL(s) not fetched. Increase the source page limit to continue.`
    );
  }

  const status: IceCrawlSummary['status'] =
    pagesFetched === 0 && errors.length > 0
      ? 'error'
      : skipped > 0
        ? 'partial'
        : 'ok';
  const note =
    status === 'ok'
      ? `Fetched ${pagesFetched} page(s) and stored ${reportsFound} source report(s).`
      : status === 'partial'
        ? `Fetched ${pagesFetched} page(s); ${skipped} discovered URL(s) were skipped or left unfetched.`
        : `No pages could be fetched; ${errors[0] ?? 'the source is unavailable'}.`;

  try {
    await updateIceCrawlSource(store, source.id, {
      last_crawled_at: now,
      last_status: status,
      last_error: errors[0]?.slice(0, 500) ?? null,
      last_page_count: pagesFetched,
      last_report_count: reportsFound,
    });
  } catch {
    // The crawl result is still returned to the caller.
  }

  return {
    status,
    pagesFetched,
    reportsFound,
    discovered,
    skipped,
    errors: errors.slice(0, 20),
    note,
  };
}

export async function crawlIceSourceById(id: string) {
  const store = getIceCrawlStore();
  if (!store) throw new Error('Crawler storage is not configured.');
  const source = await getIceCrawlSource(store, id);
  if (!source) throw new Error('Source not found.');
  const cities = await loadCrawlCities(store);
  return crawlIceSource(source, cities);
}

export async function crawlAllIceSources() {
  const store = getIceCrawlStore();
  if (!store) throw new Error('Crawler storage is not configured.');
  const sources = (await listIceCrawlSources(store)).filter((source) => source.enabled);
  const cities = await loadCrawlCities(store);
  const results: Array<{ source: string; summary: IceCrawlSummary | { error: string } }> = [];

  for (const source of sources) {
    try {
      results.push({ source: source.label, summary: await crawlIceSource(source, cities) });
    } catch (error) {
      results.push({
        source: source.label,
        summary: { error: error instanceof Error ? error.message : 'Crawl failed.' },
      });
    }
  }

  return results;
}

export { extractPublishedAt, safeSourceUrl };
