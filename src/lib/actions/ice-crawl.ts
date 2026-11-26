'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { crawlIceSourceById } from '@/lib/ice-crawl';
import {
  canonicalizeDiscoveryUrl,
  discoverNationwideIceCandidates,
} from '@/lib/ice-crawl-discovery';
import { promoteDiscoveryReportById } from '@/lib/ice-crawl-intake';
import {
  getIceCrawlDiscovery,
  getIceCrawlSourceByUrl,
  type IceCrawlStore,
  insertIceCrawlDiscoveries,
  insertIceCrawlSource,
  listIceCrawlSources,
  publishSourceReport,
  reviewIceCrawlDiscovery,
  updateIceCrawlSource,
} from '@/lib/ice-crawl-store';
import type { IceCrawlSource } from '@/lib/ice-crawl-types';
import { triagePendingDiscoveries } from '@/lib/ice-discovery-triage';

const sourceSchema = z.object({
  url: z
    .string()
    .trim()
    .url('Enter a full public URL.')
    .refine((value) => value.startsWith('https://'), 'Use an https:// source URL.'),
  label: z.string().trim().min(1, 'Add a source label.').max(120),
  maxPages: z.coerce.number().int().min(1).max(200).default(20),
  rightsConfirmed: z.literal(true, {
    message: 'Confirm that the chapter may republish this source.',
  }),
});

const idSchema = z.object({ id: z.string().uuid() });

const toggleSchema = z.object({ id: z.string().uuid(), enabled: z.boolean() });

export type IceCrawlDiscoveryActionResult =
  | {
      success: true;
      message: string;
      found?: number;
      queued?: number;
      warning?: string;
      summary?: Awaited<ReturnType<typeof crawlIceSourceById>>;
    }
  | { success: false; error: string };

export type IceCrawlActionResult =
  | { success: true; summary?: Awaited<ReturnType<typeof crawlIceSourceById>> }
  | { success: false; error: string };

export type IceCrawlPromotionActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

export type IceCrawlTriageActionResult =
  | {
      success: true;
      message: string;
      warning?: string;
      summary: Awaited<ReturnType<typeof triagePendingDiscoveries>>;
    }
  | { success: false; error: string };

function fail(error: string): IceCrawlActionResult {
  return { success: false, error };
}

function discoveryFail(error: string): IceCrawlDiscoveryActionResult {
  return { success: false, error };
}

function storeFrom(session: Awaited<ReturnType<typeof requireAdmin>>) {
  return session.adminClient as unknown as IceCrawlStore;
}

function isDuplicateKey(error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const message = error instanceof Error ? error.message : '';
  return code === '23505' || /duplicate key/i.test(message);
}

/** Find an allowlisted source by canonical URL, including older `www` rows. */
async function findSourceByUrl(store: IceCrawlStore, url: string) {
  const direct = await getIceCrawlSourceByUrl(store, url);
  if (direct) return direct;

  const normalized = canonicalizeDiscoveryUrl(url);
  if (!normalized) return undefined;
  const sources = await listIceCrawlSources(store);
  return sources.find((row) => canonicalizeDiscoveryUrl(row.url) === normalized);
}

export async function addIceCrawlSourceAction(input: unknown): Promise<IceCrawlActionResult> {
  const session = await requireAdmin('/admin/ice-crawl');
  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || 'Check the source details.');
  }

  const store = storeFrom(session);
  let hostname = '';
  try {
    hostname = new URL(parsed.data.url).hostname;
  } catch {
    return fail('Enter a valid public URL.');
  }

  const normalizedUrl = canonicalizeDiscoveryUrl(parsed.data.url);
  if (!normalizedUrl) {
    return fail('Use a public https source URL.');
  }

  try {
    if (await findSourceByUrl(store, normalizedUrl)) {
      return fail('That source URL is already on the allowlist.');
    }
    await insertIceCrawlSource(store, {
      url: normalizedUrl,
      label: parsed.data.label || hostname,
      max_pages: parsed.data.maxPages,
      rights_confirmed_at: new Date().toISOString(),
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      return fail('That source URL is already on the allowlist.');
    }
    return fail('Could not add the source.');
  }

  revalidatePath('/admin/ice-crawl');
  return { success: true };
}

export async function runIceCrawlSourceAction(input: unknown): Promise<IceCrawlActionResult> {
  await requireAdmin('/admin/ice-crawl');
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail('Check the source.');

  try {
    const summary = await crawlIceSourceById(parsed.data.id);
    revalidatePath('/admin/ice-crawl');
    revalidatePath('/ice-alerts');
    return { success: true, summary };
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Crawl failed.');
  }
}

