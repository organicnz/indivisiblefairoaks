/**
 * Network boundary for the ICE scan.
 *
 * Every URL in the scan comes from a third party, so this module is the one
 * place that is allowed to turn a string into an outbound request. It applies
 * the same posture as the Next crawler:
 *
 * - only public http(s) URLs on the standard ports,
 * - DNS resolution of every hop, with private, loopback, link-local, CGNAT,
 *   documentation and multicast ranges rejected,
 * - manual redirect following so a public URL cannot hop onto an internal one,
 * - a byte ceiling and a wall-clock timeout on every response,
 * - robots.txt respected for page fetches (not for the publisher's own feeds,
 *   which are public syndication endpoints).
 *
 * Everything fails closed. A resolver error is a refused request, not a
 * request that falls back to fetching the hostname directly.
 */

import { isIpLiteral, isPrivateAddress } from './ice-scan-logic.ts';

const USER_AGENT =
  'IndivisibleFairOaks-ReportCrawler/1.0 (+https://indivisiblefairoaks.org; nationwide source discovery)';

const DEFAULT_ACCEPT =
  'text/html, application/xhtml+xml, application/rss+xml, application/xml, application/json;q=0.9, */*;q=0.5';

const DNS_TTL_MS = 5 * 60 * 1_000;
const DNS_CACHE_MAX = 500;

const dnsCache = new Map<string, { addresses: string[]; expiresAt: number }>();
const robotsCache = new Map<string, { rules: RobotsRules; expiresAt: number }>();

export type FetchedDocument = {
  finalUrl: string;
  status: number;
  contentType: string;
  text: string;
};

export type FetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  accept?: string;
};

export type RobotsRules = {
  disallow: string[];
  sitemaps: string[];
};

/**
 * Hosted Edge Runtime is Deno-compatible but does not guarantee every Deno
 * namespace API. Resolve through DoH when `Deno.resolveDns` is absent or
 * refuses; both resolvers return the same JSON answer shape. A failed DoH
 * lookup is a refused request, not a fallback to an unchecked hostname.
 */
async function resolveViaDoh(host: string) {
  const resolvers = [
    'https://cloudflare-dns.com/dns-query',
    'https://dns.google/resolve',
  ];
  for (const endpoint of resolvers) {
    const lookup = async (type: 'A' | 'AAAA') => {
      const response = await fetch(
        `${endpoint}?name=${encodeURIComponent(host)}&type=${type}`,
        {
          headers: { accept: 'application/dns-json' },
          signal: AbortSignal.timeout(4_000),
        },
      );
      if (!response.ok) return [];
      const payload = (await response.json()) as {
        Answer?: Array<{ type?: unknown; data?: unknown }>;
      };
      const wanted = type === 'A' ? 1 : 28;
      return (payload.Answer ?? [])
        .filter((row) => row.type === wanted && typeof row.data === 'string')
        .map((row) => row.data as string);
    };
    const results = await Promise.allSettled([lookup('A'), lookup('AAAA')]);
    const addresses = results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    );
    if (addresses.length > 0) return addresses;
  }
  return [];
}

async function resolveHost(host: string) {
  const cached = dnsCache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.addresses;

  let addresses: string[] = [];
  if (typeof Deno.resolveDns === 'function') {
    const results = await Promise.allSettled([
      Deno.resolveDns(host, 'A'),
      Deno.resolveDns(host, 'AAAA'),
    ]);
    addresses = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  }
  if (addresses.length === 0) addresses = await resolveViaDoh(host);
  if (addresses.length === 0) {
    throw new Error('The source did not resolve to a public address.');
  }
  if (dnsCache.size >= DNS_CACHE_MAX) {
    const oldest = dnsCache.keys().next().value;
    if (oldest) dnsCache.delete(oldest);
  }
  dnsCache.set(host, { addresses, expiresAt: Date.now() + DNS_TTL_MS });
  return addresses;
}

/** Assert that a URL is safe to fetch; returns the parsed URL on success. */
export async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Only public http(s) URLs are supported.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only public http(s) URLs are supported.');
  }
  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not supported.');
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new Error('Only standard public web ports are supported.');
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost') ||
    host === '0.0.0.0'
  ) {
    throw new Error('Private or local network targets are not allowed.');
  }

  if (isIpLiteral(host)) {
    if (isPrivateAddress(host)) {
      throw new Error('The source resolves to a private network address.');
    }
    return url;
  }

  const addresses = await resolveHost(host);
  if (addresses.some((address) => isPrivateAddress(address))) {
    throw new Error('The source resolves to a private network address.');
  }
  return url;
}

