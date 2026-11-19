'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import {
  getIceReportById,
  type IceReportStore,
  iceReportPublicCitySchema,
  iceReportPublicStateSchema,
  iceReportPublicSummarySchema,
  publishIceReport,
  updateIceReport,
} from '@/lib/ice-report-intake';
import { getIceHeatmapSnapshot } from '@/lib/queries/ice-heatmap';
import { createCityMatcher } from '@/lib/rapid-city-match';

export type IceReportActionResult = { success: true } | { success: false; error: string };

type ExistingIceReport = Awaited<ReturnType<typeof getIceReportById>>;
type IceHeatmapSnapshot = Awaited<ReturnType<typeof getIceHeatmapSnapshot>>;

function fail(error: string): IceReportActionResult {
  return { success: false, error };
}

function storeFrom(session: Awaited<ReturnType<typeof requireAdmin>>) {
  return session.adminClient as unknown as IceReportStore;
}

const recommendSchema = z.object({
  id: z.string().uuid(),
  publicCity: iceReportPublicCitySchema,
  publicStateCode: iceReportPublicStateSchema,
  publicSummary: iceReportPublicSummarySchema,
});

const rejectSchema = z.object({
  id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(5, 'Add a short rejection reason.')
    .max(300, 'Keep the reason under 300 characters.'),
});

const idSchema = z.object({ id: z.string().uuid() });

export async function recommendIceReport(input: unknown): Promise<IceReportActionResult> {
  const session = await requireAdmin('/admin/ice-reports');
  const parsed = recommendSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || 'Check the public draft.');
  }

  const store = storeFrom(session);
  let existing: ExistingIceReport;
  try {
    existing = await getIceReportById(store, parsed.data.id);
  } catch {
    return fail('Could not load that report.');
  }
  if (!existing) return fail('That report no longer exists.');
  if (existing.status !== 'received') {
    return fail('That report has already been reviewed.');
  }

  try {
    await updateIceReport(store, parsed.data.id, {
      status: 'needs_second_review',
      reviewer_one_id: session.adminUserId,
      reviewer_one_at: new Date().toISOString(),
      public_city: parsed.data.publicCity,
      public_state_code: parsed.data.publicStateCode,
      public_kind: existing.kind,
      public_observed_at: existing.observed_at,
      public_summary: parsed.data.publicSummary,
      rejection_reason: null,
    });
  } catch {
    return fail('Could not save the public draft.');
  }

  revalidatePath('/admin/ice-reports');
  return { success: true };
}

export async function publishIceReportAction(input: unknown): Promise<IceReportActionResult> {
  const session = await requireAdmin('/admin/ice-reports');
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail('Check the report.');

  const store = storeFrom(session);
  let existing: ExistingIceReport;
  try {
    existing = await getIceReportById(store, parsed.data.id);
  } catch {
    return fail('Could not load that report.');
  }
  if (!existing) return fail('That report no longer exists.');
  if (existing.status !== 'needs_second_review') {
    return fail('That report is not waiting for a second reviewer.');
  }
  if (existing.reviewer_one_id === session.adminUserId) {
    return fail('A different admin must approve this report.');
  }
  if (
    !existing.public_city ||
    !existing.public_state_code ||
    !existing.public_kind ||
    !existing.public_observed_at ||
    !existing.public_summary
  ) {
    return fail('The sanitized draft is incomplete.');
  }

  let snapshot: IceHeatmapSnapshot;
  try {
    snapshot = await getIceHeatmapSnapshot();
  } catch {
    return fail('The city map is unavailable, so this report cannot be placed safely yet.');
  }

  const match = createCityMatcher(snapshot.cities).findCityCentroid(
    existing.public_city,
    existing.public_state_code
  );
  if (!match) {
    return fail(
      'That city is not in the map snapshot. Reject or revise the draft to a known city.'
    );
  }

  try {
    await publishIceReport(store, existing.id, session.adminUserId, match.lat, match.lng);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/different reviewer/i.test(message)) {
      return fail('A different admin must approve this report.');
    }
    if (/not ready/i.test(message)) {
      return fail('That report is not waiting for a second reviewer.');
    }
    if (/duplicate key/i.test(message)) {
      return fail('This report already has a public entry.');
    }
    return fail('Could not publish the report.');
  }

  revalidatePath('/admin/ice-reports');
  revalidatePath('/ice-alerts');
  return { success: true };
}

export async function rejectIceReport(input: unknown): Promise<IceReportActionResult> {
  const session = await requireAdmin('/admin/ice-reports');
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || 'Add a rejection reason.');
  }

  const store = storeFrom(session);
  let existing: ExistingIceReport;
  try {
    existing = await getIceReportById(store, parsed.data.id);
  } catch {
    return fail('Could not load that report.');
  }
  if (!existing) return fail('That report no longer exists.');
  if (existing.status !== 'received' && existing.status !== 'needs_second_review') {
    return fail('That report is no longer in the review queue.');
  }

  try {
    await updateIceReport(store, parsed.data.id, {
      status: 'rejected',
      rejection_reason: parsed.data.reason,
      reviewer_two_id: null,
      reviewer_two_at: null,
    });
  } catch {
    return fail('Could not reject the report.');
  }

  revalidatePath('/admin/ice-reports');
  return { success: true };
}