export async function discoverIceCrawlCandidatesAction(): Promise<IceCrawlDiscoveryActionResult> {
  const session = await requireAdmin('/admin/ice-crawl');
  const store = storeFrom(session);

  try {
    const discovery = await discoverNationwideIceCandidates();
    const queued = await insertIceCrawlDiscoveries(store, discovery.candidates);
    revalidatePath('/admin/ice-crawl');

    const warning = discovery.errors[0];
    if (discovery.candidates.length === 0) {
      return {
        success: true,
        message: warning
          ? `Nationwide discovery did not return candidates: ${warning}`
          : 'Nationwide discovery found no new U.S. news candidates.',
        found: 0,
        queued: 0,
        warning,
      };
    }

    return {
      success: true,
      message: `Nationwide discovery found ${discovery.candidates.length} candidate(s); ${queued} new headline(s) are waiting for review.`,
      found: discovery.candidates.length,
      queued,
      warning,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      /relation .*ice_crawl_discoveries.* does not exist|column .*story_key.* does not exist|insert_ice_crawl_discoveries|schema cache/i.test(
        message
      )
    ) {
      return discoveryFail('The nationwide discovery migration has not been applied yet.');
    }
    return discoveryFail(
      'Nationwide discovery failed. Check the public news and social feeds and try again.'
    );
  }
}

/**
 * Rank the pending discovery backlog without changing its review state. The
 * action is bounded so a 60-second server action cannot be turned into an
 * unbounded model bill; a backlog larger than one pass is finished by running
 * it again, and the oldest rows are always first in line.
 */
export async function triageIceCrawlDiscoveriesAction(): Promise<IceCrawlTriageActionResult> {
  const session = await requireAdmin('/admin/ice-crawl');

  try {
    const summary = await triagePendingDiscoveries(storeFrom(session), {
      limit: 200,
      deadline: Date.now() + 45_000,
    });
    revalidatePath('/admin/ice-crawl');

    if (summary.triaged === 0) {
      return {
        success: true,
        message:
          summary.remaining === 0
            ? 'No pending discovery candidates need triage.'
            : 'No candidates were triaged before the batch deadline. Try again.',
        summary,
      };
    }

    const details = [
      `${summary.triaged} candidate(s) ranked`,
      `${summary.collapsedDuplicates} duplicate story/stories collapsed`,
      `${summary.highConfidence} high-confidence ICE lead(s)`,
      `${summary.remaining} still pending`,
    ];
    return {
      success: true,
      message: `AI triage: ${details.join('; ')}. Human rights approval is still required.`,
      warning: summary.errors[0],
      summary,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/apply_ice_discovery_triage|triage_score|duplicate_of|schema cache/i.test(message)) {
      return {
        success: false,
        error: 'The discovery triage migration has not been applied yet.',
      };
    }
    return { success: false, error: 'AI triage failed. Try again in a moment.' };
  }
}

export async function approveIceCrawlDiscoveryAction(
  input: unknown
): Promise<IceCrawlDiscoveryActionResult> {
  const session = await requireAdmin('/admin/ice-crawl');
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return discoveryFail('Check the discovery candidate.');

  const store = storeFrom(session);
  let discovery: Awaited<ReturnType<typeof getIceCrawlDiscovery>>;
  try {
    discovery = await getIceCrawlDiscovery(store, parsed.data.id);
  } catch {
    return discoveryFail('Could not load that discovery candidate.');
  }
  if (!discovery) return discoveryFail('That discovery candidate no longer exists.');
  if (discovery.status === 'approved') {
    return { success: true, message: 'That candidate was already approved.' };
  }
  if (discovery.status === 'rejected') {
    return discoveryFail('That candidate has already been rejected.');
  }

  let source: IceCrawlSource | undefined;
  let createdSource = false;
  try {
    source = await findSourceByUrl(store, discovery.url);
  } catch {
    return discoveryFail('Could not check the existing source allowlist.');
  }

  if (!source) {
    try {
      source = await insertIceCrawlSource(store, {
        url: discovery.url,
        label: (discovery.publisher || new URL(discovery.url).hostname).slice(0, 120),
        max_pages: 1,
        rights_confirmed_at: new Date().toISOString(),
      });
      createdSource = true;
    } catch (error) {
      if (!isDuplicateKey(error)) {
        return discoveryFail('Could not approve that article as a source.');
      }

      // Another approval inserted the source between our lookup and insert.
      // Reuse it rather than leaving the candidate stuck in a retry loop.
      try {
        source = await findSourceByUrl(store, discovery.url);
      } catch {
        return discoveryFail('Could not check the source after a duplicate insert.');
      }
      if (!source) {
        return discoveryFail(
          'The source was inserted concurrently but is not visible yet. Try again.'
        );
      }
    }
  }
  if (!source) return discoveryFail('Could not resolve the source for that article.');

  let reviewed: Awaited<ReturnType<typeof reviewIceCrawlDiscovery>> = null;
  try {
    reviewed = await reviewIceCrawlDiscovery(store, discovery.id, {
      status: 'approved',
      source_id: source.id,
      reviewed_at: new Date().toISOString(),
      review_note: 'Approved after republication-rights confirmation.',
    });
  } catch {
    // Treat a concurrent review as idempotent below; a real write failure is
    // reported there as well.
  }

  if (!reviewed) {
    let current: Awaited<ReturnType<typeof getIceCrawlDiscovery>> = null;
    try {
      current = await getIceCrawlDiscovery(store, discovery.id);
    } catch {
      return discoveryFail('Could not confirm the candidate review state.');
    }
    if (current?.status === 'approved') {
      return { success: true, message: 'That candidate was already approved.' };
    }
    if (current?.status === 'rejected') {
      return discoveryFail('That candidate was already rejected.');
    }
    return discoveryFail('The source exists, but the candidate could not be marked approved.');
  }

  let crawlSummary: Awaited<ReturnType<typeof crawlIceSourceById>> | undefined;
  let warning: string | undefined;
  try {
    crawlSummary = await crawlIceSourceById(source.id);
    if (crawlSummary.status !== 'ok') warning = crawlSummary.note;
  } catch (error) {
    warning = error instanceof Error ? error.message : 'The first crawl failed.';
  }

  // A discovered article is a one-page source. Disable it after the approval
  // crawl so scheduled runs do not refetch every old article indefinitely. If
  // an earlier approval created the source but failed before review, the retry
  // finds it as an existing one-page source and still cleans it up.
  if (createdSource || source.max_pages === 1) {
    try {
      await updateIceCrawlSource(store, source.id, { enabled: false });
    } catch {
      // The candidate is approved; source-toggle cleanup is non-critical.
    }
  }

  revalidatePath('/admin/ice-crawl');
  revalidatePath('/ice-alerts');
  revalidatePath('/ice-alerts/web-reports');
  return {
    success: true,
    message: warning
      ? 'Article approved, but its first crawl needs attention. Check the source list.'
      : 'Article approved and crawled.',
    warning,
    summary: crawlSummary,
  };
}

