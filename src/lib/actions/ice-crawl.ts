'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { crawlIceSourceById } from '@/lib/ice-crawl';
import { discoverNationwideIceCandidates } from '@/lib/ice-crawl-discovery';
import type { IceCrawlSource } from '@/lib/ice-crawl-types';
import {
  getIceCrawlDiscovery,
  insertIceCrawlDiscoveries,
  insertIceCrawlSource,
  listIceCrawlSources,
  reviewIceCrawlDiscovery,
  updateIceCrawlSource,
  type IceCrawlStore,
} from '@/lib/ice-crawl-store';

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

function fail(error: string): IceCrawlActionResult {
  return { success: false, error };
}

function discoveryFail(error: string): IceCrawlDiscoveryActionResult {
  return { success: false, error };
}

function storeFrom(session: Awaited<ReturnType<typeof requireAdmin>>) {
  return session.adminClient as unknown as IceCrawlStore;
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

  try {
    await insertIceCrawlSource(store, {
      url: parsed.data.url,
      label: parsed.data.label || hostname,
      max_pages: parsed.data.maxPages,
      rights_confirmed_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/duplicate key/i.test(message)) {
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
    if (/relation .*ice_crawl_discoveries.* does not exist/i.test(message)) {
      return discoveryFail('The nationwide discovery migration has not been applied yet.');
    }
    return discoveryFail('Nationwide discovery failed. Check the GDELT response and try again.');
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
  if (discovery.status !== 'pending') {
    return discoveryFail('That candidate has already been reviewed.');
  }

  let source: IceCrawlSource | undefined;
  try {
    source = (await listIceCrawlSources(store)).find((row) => row.url === discovery.url);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/duplicate key/i.test(message)) {
        return discoveryFail('That article is already on the source allowlist.');
      }
      return discoveryFail('Could not approve that article as a source.');
    }
  }

  try {
    await reviewIceCrawlDiscovery(store, discovery.id, {
      status: 'approved',
      source_id: source.id,
      reviewed_at: new Date().toISOString(),
      review_note: 'Approved after republication-rights confirmation.',
    });
  } catch {
    return discoveryFail('The source was added, but the candidate could not be marked approved.');
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
  // crawl so scheduled runs do not refetch every old article indefinitely.
  try {
    await updateIceCrawlSource(store, source.id, { enabled: false });
  } catch {
    // The candidate is approved; source-toggle cleanup is non-critical.
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

  try {
    const reviewed = await reviewIceCrawlDiscovery(storeFrom(session), parsed.data.id, {
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      review_note: 'Rejected by admin.',
    });
    if (!reviewed) return discoveryFail('That candidate has already been reviewed.');
  } catch {
    return discoveryFail('Could not reject that discovery candidate.');
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
