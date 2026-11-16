'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { crawlIceSourceById } from '@/lib/ice-crawl';
import {
  insertIceCrawlSource,
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

export type IceCrawlActionResult =
  | { success: true; summary?: Awaited<ReturnType<typeof crawlIceSourceById>> }
  | { success: false; error: string };

function fail(error: string): IceCrawlActionResult {
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
