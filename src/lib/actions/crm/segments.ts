import { z } from 'zod';
import { CRM_CONTACT_CONSENT_VALUES } from '@/lib/crm-contact-options';
import { MAX_TAGS_PER_CONTACT, normalizeTags } from '@/lib/crm-import';
import type { CRMSegment } from '@/types/crm';
import {
  type CRMResult,
  recordCRMAudit,
  requireCRMAdmin,
  revalidateCRMRoutes,
  tagSchema,
} from './shared';

/**
 * A reusable filter. `consent` is a first-class member, not a spare column:
 * "everyone who opted out" is the audit a chapter most often needs to repeat,
 * and while the field was absent an opt-out filter could be applied but not
 * saved — so the only way to re-run it was to remember the dropdown.
 */
/** Shape of the `.select('id')` result both segment writes return. */
type SegmentWriteResult = {
  data: { id: string } | null;
  error: { message: string; code?: string } | null;
};

const segmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  query: z.string().trim().max(100).default(''),
  statuses: z.array(z.string()).max(10).default([]),
  districts: z.array(z.string()).max(10).default([]),
  tags: z
    .array(tagSchema)
    .max(MAX_TAGS_PER_CONTACT, `A segment may filter on at most ${MAX_TAGS_PER_CONTACT} tags`)
    .transform(normalizeTags)
    .default([]),
  /*
   * All three states, so "everyone we have never asked" is a segment you can
   * save and re-run. It was two when this field was added, which meant the audit
   * a chapter most often wants — who is in the audience without ever having said
   * yes — could be produced on screen but not kept.
   */
  consent: z.enum(CRM_CONTACT_CONSENT_VALUES).optional(),
});

/**
 * Saved segments, newest first — with the true total alongside.
 *
 * The read used to be `.limit(50)` with no count and no pager, so a chapter
 * past 50 saved segments silently lost the oldest. And since the directory only
 * lists what this returns, an unreachable segment was also undeletable: no UI
 * path could reach its delete control. That is precisely the failure the docs
 * claim was fixed for drafts; it was not carried to segments.
 *
 * Segments grow one row per deliberate save — not per campaign, per contact,
 * or per import — so the honest fix is a cap high enough to never bind (500)
 * with a truncation flag, rather than a pager for a list nobody pages. If the
 * flag ever fires, that is the signal to build the pager, not to raise the cap
 * again.
 */
const SEGMENT_LIMIT = 500;

export async function getCRMSegments(): Promise<{ segments: CRMSegment[]; truncated: boolean }> {
  const { adminClient } = await requireCRMAdmin();
  const { data, error, count } = await adminClient
    .from('crm_segments')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(SEGMENT_LIMIT);
  if (error) throw new Error(`Failed to load segments: ${error.message}`);
  if (count === null) {
    throw new Error('Failed to load segments: total count unavailable');
  }
  return { segments: data || [], truncated: count > (data?.length ?? 0) };
}

export async function saveCRMSegment(
  rawInput: z.input<typeof segmentSchema>
): Promise<CRMResult<{ segmentId?: string }>> {
  const admin = await requireCRMAdmin();
  const { adminClient } = admin;
  const parsed = segmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { id, name, query, statuses, districts, tags, consent } = parsed.data;
  const row = {
    name: name.trim(),
    query,
    statuses,
    districts,
    tags,
    // Written as SQL NULL rather than omitted, so clearing a segment's consent
    // filter on edit actually clears it. Omitting the key would leave the
    // previous value in place on an UPDATE.
    consent: consent ?? null,
  };

  /*
    Cast for the same reason as `CRMSegment` above: the generated row type does
    not know `consent` until migration 20261005000000 has been applied to the
    project the types were derived from. The value is written as SQL NULL, not
    omitted — omitting the key would leave the previous consent filter in place
    when a segment's filter is cleared, which is the edit the field exists for.
  */
  const segments = adminClient as unknown as {
    from: (table: 'crm_segments') => {
      update: (values: typeof row) => {
        eq: (
          col: string,
          value: string
        ) => {
          select: (cols: string) => {
            single: () => Promise<SegmentWriteResult>;
            maybeSingle: () => Promise<SegmentWriteResult>;
          };
        };
      };
      insert: (values: typeof row) => {
        select: (cols: string) => {
          single: () => Promise<SegmentWriteResult>;
          maybeSingle: () => Promise<SegmentWriteResult>;
        };
      };
    };
  };

  const auditSave = (
    outcome: 'success' | 'failure',
    targetId: string,
    before: unknown,
    after: unknown,
    error?: string
  ) =>
    recordCRMAudit(admin, {
      action: 'crm.segment.save',
      targetType: 'crm_segment',
      targetId,
      targetLabel: name,
      before,
      after,
      outcome,
      error: error ?? null,
    });

  if (id) {
    const { data, error } = await segments
      .from('crm_segments')
      .update(row)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    // A concurrent delete between the read and the write matches no row. Asking
    // for `maybeSingle()` makes that empty result observable instead of turning
    // it into a raw PGRST116 error the organizer cannot act on.
    if (error || !data) {
      const message = error ? error.message : 'That segment no longer exists';
      await auditSave('failure', id, { id }, row, message);
      return { success: false, error: message };
    }
    await auditSave('success', data.id, { id }, { ...row, id: data.id });
    revalidateCRMRoutes();
    return { success: true, segmentId: data.id };
  }

  const { data, error } = await segments.from('crm_segments').insert(row).select('id').single();
  if (error || !data) {
    let message = 'The segment could not be created';
    if (error) {
      message = error.code === '23505' ? 'A segment with that name already exists' : error.message;
    }
    await auditSave('failure', name, null, row, message);
    return { success: false, error: message };
  }
  await auditSave('success', data.id, null, { ...row, id: data.id });
  revalidateCRMRoutes();
  return { success: true, segmentId: data.id };
}

export async function deleteCRMSegment(id: string): Promise<CRMResult> {
  const admin = await requireCRMAdmin();
  const { adminClient } = admin;
  const { data, error } = await adminClient
    .from('crm_segments')
    .delete()
    .eq('id', id)
    .select('id, name')
    .maybeSingle();
  if (error || !data) {
    const message = error ? error.message : 'Segment not found';
    await recordCRMAudit(admin, {
      action: 'crm.segment.delete',
      targetType: 'crm_segment',
      targetId: id,
      targetLabel: null,
      before: null,
      after: null,
      outcome: 'failure',
      error: message,
    });
    return { success: false, error: message };
  }
  await recordCRMAudit(admin, {
    action: 'crm.segment.delete',
    targetType: 'crm_segment',
    targetId: data.id,
    targetLabel: data.name ?? data.id,
    before: { id: data.id, name: data.name },
    after: { deleted: true },
    outcome: 'success',
  });
  revalidateCRMRoutes();
  return { success: true };
}