function joinChunks(chunks: readonly Uint8Array[], total: number) {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

/**
 * Fetch one document with manual redirects and a hard byte ceiling. This is
 * deliberately separate from `fetchCrawlDocument` so robots.txt can be read
 * without recursively reading robots.txt.
 */
export async function fetchRawPage(rawUrl: string, options: FetchOptions = {}): Promise<FetchedDocument> {
  const maxBytes = options.maxBytes ?? 8_000_000;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const maxRedirects = options.maxRedirects ?? 3;
  let current = await assertPublicUrl(rawUrl);

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: options.accept ?? DEFAULT_ACCEPT,
        'user-agent': USER_AGENT,
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`Source redirected without a location (HTTP ${response.status}).`);
      }
      current = await assertPublicUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      // Drain the body so the connection can be reused; the message is the
      // only part callers use.
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`Source returned HTTP ${response.status}.`);
    }

    const declared = Number(response.headers.get('content-length') ?? 0);
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('Source page is larger than the crawler limit.');
    }

    if (!response.body) throw new Error('Source returned no response body.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('Source page is larger than the crawler limit.');
      }
      chunks.push(value);
    }

    return {
      finalUrl: current.toString(),
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      text: new TextDecoder().decode(joinChunks(chunks, total)),
    };
  }

  throw new Error('Source redirected too many times.');
}

export function parseRobots(content: string): RobotsRules {
  const disallow: string[] = [];
  const sitemaps: string[] = [];
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
    if (key === 'sitemap' && value) {
      sitemaps.push(value);
      continue;
    }
    if (applies && key === 'disallow' && value) disallow.push(value);
  }
  return { disallow, sitemaps };
}

export async function readRobots(target: URL, timeoutMs = 4_000): Promise<RobotsRules> {
  const origin = target.origin;
  const cached = robotsCache.get(origin);
  if (cached && cached.expiresAt > Date.now()) return cached.rules;

  let rules: RobotsRules = { disallow: [], sitemaps: [] };
  try {
    const response = await fetchRawPage(`${origin}/robots.txt`, {
      maxBytes: 120_000,
      timeoutMs,
    });
    rules = parseRobots(response.text);
  } catch {
    // A missing or unreachable robots.txt is treated as no restrictions; the
    // SSRF and byte guards still apply to the page itself.
  }
  robotsCache.set(origin, { rules, expiresAt: Date.now() + 10 * 60 * 1_000 });
  return rules;
}

export function robotsAllows(rules: RobotsRules, target: URL) {
  return !rules.disallow.some((rule) => target.pathname.startsWith(rule));
}

/** Fetch an article page under the crawler's SSRF and robots rules. */
export async function fetchCrawlDocument(rawUrl: string, options: FetchOptions = {}) {
  const target = await assertPublicUrl(rawUrl);
  const robots = await readRobots(target, Math.min(options.timeoutMs ?? 8_000, 4_000));
  if (!robotsAllows(robots, target)) {
    throw new Error(`Blocked by robots.txt: ${target.toString()}`);
  }
  return fetchRawPage(target.toString(), {
    timeoutMs: options.timeoutMs ?? 8_000,
    maxBytes: options.maxBytes ?? 5_000_000,
    maxRedirects: options.maxRedirects ?? 2,
  });
}

/**
 * Classify a failure that will never succeed: an explicit 4xx, a robots
 * refusal, an unsafe URL or an oversized page. Timeouts, 429s, TLS faults and
 * provider outages stay retryable.
 */
export function isPermanentFailure(message: string) {
  if (
    /robots\.txt|Only public|embedded credentials|standard public web ports|private network|larger than the crawler limit|redirected too many times/i.test(
      message,
    )
  ) {
    return true;
  }
  const status = /HTTP\s+(\d{3})/i.exec(message)?.[1];
  if (status) {
    const code = Number(status);
    return code >= 400 && code < 500 && code !== 429;
  }
  return false;
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Bounded worker pool; preserves order and stops when `task` throws. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
) {
  // Sparse output keeps the input order; assignments fill every index before
  // the function resolves.
  const results: R[] = [];
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        results[index] = await task(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
