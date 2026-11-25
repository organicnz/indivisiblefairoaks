/**
 * Internet-discovery intake.
 *
 * Discovery providers already record candidate headlines. This module admits a
 * bounded batch into the report pipeline with three deliberate limits:
 *
 * - The page is fetched through the crawler's SSRF and robots checks.
 * - A deterministic ICE check and the existing AI extractor must agree that
 *   the page is about ICE enforcement; otherwise the candidate is rejected.
 * - What is stored is an attributed summary, never the publisher's full text:
 *   `provenance = 'discovery'` and `rights_status = 'unconfirmed'`. An admin
 *   can later promote the row after confirming republication rights.
 *
 * Each candidate is isolated: one fetch, parse or insert failure cannot stop
 * the rest of the batch, and transient failures leave the candidate pending for
 * the next scheduled attempt.
 */

import { extractWithAi, fetchCrawlDocument, validatePublicUrl } from '@/lib/ice-crawl';
import {
  classifyReportKind,
  extractHtmlReports,
  extractPublishedAt,
  extractTitle,
  isIceReportText,
  readableText,
} from '@/lib/ice-crawl-extract';
import { ingestIcePageImages } from '@/lib/ice-crawl-images';
import type { IceCrawlStore } from '@/lib/ice-crawl-store';
import {
  countPendingIceCrawlDiscoveries,
  getDiscoveryReportForPromotion,
  getOrCreateDiscoverySource,
  getSourceReportByUrl,
  insertIceSourceReports,
  listPendingIceCrawlDiscoveries,
  noteIceCrawlDiscoveryAttempt,
  promoteDiscoveryReport,
  reviewIceCrawlDiscovery,
  upsertIceCrawlPage,
} from '@/lib/ice-crawl-store';
import type { IceCrawlDiscovery, IceSourceReportKind } from '@/lib/ice-crawl-types';
import { refineSourceTextWithAi } from '@/lib/ice-source-refine';

export const DISCOVERY_INTAKE_MAX_PER_RUN = 8;
export const DISCOVERY_SUMMARY_MAX = 900;
const FETCH_ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;
const MIN_RELEVANT_TEXT = 80;

/**
 * Broad beat terms for the deterministic pre-filter. `ice` is matched on word
 * boundaries by the extractor's relevance helper, so "police" and "justice" do
 * not qualify on their own. The discovery providers already search these
 * concepts; this is the second, independent gate.
 */
export const DISCOVERY_RELEVANCE_TERMS = [
  'ICE',
  'immigration enforcement',
  'immigration raid',
  'immigration arrests',
  'detention',
  'deportation',
  'deportations',
  '287(g)',
  'checkpoint',
  'undocumented',
  'illegal alien',
] as const;

export type DiscoveryIntakeOutcome = {
  id: string;
  status: 'report' | 'duplicate' | 'rejected' | 'retry';
  reason: string;
  reportId?: string;
};

export type DiscoveryIntakeSummary = {
  processed: number;
  reports: number;
  duplicates: number;
  rejected: number;
  retried: number;
  remaining: number;
  outcomes: DiscoveryIntakeOutcome[];
};

export function discoveryRelevance(title: string, text: string) {
  const haystack = `${title}\n${text}`.toLowerCase();
  const terms = DISCOVERY_RELEVANCE_TERMS.map((term) => term.toLowerCase());
  const hasTerm = terms.some((term) =>
    term === 'ice' ? /\bice\b/.test(haystack) : haystack.includes(term)
  );
  return hasTerm && isIceReportText(`${title}\n${text}`);
}

/** Prefer the page's own description; fall back to the first readable lines. */
export function discoverySummary(
  html: string,
  text: string,
  aiText?: string | null
): string | null {
  if (aiText && aiText.trim().length >= 20) {
    return aiText.trim().slice(0, DISCOVERY_SUMMARY_MAX);
  }
  const description =
    /<meta[^>]+(?:property|name)=["'](?:og:description|twitter:description|description)["'][^>]*content=["']([^"']+)["']/i.exec(
      html
    )?.[1] ??
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:description|twitter:description|description)["']/i.exec(
      html
    )?.[1] ??
    '';
  const decoded = description
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  const summary = decoded.length >= 20 ? decoded : text.trim();
  if (summary.length < 20) return null;
  return summary.slice(0, DISCOVERY_SUMMARY_MAX);
}

export function isPermanentDiscoveryFailure(message: string) {
  if (/robots\.txt|Only public|embedded credentials|standard public web ports/i.test(message)) {
    return true;
  }
  const status = /HTTP\s+(\d{3})/i.exec(message)?.[1];
  if (status) {
    const code = Number(status);
    return code >= 400 && code < 500 && code !== 429;
  }
  return false;
}

async function fetchWithRetry(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetchCrawlDocument(url);
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Discovery fetch failed.');
}

function publisherName(discovery: IceCrawlDiscovery, canonicalUrl: string) {
  if (discovery.publisher?.trim()) return discovery.publisher.trim().slice(0, 120);
  try {
    return new URL(canonicalUrl).hostname.replace(/^www\./, '').slice(0, 120);
  } catch {
    return 'Nationwide web discovery';
  }
}