export async function rejectIceCrawlDiscoveryAction(
  input: unknown
): Promise<IceCrawlDiscoveryActionResult> {
  const session = await requireAdmin('/admin/ice-crawl');
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return discoveryFail('Check the discovery candidate.');

  const store = storeFrom(session);
  let reviewed: Awaited<ReturnType<typeof reviewIceCrawlDiscovery>> = null;
  try {
    reviewed = await reviewIceCrawlDiscovery(store, parsed.data.id, {
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      review_note: 'Rejected by admin.',
    });
  } catch {
    return discoveryFail('Could not reject that discovery candidate.');
  }

  if (!reviewed) {
    let current: Awaited<ReturnType<typeof getIceCrawlDiscovery>> = null;
    try {
      current = await getIceCrawlDiscovery(store, parsed.data.id);
    } catch {
      return discoveryFail('Could not confirm the candidate review state.');
    }
    if (current?.status === 'rejected') {
      return { success: true, message: 'That candidate was already rejected.' };
    }
    if (current?.status === 'approved') {
      return discoveryFail('That candidate has already been approved.');
    }
    return discoveryFail('That candidate could not be rejected.');
  }

  revalidatePath('/admin/ice-crawl');
  return { success: true, message: 'Candidate rejected.' };
}

export async function setIceCrawlSourceEnabledAction(
  input: unknown
): Promise<IceCrawlActionResult> {
  const session = await requireAdmin('/admin/ice-crawl');
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return fail('Check the source.');

  const store = storeFrom(session);
  try {
    await updateIceCrawlSource(store, parsed.data.id, { enabled: parsed.data.enabled });
  } catch {
    return fail('Could not update the source.');
  }

  revalidatePath('/admin/ice-crawl');
  return { success: true };
}

/**
 * Promote an automatically admitted discovery summary to full text after an
 * admin has confirmed republication rights. The provenance/rights fields are
 * what make this operation auditable; it is not a cosmetic edit.
 */
export async function promoteIceCrawlReportAction(
  input: unknown
): Promise<IceCrawlPromotionActionResult> {
  const session = await requireAdmin('/admin/ice-crawl');
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Check the discovery report.' };

  try {
    await promoteDiscoveryReportById(storeFrom(session), parsed.data.id);
    revalidatePath('/admin/ice-crawl');
    revalidatePath('/ice-alerts');
    revalidatePath('/ice-alerts/web-reports');
    return { success: true, message: 'Rights confirmed; full source text promoted.' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'The promotion failed.',
    };
  }
}

/**
 * Publish a rights-confirmed draft. Publication is deliberately separate from
 * rights confirmation: an admin can clear the legal gate and still keep the
 * report private until the chapter is ready to release it.
 */
export async function publishIceCrawlReportAction(
  input: unknown
): Promise<IceCrawlPromotionActionResult> {
  const session = await requireAdmin('/admin/ice-crawl');
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Check the discovery report.' };

  try {
    const published = await publishSourceReport(storeFrom(session), parsed.data.id);
    if (!published) {
      return {
        success: false,
        error: 'Only a rights-confirmed draft can be published.',
      };
    }
    revalidatePath('/admin/ice-crawl');
    revalidatePath('/ice-alerts');
    revalidatePath('/ice-alerts/web-reports');
    return { success: true, message: 'Published to the public archive.' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'The report could not be published.',
    };
  }
}