async function recordDecision(
  store: IceCrawlStore,
  discovery: IceCrawlDiscovery,
  sourceId: string | null,
  status: 'approved' | 'rejected',
  note: string
) {
  await reviewIceCrawlDiscovery(store, discovery.id, {
    status,
    source_id: sourceId,
    reviewed_at: new Date().toISOString(),
    review_note: note.slice(0, 500),
  });
}

/**
 * Process a bounded batch of pending discoveries, oldest first so a backlog
 * drains instead of the newest headline starving the queue. Returns counts and
 * per-candidate decisions; callers persist nothing else.
 */
export async function processPendingDiscoveries(
  store: IceCrawlStore,
  options: { limit?: number; deadline?: number } = {}
): Promise<DiscoveryIntakeSummary> {
  const limit = Math.min(Math.max(1, options.limit ?? DISCOVERY_INTAKE_MAX_PER_RUN), 20);
  const deadline = options.deadline ?? Date.now() + 45_000;
  const pending = await listPendingIceCrawlDiscoveries(store, limit);
  const source = await getOrCreateDiscoverySource(store);
  const outcomes: DiscoveryIntakeOutcome[] = [];
  let reports = 0;
  let duplicates = 0;
  let rejected = 0;
  let retried = 0;

  for (const discovery of pending) {
    if (Date.now() >= deadline) break;
    try {
      const existing = await getSourceReportByUrl(store, discovery.url);
      if (existing) {
        await recordDecision(store, discovery, source.id, 'approved', 'auto: duplicate report URL');
        duplicates += 1;
        outcomes.push({
          id: discovery.id,
          status: 'duplicate',
          reason: 'report already exists for canonical URL',
          reportId: existing.id,
        });
        continue;
      }

      const page = await fetchWithRetry(discovery.url);
      if (page.status >= 400 && page.status !== 429) {
        const reason = `HTTP ${page.status}`;
        if (isPermanentDiscoveryFailure(`HTTP ${page.status}`)) {
          await recordDecision(store, discovery, null, 'rejected', `auto: ${reason}`);
          rejected += 1;
          outcomes.push({ id: discovery.id, status: 'rejected', reason });
        } else {
          await noteIceCrawlDiscoveryAttempt(store, discovery.id, `auto retry: ${reason}`);
          retried += 1;
          outcomes.push({ id: discovery.id, status: 'retry', reason });
        }
        continue;
      }

      const title = extractTitle(page.text) || discovery.title;
      const text = readableText(page.text);
      if (text.length < MIN_RELEVANT_TEXT) {
        await recordDecision(store, discovery, null, 'rejected', 'auto: too little readable text');
        rejected += 1;
        outcomes.push({ id: discovery.id, status: 'rejected', reason: 'too little readable text' });
        continue;
      }

      if (!discoveryRelevance(title, text)) {
        await recordDecision(
          store,
          discovery,
          null,
          'rejected',
          'auto: no ICE enforcement content after deterministic screen'
        );
        rejected += 1;
        outcomes.push({
          id: discovery.id,
          status: 'rejected',
          reason: 'no ICE enforcement content (deterministic)',
        });
        continue;
      }

      const aiReports = await extractWithAi(
        text,
        page.finalUrl,
        title,
        extractPublishedAt(page.text),
        [],
        {
          deadline: Math.min(deadline, Date.now() + 25_000),
        }
      );

      // The edge function is the authoritative AI screen: it returns
      // isReport=false for a page that is not an ICE case, and a grounded,
      // bounded paraphrase for one that is. Refuse to publish a full page or
      // an invented summary when the screen is unavailable.
      let aiScreened = false;
      let summary: string | null = null;
      if (deadline - Date.now() > 15_000) {
        const refined = await refineSourceTextWithAi({
          text,
          sourceUrl: page.finalUrl,
          sourceTitle: title,
        });
        if (refined) {
          aiScreened = true;
          if (!refined.isReport) {
            await recordDecision(
              store,
              discovery,
              null,
              'rejected',
              'auto: AI screen found no ICE case report'
            );
            rejected += 1;
            outcomes.push({
              id: discovery.id,
              status: 'rejected',
              reason: 'AI screen: not an ICE case report',
            });
            continue;
          }
          summary = refined.text;
        }
      }
      summary = summary ?? discoverySummary(page.text, text, aiReports[0]?.text ?? null);
      if (!summary) {
        await recordDecision(store, discovery, null, 'rejected', 'auto: no usable summary');
        rejected += 1;
        outcomes.push({ id: discovery.id, status: 'rejected', reason: 'no usable summary' });
        continue;
      }
      const method = aiScreened || aiReports.length > 0 ? 'ai' : 'fallback';

      const canonicalUrl = page.finalUrl || discovery.url;
      const now = new Date().toISOString();
      const pageRow = await upsertIceCrawlPage(store, source.id, {
        url: discovery.url,
        final_url: canonicalUrl,
        http_status: page.status,
        content_type: page.contentType,
        title: title.slice(0, 500),
        text_content: summary,
        extraction_method: method,
        fetched_at: now,
      });

      const publisher = publisherName(discovery, canonicalUrl);
      const sourceText = `${summary}\n\nAttributed summary from ${publisher}. Read the full report at ${canonicalUrl}`;
      const kind: IceSourceReportKind =
        (aiReports[0]?.kind as IceSourceReportKind | undefined) ??
        classifyReportKind(`${title}\n${text}`);
      const inserted = await insertIceSourceReports(store, [
        {
          source_id: source.id,
          page_id: pageRow.id,
          source_name: publisher,
          source_url: canonicalUrl,
          source_title: title.slice(0, 500),
          source_published_at: discovery.published_at ?? extractPublishedAt(page.text),
          source_retrieved_at: now,
          title: title.slice(0, 240),
          text_content: sourceText,
          city: aiReports[0]?.city ?? null,
          state_code: aiReports[0]?.stateCode ?? null,
          kind,
          extraction_method: method,
          dedupe_key: `discovery:${canonicalUrl}`,
          published_at: now,
          provenance: 'discovery',
          rights_status: 'unconfirmed',
          summary,
          discovery_id: discovery.id,
        },
      ]);

      if (inserted === 0) {
        await recordDecision(store, discovery, source.id, 'approved', 'auto: duplicate report URL');
        duplicates += 1;
        outcomes.push({
          id: discovery.id,
          status: 'duplicate',
          reason: 'dedupe key already present',
        });
        continue;
      }

      // A usable preview is part of the case record. A source with no usable
      // image simply leaves the report without one; the pipeline never invents
      // a placeholder.
      try {
        await ingestIcePageImages({
          store,
          sourceId: source.id,
          pageId: pageRow.id,
          pageUrl: canonicalUrl,
          html: page.text,
          isPublicUrl: validatePublicUrl,
          hash: async (value) => {
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
            return Array.from(new Uint8Array(digest), (byte) =>
              byte.toString(16).padStart(2, '0')
            ).join('');
          },
        });
      } catch {
        // The report is already stored; an image failure is isolated.
      }

      await recordDecision(
        store,
        discovery,
        source.id,
        'approved',
        `auto: ${aiScreened ? 'AI' : 'deterministic'} ICE screen passed; attributed summary only`
      );
      reports += 1;
      outcomes.push({
        id: discovery.id,
        status: 'report',
        reason: aiScreened
          ? 'AI-screened attributed summary admitted'
          : 'attributed summary admitted (deterministic fallback)',
      });
      console.info(
        JSON.stringify({
          event: 'ice_discovery_intake',
          decision: 'report',
          discoveryId: discovery.id,
          host: new URL(canonicalUrl).hostname,
          aiReports: aiReports.length,
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Discovery intake failed.';
      const permanent = isPermanentDiscoveryFailure(message);
      try {
        if (permanent) {
          await recordDecision(store, discovery, null, 'rejected', `auto: ${message}`);
        } else {
          await noteIceCrawlDiscoveryAttempt(store, discovery.id, `auto retry: ${message}`);
        }
      } catch {
        // A failed review write must not stop the rest of the batch.
      }
      if (permanent) {
        rejected += 1;
        outcomes.push({ id: discovery.id, status: 'rejected', reason: message.slice(0, 200) });
      } else {
        retried += 1;
        outcomes.push({ id: discovery.id, status: 'retry', reason: message.slice(0, 200) });
      }
      console.info(
        JSON.stringify({
          event: 'ice_discovery_intake',
          decision: permanent ? 'rejected' : 'retry',
          discoveryId: discovery.id,
          error: message.slice(0, 160),
        })
      );
    }
  }

  const remaining = await countPendingIceCrawlDiscoveries(store);
  console.info(
    JSON.stringify({
      event: 'ice_discovery_intake_batch',
      processed: outcomes.length,
      reports,
      duplicates,
      rejected,
      retried,
      remaining,
    })
  );
  return {
    processed: outcomes.length,
    reports,
    duplicates,
    rejected,
    retried,
    remaining,
    outcomes,
  };
}

/**
 * Admin promotion after rights confirmation. The summary row is replaced with
 * the canonical page's extracted article text and the provenance flips back to
 * `crawl`/`confirmed`. The fetch still uses the SSRF and robots guards.
 */
export async function promoteDiscoveryReportById(store: IceCrawlStore, id: string) {
  const report = await getDiscoveryReportForPromotion(store, id);
  if (!report) throw new Error('That discovery report is no longer unconfirmed.');
  const page = await fetchWithRetry(report.source_url);
  if (page.status >= 400 && page.status !== 429) {
    throw new Error(`Source returned HTTP ${page.status}.`);
  }
  const extracted = extractHtmlReports(page.text, page.finalUrl, [], true);
  const fullText =
    extracted.map((entry) => entry.text).sort((a, b) => b.length - a.length)[0] ||
    readableText(page.text);
  if (fullText.trim().length < 20) throw new Error('No readable full text on the source page.');
  const promoted = await promoteDiscoveryReport(store, id, fullText);
  if (!promoted) throw new Error('The report changed before it could be promoted.');
  return { title: report.title, sourceUrl: report.source_url };
}
