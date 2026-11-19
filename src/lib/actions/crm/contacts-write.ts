import { z } from 'zod';
import {
  CRM_CONTACT_CONSENT_VALUES,
  CRM_CONTACT_DEFAULTS,
  CRM_CONTACT_STATUS_VALUES,
  crmContactConsentValue,
  crmContactDoNotEmail,
  normalizeCRMEmail,
} from '@/lib/crm-contact-options';
import {
  type CRMImportError,
  MAX_CONTACT_NOTES_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_CONTACT,
  normalizeTags,
  parseCRMImportCsv,
} from '@/lib/crm-import';
import type {
  ConsentDecision,
  CRMBulkUpdateDistributionEntry,
  CRMBulkUpdatePreview,
  CRMContact,
  CRMContactInsert,
  CRMContactStatus,
  CRMContactUpdate,
} from '@/types/crm';
import type { Database } from '@/types/supabase';
import {
  type AdminClient,
  type CRMResult,
  crmAuditWarning,
  escapeIlike,
  recordCRMAudit,
  requireCRMAdmin,
  revalidateCRMRoutes,
  tagSchema,
} from './shared';

const CRM_ACTIVITY_WARNING =
  'Saved, but the CRM timeline entry could not be recorded. The activity log is incomplete.';

const BULK_AUDIT_CONTACT_COLUMNS = 'id, status, district, tags, do_not_email, unsubscribed_at';

/** The contact fields a bulk operation can change, plus the id they belong to. */
type BulkAuditContact = {
  id: string;
  status?: string | null;
  district?: string | null;
  tags?: string[] | null;
  do_not_email?: boolean | null;
  unsubscribed_at?: string | null;
};

type BulkAuditFieldSet = {
  status: boolean;
  district: boolean;
  tags: boolean;
  consent: boolean;
};

type BulkContactChange = {
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

type BulkAuditFieldChange = {
  contact_id: string;
  old_value: unknown;
  new_value: unknown;
};

/** Keep only the values a bulk operation actually changed, keyed by contact. */
function snapshotBulkContact(
  contact: BulkAuditContact,
  fields: BulkAuditFieldSet
): Record<string, unknown> {
  const snapshot: Record<string, unknown> = { id: contact.id };
  if (fields.status) snapshot.status = contact.status ?? null;
  if (fields.district) snapshot.district = contact.district ?? null;
  if (fields.tags) snapshot.tags = Array.isArray(contact.tags) ? contact.tags : [];
  if (fields.consent) {
    snapshot.do_not_email = contact.do_not_email ?? null;
    snapshot.unsubscribed_at = contact.unsubscribed_at ?? null;
  }
  return snapshot;
}

/** A readable consent state plus the stored columns that produce it. */
function auditConsentValue(snapshot: Record<string, unknown>) {
  const doNotEmail = snapshot.do_not_email;
  return {
    decision: doNotEmail === true ? 'opted_out' : doNotEmail === false ? 'opted_in' : 'unasked',
    do_not_email: doNotEmail ?? null,
    unsubscribed_at: snapshot.unsubscribed_at ?? null,
  };
}

/**
 * Per-contact old/new values for the fields this operation touched.
 *
 * The top-level before/after snapshots already hold this, but the audit
 * explorer's metadata is what consumers index and review. Keeping the values
 * grouped by field makes a bulk row self-explanatory without writing one audit
 * row per contact.
 */
function bulkAuditFieldChanges(
  changes: BulkContactChange[],
  fields: BulkAuditFieldSet
): Record<string, BulkAuditFieldChange[]> {
  const result: Record<string, BulkAuditFieldChange[]> = {};
  if (fields.status) {
    result.status = changes.map(({ id, before, after }) => ({
      contact_id: id,
      old_value: before.status ?? null,
      new_value: after.status ?? null,
    }));
  }
  if (fields.district) {
    result.district = changes.map(({ id, before, after }) => ({
      contact_id: id,
      old_value: before.district ?? null,
      new_value: after.district ?? null,
    }));
  }
  if (fields.tags) {
    result.tags = changes.map(({ id, before, after }) => ({
      contact_id: id,
      old_value: before.tags ?? [],
      new_value: after.tags ?? [],
    }));
  }
  if (fields.consent) {
    result.consent = changes.map(({ id, before, after }) => ({
      contact_id: id,
      old_value: auditConsentValue(before),
      new_value: auditConsentValue(after),
    }));
  }
  return result;
}

function countBulkDistribution(values: string[]): CRMBulkUpdateDistributionEntry[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * The fields a contact write may carry, without the create-only defaults.
 *
 * The update path used this shape with `.default()`s, which is how an inline tag
 * edit that sent only `{ id, email, tags }` also wrote `status: 'supporter'` and
 * `district: 'CA-06'` — silently resetting both fields the organizer never
 * touched. Defaults belong to creation, where there is no prior value to keep.
 *
 * `do_not_email` is deliberately absent. A generic profile edit must not be able
 * to overwrite consent without the activity entry that `setCRMEmailConsent`
 * writes; the editor routes consent changes through that dedicated action.
 */
const contactEditableFields = {
  email: z.string().trim().toLowerCase().email(),
  first_name: z.string().max(100).nullable().optional(),
  last_name: z.string().max(100).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  zip_code: z.string().max(20).nullable().optional(),
  district: z.string().max(20),
  status: z.enum(CRM_CONTACT_STATUS_VALUES),
  tags: z
    .array(tagSchema)
    .max(MAX_TAGS_PER_CONTACT, `A contact may carry at most ${MAX_TAGS_PER_CONTACT} tags`)
    .transform(normalizeTags),
  // Bounded, unlike before. An arbitrarily large blob reached `crm_contacts.notes`
  // from three directions at once — this schema, the CSV importer, and an editor
  // textarea with no `maxLength` — and it is rendered in the 360 panel *and*
  // emitted in every CSV export of the directory. `taskSchema` caps `details` at
  // 2000 for comparison; a free-text organizer note does not need more than the
  // importer's own row limit.
  notes: z.string().max(MAX_CONTACT_NOTES_LENGTH).nullable().optional(),
};

const contactSchema = z.object({
  id: z.string().uuid().optional(),
  ...contactEditableFields,
  district: contactEditableFields.district.default(CRM_CONTACT_DEFAULTS.district),
  status: contactEditableFields.status.default(CRM_CONTACT_DEFAULTS.status),
  tags: contactEditableFields.tags.default([]),
  /**
   * The version this edit was based on — the `updated_at` the editor was opened
   * with. Optional, so an existing caller without it keeps the old behaviour, but
   * the editor always sends it and it is what turns two organizers editing one
   * contact from last-write-wins into a reported conflict.
   */
  updated_at: z.string().nullable().optional(),
});

/**
 * An edit is a patch: absent fields are left alone, not defaulted.
 *
 * `id` is required here because this schema is only chosen when the caller sent
 * one. `email` stays required since it is the contact's identity column. Every
 * other field is optional, so the inline directory and 360 handlers can change
 * one attribute without rewriting the rest of the row.
 */
const contactUpdateSchema = z.object({
  id: z.string().uuid(),
  ...contactEditableFields,
  district: contactEditableFields.district.optional(),
  status: contactEditableFields.status.optional(),
  tags: contactEditableFields.tags.optional(),
  updated_at: z.string().nullable().optional(),
});
const noteSchema = z.object({
  contactId: z.string().uuid(),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or fewer'),
  description: z.string().trim().max(2000, 'Notes must be 2000 characters or fewer').optional(),
});
export type SaveCRMContactResult = CRMResult<{
  contactId?: string;
  /**
   * Why the save was refused. `conflict` is the optimistic-concurrency refusal —
   * a colleague saved the same contact while this form was open — and
   * `duplicate_email` is the unique constraint catching a create or re-key that
   * raced the editor's preflight. Both need copy other than "failed to save".
   */
  reason?: 'conflict' | 'duplicate_email';
  /**
   * The row's new `updated_at`, written by the `touch_updated_at` trigger. The
   * editor adopts it so its next save is based on the database's version rather
   * than on a timestamp its own clock produced.
   */
  updatedAt?: string | null;
  /**
   * Set when the contact write succeeded but its timeline entry did not. The
   * caller must report this as a warning, never as a failed save: retrying would
   * duplicate the contact change.
   */
  warning?: string;
  /**
   * The contact that owns the normalized email when the unique constraint
   * rejects this write. The editor normally catches this in its preflight; this
   * is the race-condition path, where another organizer created or re-keyed a
   * contact between the preflight and the write.
   */
  duplicateContact?: CRMContact;
}>;

const DUPLICATE_EMAIL_ERROR = 'That email already belongs to another constituent.';

function isDuplicateEmailError(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

/**
 * Resolve the row the unique constraint collided with. Best-effort by design: a
 * failed lookup must not replace the duplicate-email sentence with a database
 * error, and the constraint has already refused the write either way.
 */
async function findDuplicateContact(
  adminClient: AdminClient,
  normalizedEmail: string,
  excludeId?: string
): Promise<CRMContact | null> {
  try {
    let query = adminClient.from('crm_contacts').select('*').eq('email', normalizedEmail);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query.maybeSingle();
    return (data as CRMContact | null) ?? null;
  } catch {
    return null;
  }
}

async function duplicateEmailFailure(
  adminClient: AdminClient,
  normalizedEmail: string,
  excludeId?: string
): Promise<SaveCRMContactResult> {
  const duplicateContact = await findDuplicateContact(adminClient, normalizedEmail, excludeId);
  return {
    success: false,
    error: DUPLICATE_EMAIL_ERROR,
    reason: 'duplicate_email',
    ...(duplicateContact ? { duplicateContact } : {}),
  };
}

export async function saveCRMContact(
  rawInput: z.input<typeof contactSchema>
): Promise<SaveCRMContactResult> {
  const { adminClient, adminUserId } = await requireCRMAdmin();

  // A create fills the defaults (status, district, tags); an edit must not.
  // Parsing an edit against `contactSchema` made every omitted field look like
  // an intentional value, so a one-field inline change rewrote the rest.
  const parsed = rawInput.id
    ? contactUpdateSchema.safeParse(rawInput)
    : contactSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { id, ...data } = parsed.data;
  const normalizedEmail = normalizeCRMEmail(data.email);

  if (id) {
    /*
      Optimistic concurrency, mirroring `saveContent`'s `expectedUpdatedAt`.

      The read-then-update here was last-write-wins with no signal: two organizers
      editing one contact both read, both wrote, and the second silently discarded
      the first's changes. That is the default outcome of the one surface whose
      purpose is to look after other people's data, and `saveContent` fixed the
      identical problem for CMS pages while the CRM kept it.

      The precondition rides on the UPDATE rather than on a SELECT-then-UPDATE,
      which would leave a window in which a colleague's save still lands between
      the check and the write. `crm_contacts.updated_at` is maintained by the
      `touch_updated_at` trigger (migration 20260930140000), so the value the
      editor sends back is the database's, not a second clock's.

      A null claim uses `.is()`, never `.eq()`: `.eq('updated_at', null)` is
      `col=eq.null` in PostgREST and matches nothing, so the guard would fire
      against every untouched row. Same trap `saveContent`'s version precondition
      documents, and the reason it is written down at all.
    */
    const expectedUpdatedAt = data.updated_at ?? null;

    const { data: previous, error: previousError } = await adminClient
      .from('crm_contacts')
      .select('status, email, tags, notes, updated_at')
      .eq('id', id)
      .maybeSingle();

    // A volunteer has this form open on a contact a colleague deleted, merged
    // away, or that the historical sync re-keyed. A read failure must not be
    // reported as a deletion; only an empty result is that sentence.
    if (previousError) return { success: false, error: previousError.message };
    if (!previous) return { success: false, error: 'That contact no longer exists' };

    // `status` is optional on an edit now. Only a status the caller actually
    // sent can have changed, and an omitted one keeps the row's current value.
    const nextStatus = data.status ?? previous.status;
    const statusChanged = data.status !== undefined && previous.status !== data.status;

    // `updated_at` is deliberately *not* in this payload. It is the expected
    // version, not the new one: writing it back would overwrite the value the
    // `touch_updated_at` trigger is about to write with the stale one, which makes
    // the next save by anyone conflict with itself. The trigger owns the column.
    // (`id` was already destructured out of `data` above.)
    const { updated_at: _expected, ...writable } = data;
    const updatePayload: CRMContactUpdate = {
      ...writable,
      email: normalizedEmail,
    };

    // `.maybeSingle()`, not `.single()`. `.single()` turns "matched no row" into
    // a PGRST116 *error*, which is indistinguishable from a genuine failure — and
    // a conflict reported as "JSON object requested, multiple (or no) rows
    // returned" tells the volunteer nothing about the two-organizers case this
    // guard exists for. `maybeSingle()` resolves `{ data: null }` for zero rows,
    // which is the one shape that means exactly that.
    let updateQuery = adminClient.from('crm_contacts').update(updatePayload).eq('id', id);
    if (expectedUpdatedAt) updateQuery = updateQuery.eq('updated_at', expectedUpdatedAt);
    else updateQuery = updateQuery.is('updated_at', null);

    const { data: updated, error } = await updateQuery.select('id, updated_at').maybeSingle();

    // The read above already proved the row exists, so "matched no row" here can
    // only mean the precondition failed — somebody else saved in between. That is
    // the conflict. Anything else is a real failure and reported as one.
    if (!error && !updated) {
      return {
        success: false,
        error:
          'Someone else saved this contact while you were editing. Reload to see their changes, then re-apply yours.',
        reason: 'conflict',
      };
    }
    if (error) {
      // The editor preflights the normalized email, but the unique constraint is
      // still the claim. A concurrent create or re-key can win between that
      // lookup and this UPDATE; surface the same duplicate state so the editor
      // can offer Open or Merge instead of a raw Postgres code.
      return isDuplicateEmailError(error)
        ? duplicateEmailFailure(adminClient, normalizedEmail, id)
        : { success: false, error: error.message };
    }
    if (!updated) return { success: false, error: 'That contact no longer exists' };

    const { error: activityError } = await adminClient.from('crm_activities').insert({
      contact_id: id,
      type: 'status_change',
      title: statusChanged ? 'Status Changed' : 'Constituent Profile Updated',
      description: statusChanged
        ? `Status moved from "${previous.status}" to "${nextStatus}"`
        : `Updated details${data.status ? ` and status (${nextStatus})` : ''}`,
      metadata: statusChanged ? { from: previous.status, to: nextStatus } : {},
      created_by: adminUserId,
    });

    revalidateCRMRoutes(id);
    // The update's own SELECT returns the trigger-written value, so the editor's
    // next save is based on the database's version without a second read that
    // could fail after the write has already committed.
    return {
      success: true,
      contactId: updated.id,
      updatedAt: updated.updated_at ?? null,
      ...(activityError ? { warning: CRM_ACTIVITY_WARNING } : {}),
    };
  }

  // Insert new contact. `updated_at` is dropped for the same reason as the update
  // path: it is the precondition, not a value, and the column is maintained by
  // `touch_updated_at`.
  const { updated_at: _expected, ...insertable } = data;
  const { data: created, error } = await adminClient
    .from('crm_contacts')
    .insert({
      ...insertable,
      email: normalizedEmail,
      source: 'manual',
      // Explicitly write NULL, not a DB default that could later become false.
      do_not_email: CRM_CONTACT_DEFAULTS.doNotEmail,
    })
    .select('id')
    .single();

  if (error) {
    return isDuplicateEmailError(error)
      ? duplicateEmailFailure(adminClient, normalizedEmail)
      : { success: false, error: error.message };
  }

  const { error: activityError } = await adminClient.from('crm_activities').insert({
    contact_id: created.id,
    type: 'note',
    title: 'Constituent Created',
    description: 'Manually added to CRM directory',
    created_by: adminUserId,
  });

  revalidateCRMRoutes(created.id);
  return {
    success: true,
    contactId: created.id,
    ...(activityError ? { warning: CRM_ACTIVITY_WARNING } : {}),
  };
}

export async function deleteCRMContact(id: string): Promise<CRMResult> {
  const admin = await requireCRMAdmin();
  const { adminClient } = admin;

  // Read the row before deleting it. The audit record needs the values that
  // disappeared, and a delete alone cannot return them to the caller without
  // another round trip after they are already gone.
  const { data: existing, error: readError } = await adminClient
    .from('crm_contacts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (readError) return { success: false, error: readError.message };
  if (!existing) return { success: false, error: 'That contact no longer exists' };

  // Ask for the deleted row back. Without `.select()`, PostgREST reports
  // success for a delete that matched nothing, and the UI tells the organizer
  // a stale contact was removed when it never existed.
  const { data: deleted, error } = await adminClient
    .from('crm_contacts')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error || !deleted) {
    const message = error?.message || 'That contact no longer exists';
    await recordCRMAudit(admin, {
      action: 'crm.contact.delete',
      targetType: 'crm_contact',
      targetId: id,
      targetLabel: existing.email || null,
      before: existing,
      after: null,
      outcome: 'failure',
      error: message,
    });
    return { success: false, error: message };
  }

  await recordCRMAudit(admin, {
    action: 'crm.contact.delete',
    targetType: 'crm_contact',
    targetId: id,
    targetLabel: existing.email || null,
    before: existing,
    after: null,
    outcome: 'success',
  });

  revalidateCRMRoutes();
  return { success: true };
}

/**
 * Read-only preflight for a bulk update.
 *
 * The selection survives paging, so the loaded page cannot supply the current
 * distribution. Resolve the exact IDs on the server and return counts before
 * the UI asks the organizer to confirm; this function never writes or audits.
 */
export async function previewBulkCRMContactUpdate({
  contactIds,
  status,
  consent,
  district,
  addTag,
}: {
  contactIds: string[];
  status?: CRMContactStatus;
  consent?: ConsentDecision;
  district?: string;
  addTag?: string;
}): Promise<CRMResult<{ preview?: CRMBulkUpdatePreview }>> {
  const { adminClient } = await requireCRMAdmin();
  const uniqueIds = [...new Set(contactIds ?? [])];
  if (uniqueIds.length === 0) return { success: false, error: 'No contacts selected' };

  const plannedFields = [status, consent, district, addTag].filter((value) => value !== undefined);
  if (plannedFields.length !== 1) {
    return { success: false, error: 'Choose exactly one bulk change to preview' };
  }

  if (status !== undefined && !(CRM_CONTACT_STATUS_VALUES as readonly string[]).includes(status)) {
    return { success: false, error: 'Invalid status' };
  }
  if (consent !== undefined && !CRM_CONTACT_CONSENT_VALUES.includes(consent)) {
    return { success: false, error: 'Invalid consent value' };
  }

  const plannedDistrict = district?.trim();
  if (district !== undefined && !plannedDistrict) {
    return { success: false, error: 'District is required' };
  }

  let plannedTag: string | undefined;
  if (addTag !== undefined) {
    plannedTag = addTag.trim().toLowerCase();
    const parsed = tagSchema.safeParse(plannedTag);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid tag "${addTag.trim().slice(0, MAX_TAG_LENGTH)}"`,
      };
    }
  }

  const { data, error } = await adminClient
    .from('crm_contacts')
    .select(BULK_AUDIT_CONTACT_COLUMNS)
    .in('id', uniqueIds);
  if (error) return { success: false, error: error.message };

  const contacts = (data ?? []) as BulkAuditContact[];
  let preview: CRMBulkUpdatePreview;

  if (status !== undefined) {
    const changedCount = contacts.filter((contact) => contact.status !== status).length;
    preview = {
      field: 'status',
      selectedCount: uniqueIds.length,
      foundCount: contacts.length,
      changedCount,
      unchangedCount: contacts.length - changedCount,
      plannedValue: status,
      distribution: countBulkDistribution(contacts.map((contact) => contact.status ?? '')),
    };
  } else if (consent !== undefined) {
    const changedCount = contacts.filter(
      (contact) => crmContactConsentValue(contact.do_not_email ?? null) !== consent
    ).length;
    preview = {
      field: 'consent',
      selectedCount: uniqueIds.length,
      foundCount: contacts.length,
      changedCount,
      unchangedCount: contacts.length - changedCount,
      plannedValue: consent,
      distribution: countBulkDistribution(
        contacts.map((contact) => crmContactConsentValue(contact.do_not_email ?? null))
      ),
    };
  } else if (plannedDistrict !== undefined) {
    const changedCount = contacts.filter(
      (contact) => (contact.district ?? '').trim() !== plannedDistrict
    ).length;
    preview = {
      field: 'district',
      selectedCount: uniqueIds.length,
      foundCount: contacts.length,
      changedCount,
      unchangedCount: contacts.length - changedCount,
      plannedValue: plannedDistrict,
      distribution: countBulkDistribution(
        contacts.map((contact) => (contact.district ?? '').trim())
      ),
    };
  } else {
    const planned = plannedTag ?? '';
    const changedCount = contacts.filter(
      (contact) =>
        !(Array.isArray(contact.tags) ? contact.tags : []).some(
          (tag) => tag.toLowerCase() === planned
        )
    ).length;
    const tagValues = contacts.flatMap((contact) => {
      const tags = Array.isArray(contact.tags) ? contact.tags : [];
      return tags.length > 0 ? tags : [''];
    });
    preview = {
      field: 'tags',
      selectedCount: uniqueIds.length,
      foundCount: contacts.length,
      changedCount,
      unchangedCount: contacts.length - changedCount,
      plannedValue: planned,
      distribution: countBulkDistribution(tagValues),
    };
  }

  return { success: true, preview };
}

export async function bulkUpdateCRMContacts({
  contactIds,
  status,
  district,
  consent,
  addTags,
  removeTags,
}: {
  contactIds: string[];
  status?: string;
  district?: string;
  /**
   * Bulk consent change (`opted_in` / `opted_out` / `unasked`).
   *
   * Maps to the tri-state `do_not_email` column (`false` / `true` / NULL) plus
   * `unsubscribed_at` for opt-outs — the same mapping `setCRMEmailConsent`
   * uses. No per-contact activity row: a 5,000-row bulk would flood timelines.
   * One operation-level admin audit row records the actor, counts and fields;
   * single-contact consent changes still go through `setCRMEmailConsent` with
   * its activity entry.
   */
  consent?: ConsentDecision;
  addTags?: string[];
  removeTags?: string[];
}): Promise<CRMResult<{ updatedCount?: number; warning?: string }>> {
  const admin = await requireCRMAdmin();
  const { adminClient } = admin;

  if (!contactIds || contactIds.length === 0) {
    return { success: false, error: 'No contacts selected' };
  }

  if (status && !(CRM_CONTACT_STATUS_VALUES as readonly string[]).includes(status)) {
    return { success: false, error: 'Invalid status' };
  }

  if (consent && !CRM_CONTACT_CONSENT_VALUES.includes(consent)) {
    return { success: false, error: 'Invalid consent value' };
  }

  /*
   * Bulk-added tags go through the same shape rule as a hand-edited contact.
   * `normalizeTags` lowercases and dedupes but accepts anything — without this
   * check a bulk add could store a comma (which silently splits into two tags
   * on the next `?tag=a,b` read), angle brackets, or a 200-character string,
   * all of which the single-contact schema refuses. `removeTags` is
   * deliberately unchecked: an entry that matches nothing removes nothing, and
   * refusing it would strand legacy rows carrying tags this rule predates.
   */
  if (addTags?.length) {
    for (const candidate of addTags) {
      const parsed = tagSchema.safeParse(candidate);
      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid tag "${candidate.trim().slice(0, MAX_TAG_LENGTH)}"`,
        };
      }
    }
  }

  const changedFields = [
    ...(status ? ['status'] : []),
    ...(district ? ['district'] : []),
    ...(addTags?.length || removeTags?.length ? ['tags'] : []),
    ...(consent ? ['consent'] : []),
  ];
  const auditFields: BulkAuditFieldSet = {
    status: Boolean(status),
    district: Boolean(district),
    tags: Boolean(addTags?.length || removeTags?.length),
    consent: Boolean(consent),
  };
  /*
   * One operation-level audit row, not one per contact: a 5,000-row bulk would
   * flood both the audit log and each timeline. The before/after snapshots carry
   * only the fields this operation changed for each affected contact, so an
   * admin can identify exactly what changed without copying full CRM profiles
   * into the audit table.
   */
  const auditBulkUpdate = (
    outcome: 'success' | 'failure',
    updatedCount?: number,
    error?: string,
    changes: BulkContactChange[] = [],
    affectedIds: string[] = changes.map((change) => change.id)
  ) =>
    recordCRMAudit(admin, {
      action: 'crm.contact.bulk_update',
      targetType: 'crm_contact',
      targetId: contactIds.length === 1 ? contactIds[0] : 'bulk-update',
      targetLabel: `${contactIds.length} selected contact${contactIds.length === 1 ? '' : 's'}`,
      before: changes.length
        ? { contact_ids: affectedIds, contacts: changes.map((change) => change.before) }
        : null,
      after: changes.length
        ? { contact_ids: affectedIds, contacts: changes.map((change) => change.after) }
        : null,
      outcome,
      error: error ?? null,
      metadata: {
        requested_count: contactIds.length,
        requested_ids: contactIds,
        ...(affectedIds.length
          ? { affected_count: affectedIds.length, affected_ids: affectedIds }
          : {}),
        ...(updatedCount === undefined ? {} : { updated_count: updatedCount }),
        changed_fields: changedFields,
        field_changes: bulkAuditFieldChanges(changes, auditFields),
      },
    });

  const now = new Date().toISOString();
  const consentPatch: Record<string, string | boolean | null> =
    consent === undefined
      ? {}
      : {
          do_not_email: crmContactDoNotEmail(consent),
          ...(consent === 'opted_out' ? { unsubscribed_at: now } : {}),
        };

  // If no tag changes are requested, execute a single direct bulk update
  if (!addTags?.length && !removeTags?.length) {
    const payload: Database['public']['Tables']['crm_contacts']['Update'] = {
      updated_at: now,
      ...consentPatch,
    };
    if (status)
      payload.status = status as Database['public']['Tables']['crm_contacts']['Update']['status'];
    if (district) payload.district = district;

    // Capture the previous values before the write. The update returns the
    // affected rows below, so this pair lets us record exactly which contacts
    // changed and what they changed from.
    const { data: beforeData } = await adminClient
      .from('crm_contacts')
      .select(BULK_AUDIT_CONTACT_COLUMNS)
      .in('id', contactIds);
    const beforeRows = (beforeData ?? []) as BulkAuditContact[];
    const beforeById = new Map(beforeRows.map((contact) => [contact.id, contact]));

    const { error, count } = await adminClient
      .from('crm_contacts')
      .update(payload, { count: 'exact' })
      .in('id', contactIds);

    if (error) {
      await auditBulkUpdate('failure', undefined, error.message);
      return { success: false, error: error.message };
    }
    if (count === 0) {
      const message = 'None of the selected constituents still exist';
      await auditBulkUpdate('failure', 0, message);
      return { success: false, error: message };
    }

    // Read the affected rows back rather than projecting the request in memory:
    // database defaults and triggers can change the stored values, and admins
    // need the audit trail to match what actually landed.
    const { data: afterData } = await adminClient
      .from('crm_contacts')
      .select(BULK_AUDIT_CONTACT_COLUMNS)
      .in('id', contactIds);
    const afterRows = (afterData ?? []) as BulkAuditContact[];
    const afterById = new Map(afterRows.map((contact) => [contact.id, contact]));
    const affectedIds =
      afterRows.length > 0 ? afterRows.map((contact) => contact.id) : count ? contactIds : [];
    const changes: BulkContactChange[] = affectedIds.flatMap((id) => {
      const before = beforeById.get(id);
      if (!before) return [];
      const after = afterById.get(id) ?? ({ ...before, ...payload } as BulkAuditContact);
      return [
        {
          id,
          before: snapshotBulkContact(before, auditFields),
          after: snapshotBulkContact(after, auditFields),
        },
      ];
    });

    const audit = await auditBulkUpdate(
      'success',
      count ?? undefined,
      undefined,
      changes,
      affectedIds
    );
    const warning = crmAuditWarning(audit);
    revalidateCRMRoutes();
    // A missing exact count is not zero. The update has already succeeded, so
    // omit the number rather than telling the organizer nothing changed.
    return {
      success: true,
      ...(count === null ? {} : { updatedCount: count }),
      ...(warning ? { warning } : {}),
    };
  }

  // When modifying tags, fetch existing tags, apply set modifications, and persist
  const { data: contacts, error: fetchErr } = await adminClient
    .from('crm_contacts')
    .select(BULK_AUDIT_CONTACT_COLUMNS)
    .in('id', contactIds);

  if (fetchErr) {
    await auditBulkUpdate('failure', undefined, fetchErr.message);
    return { success: false, error: fetchErr.message };
  }
  if (!contacts?.length) {
    const message = 'None of the selected constituents still exist';
    await auditBulkUpdate('failure', 0, message);
    return { success: false, error: message };
  }

  const normAdd = addTags ? normalizeTags(addTags) : [];
  const normRemove = new Set((removeTags || []).map((t) => t.trim().toLowerCase()));

  /*
   * PostgREST cannot merge an array element atomically across rows without an
   * RPC, so this path updates one row at a time and can stop halfway. The
   * previous return said only "connection reset", which a bulk-action toast
   * cannot distinguish from "nothing changed" — an organizer would retry an
   * operation that had already touched part of the selection. Report the count
   * that did land and say the rest did not, rather than pretending either all
   * succeeded or none did.
   */
  let updated = 0;
  const changes: BulkContactChange[] = [];
  for (const c of contacts || []) {
    let currentTags = Array.isArray(c.tags) ? c.tags : [];
    if (normRemove.size > 0) {
      currentTags = currentTags.filter((t) => !normRemove.has(t.toLowerCase()));
    }
    if (normAdd.length > 0) {
      currentTags = normalizeTags([...currentTags, ...normAdd]);
    }
    const updatePayload: Database['public']['Tables']['crm_contacts']['Update'] = {
      tags: currentTags.slice(0, MAX_TAGS_PER_CONTACT),
      updated_at: now,
      ...consentPatch,
    };
    if (status)
      updatePayload.status =
        status as Database['public']['Tables']['crm_contacts']['Update']['status'];
    if (district) updatePayload.district = district;

    const { data: updatedContact, error: updateError } = await adminClient
      .from('crm_contacts')
      .update(updatePayload)
      .eq('id', c.id)
      .select(BULK_AUDIT_CONTACT_COLUMNS)
      .maybeSingle();
    if (updateError) {
      const message =
        updated === 0
          ? updateError.message
          : `${updateError.message} — ${updated} of ${contacts.length} selected contacts were updated before the failure; the rest were not.`;
      await auditBulkUpdate('failure', updated, message, changes);
      return { success: false, updatedCount: updated, error: message };
    }
    if (!updatedContact) {
      const message =
        updated === 0
          ? 'A selected contact no longer exists'
          : `A selected contact no longer exists after ${updated} of ${contacts.length} selected contacts were updated; the rest were not.`;
      await auditBulkUpdate('failure', updated, message, changes);
      return { success: false, updatedCount: updated, error: message };
    }
    const before = c as BulkAuditContact;
    const after = { ...before, ...updatePayload, ...updatedContact } as BulkAuditContact;
    changes.push({
      id: c.id,
      before: snapshotBulkContact(before, auditFields),
      after: snapshotBulkContact(after, auditFields),
    });
    updated += 1;
  }

  const audit = await auditBulkUpdate('success', contacts.length, undefined, changes);
  const warning = crmAuditWarning(audit);
  revalidateCRMRoutes();
  return {
    success: true,
    updatedCount: contacts.length,
    ...(warning ? { warning } : {}),
  };
}

export async function bulkDeleteCRMContacts(
  contactIds: string[]
): Promise<CRMResult<{ deletedCount?: number; warning?: string }>> {
  const admin = await requireCRMAdmin();
  const { adminClient } = admin;

  if (!contactIds || contactIds.length === 0) {
    return { success: false, error: 'No contacts selected' };
  }

  // Read the selected rows first so the audit record names what was removed.
  // The delete's count alone cannot say which constituents it matched, and a
  // read failure must not block a deletion the caller has already confirmed.
  const { data: selectedRows } = await adminClient
    .from('crm_contacts')
    .select('id, email, first_name, last_name')
    .in('id', contactIds);

  const selectedById = new Map(
    (selectedRows ?? []).map((contact) => [contact.id, contact as Record<string, unknown>])
  );
  const auditBulkDelete = (
    outcome: 'success' | 'failure',
    deletedCount?: number,
    error?: string,
    affectedIds: string[] = []
  ) => {
    const changes = affectedIds.map((id) => ({
      id,
      before: deletedById.get(id) ?? selectedById.get(id) ?? { id },
      after: { id, deleted: true },
    }));
    return recordCRMAudit(admin, {
      action: 'crm.contact.bulk_delete',
      targetType: 'crm_contact',
      targetId: contactIds.length === 1 ? contactIds[0] : 'bulk-delete',
      targetLabel: `${contactIds.length} selected contact${contactIds.length === 1 ? '' : 's'}`,
      before: changes.length
        ? { contact_ids: affectedIds, contacts: changes.map((change) => change.before) }
        : null,
      after: changes.length
        ? { contact_ids: affectedIds, contacts: changes.map((change) => change.after) }
        : null,
      outcome,
      error: error ?? null,
      metadata: {
        requested_count: contactIds.length,
        requested_ids: contactIds,
        ...(affectedIds.length
          ? { affected_count: affectedIds.length, affected_ids: affectedIds }
          : {}),
        ...(deletedCount === undefined ? {} : { deleted_count: deletedCount }),
      },
    });
  };

  const {
    error,
    count,
    data: deletedData,
  } = await adminClient
    .from('crm_contacts')
    .delete({ count: 'exact' })
    .in('id', contactIds)
    .select('id, email, first_name, last_name');

  if (error) {
    await auditBulkDelete('failure', undefined, error.message);
    return { success: false, error: error.message };
  }
  if (count === 0) {
    const message = 'None of the selected constituents still exist';
    await auditBulkDelete('failure', 0, message);
    return { success: false, error: message };
  }

  const deletedRows = (
    Array.isArray(deletedData) ? deletedData : deletedData ? [deletedData] : []
  ) as { id: string }[];
  const deletedById = new Map(
    deletedRows.map((contact) => [contact.id, contact as Record<string, unknown>])
  );
  const affectedIds =
    deletedRows.length > 0 ? deletedRows.map((row) => row.id) : count ? contactIds : [];
  const audit = await auditBulkDelete('success', count ?? undefined, undefined, affectedIds);
  const warning = crmAuditWarning(audit);
  revalidateCRMRoutes();
  // Same rule as the update above: do not turn an unavailable count into a
  // claim that zero constituents were deleted.
  return {
    success: true,
    ...(count === null ? {} : { deletedCount: count }),
    ...(warning ? { warning } : {}),
  };
}

export async function addCRMNote({
  contactId,
  title,
  description,
}: {
  contactId: string;
  title: string;
  description: string;
}): Promise<CRMResult> {
  const { adminClient, adminUserId } = await requireCRMAdmin();

  const parsed = noteSchema.safeParse({ contactId, title, description });
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { error } = await adminClient.from('crm_activities').insert({
    contact_id: parsed.data.contactId,
    type: 'note',
    title: parsed.data.title,
    description: parsed.data.description?.trim() || null,
    created_by: adminUserId,
  });

  if (error) return { success: false, error: error.message };

  revalidateCRMRoutes(parsed.data.contactId);
  return { success: true };
}

export async function updateCRMNote({
  activityId,
  title,
  description,
}: {
  activityId: string;
  title: string;
  description: string;
}): Promise<CRMResult> {
  const { adminClient } = await requireCRMAdmin();

  if (!title.trim()) return { success: false, error: 'Title is required' };

  const { data, error } = await adminClient
    .from('crm_activities')
    .update({
      title: title.trim(),
      description: description.trim() || null,
    })
    .eq('id', activityId)
    .eq('type', 'note')
    .select('contact_id')
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'That note no longer exists' };

  revalidateCRMRoutes(data.contact_id);
  return { success: true };
}

export async function deleteCRMNote(activityId: string): Promise<CRMResult> {
  const { adminClient } = await requireCRMAdmin();

  const { data, error } = await adminClient
    .from('crm_activities')
    .delete()
    .eq('id', activityId)
    .eq('type', 'note')
    .select('contact_id')
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'That note no longer exists' };

  revalidateCRMRoutes(data.contact_id);
  return { success: true };
}

/**
 * An admin's decision about one contact's email consent.
 *
 * Three values because the column stores three (migration 20261005020000), and
 * the middle one is the point: `'unasked'` records "we have never put this to
 * them", which is a true statement about the relationship and not a synonym for
 * a yes.
 *
 * Reachable from the 360 panel. Before this it was a boolean toggle, so an
 * organiser could mark somebody opted out or opted in but had no way to say
 * "unknown" — and the nearest thing they could do, clearing the flag, recorded a
 * *yes* they had not been given.
 */

export async function setCRMEmailConsent({
  contactId,
  doNotEmail,
}: {
  contactId: string;
  doNotEmail: ConsentDecision;
}): Promise<CRMResult<{ warning?: string }>> {
  const { adminClient, adminUserId } = await requireCRMAdmin();
  const now = new Date().toISOString();

  const storedValue = crmContactDoNotEmail(doNotEmail);

  /*
    Cast, because `src/types/supabase.ts` is generated from the live project and
    types `do_not_email` as `boolean` until migration 20261005020000 has been
    applied. The `CRMContactUpdate` shape is spelled out here rather than left to
    inference so a future removal of the cast fails on the *value*, not silently
    on the type.
  */
  const consentPayload = {
    do_not_email: storedValue,
    /*
     * The timestamp follows the consent rather than being cleared on any
     * non-opt-out. Restoring consent is not the same as erasing the evidence
     * that somebody once unsubscribed, and an organiser reading this profile
     * six months later is better served by a date than by a blank. The
     * unsubscribe route keeps its own behaviour — it is the only thing that
     * creates one.
     */
    ...(doNotEmail === 'opted_out' ? { unsubscribed_at: now } : {}),
    updated_at: now,
  } as CRMContactUpdate;

  const { data: updated, error } = await adminClient
    .from('crm_contacts')
    .update(consentPayload)
    .eq('id', contactId)
    .select('id')
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!updated) return { success: false, error: 'That contact no longer exists' };

  const ACTIVITY: Record<ConsentDecision, { title: string; description: string }> = {
    opted_out: {
      title: 'Email Consent Revoked',
      description: 'Marked do-not-email — excluded from all broadcasts.',
    },
    opted_in: {
      title: 'Email Consent Restored',
      description: 'Re-subscribed for chapter email broadcasts.',
    },
    unasked: {
      title: 'Email Consent Marked Unknown',
      description:
        'Consent reset to "never asked" — excluded from broadcasts until this person opts in.',
    },
  };

  const { error: activityError } = await adminClient.from('crm_activities').insert({
    contact_id: contactId,
    type: 'note',
    ...ACTIVITY[doNotEmail],
    created_by: adminUserId,
  });

  revalidateCRMRoutes(contactId);
  return {
    success: true,
    ...(activityError ? { warning: CRM_ACTIVITY_WARNING } : {}),
  };
}

export async function importCRMContacts({ csv }: { csv: string }): Promise<
  CRMResult<{
    imported?: number;
    skipped?: number;
    /** Rows the parser could not turn into a contact at all — distinct from
     *  `skipped`, which counts valid rows already in the directory. `skipped +
     *  invalidRows + imported + (rows that failed at insert) === rows parsed`,
     *  so the volunteer can reconcile the four numbers against their file. */
    invalidRows?: number;
    errors?: CRMImportError[];
    /** Set when contacts landed but their timeline entries did not. */
    warning?: string;
  }>
> {
  const admin = await requireCRMAdmin();
  const { adminClient, adminUserId } = admin;
  let parsedRows = 0;
  let invalidRows = 0;
  let failedRows = 0;

  const auditImport = (
    outcome: 'success' | 'failure',
    details: {
      imported?: number;
      skipped?: number;
      errors?: CRMImportError[];
      error?: string;
    } = {}
  ) => {
    const errors = details.errors ?? [];
    return recordCRMAudit(admin, {
      action: 'crm.contacts.import',
      targetType: 'crm_operation',
      targetId: 'crm-import',
      targetLabel: 'CSV constituent import',
      outcome,
      error: details.error ?? null,
      metadata: {
        format: 'csv',
        csv_chars: csv.length,
        total_row_count: parsedRows + invalidRows,
        parsed_row_count: parsedRows,
        invalid_row_count: invalidRows,
        imported_count: details.imported ?? 0,
        skipped_count: details.skipped ?? 0,
        failed_row_count: failedRows,
        error_count: errors.length,
        errors: errors.slice(0, 50),
      },
    });
  };

  if (!csv.trim()) {
    await auditImport('failure', { error: 'CSV content is required' });
    return { success: false, error: 'CSV content is required' };
  }
  if (csv.length > 500_000) {
    await auditImport('failure', { error: 'CSV too large (max 500KB)' });
    return { success: false, error: 'CSV too large (max 500KB)' };
  }

  const { rows, errors } = parseCRMImportCsv(csv);
  parsedRows = rows.length;
  invalidRows = errors.length;
  if (rows.length === 0) {
    await auditImport('failure', { errors, error: 'No valid rows found in CSV' });
    return { success: false, errors, error: 'No valid rows found in CSV' };
  }
  if (rows.length > 2000) {
    await auditImport('failure', { errors, error: 'Import capped at 2000 rows per upload' });
    return { success: false, error: 'Import capped at 2000 rows per upload' };
  }

  // Case-insensitive existing-email pre-check. PostgREST `.in('email', …)` is
  // case-sensitive, but order/contact-form syncs write `lower(email)` while
  // older rows may retain mixed case — a miss lets UNIQUE violations poison
  // an entire insert chunk (all-or-nothing per 100-row batch).
  const emails = rows.map((r) => r.email);
  const existingSet = new Set<string>();
  const LOOKUP_CHUNK = 50;
  for (let i = 0; i < emails.length; i += LOOKUP_CHUNK) {
    const slice = emails.slice(i, i + LOOKUP_CHUNK);
    const orFilter = slice.map((e) => `email.ilike.${escapeIlike(e)}`).join(',');
    const { data: existing, error: lookupError } = await adminClient
      .from('crm_contacts')
      .select('email')
      .or(orFilter)
      // Bounded by construction — the chunk holds 50 emails and `email` is
      // unique — but stated rather than implied, so a later chunk-size change
      // cannot silently unbound it.
      .limit(LOOKUP_CHUNK);
    if (lookupError) {
      await auditImport('failure', {
        errors,
        error: `Existing-email lookup failed: ${lookupError.message}`,
      });
      return {
        success: false,
        error: `Existing-email lookup failed: ${lookupError.message}`,
        errors,
      };
    }
    for (const row of existing || []) {
      existingSet.add(row.email.toLowerCase());
    }
  }

  const toInsert = rows
    .filter((r) => !existingSet.has(r.email.toLowerCase()))
    .map((r) => ({
      email: r.email,
      first_name: r.first_name,
      last_name: r.last_name,
      phone: r.phone,
      // `address` was missing from this mapping as well as from the parser, so
      // adding the column to the import was necessary but not sufficient: the
      // row parsed it and the insert dropped it on the floor. Both halves of a
      // round trip, or neither.
      address: r.address,
      city: r.city,
      zip_code: r.zip_code,
      district: r.district,
      status: r.status,
      tags: r.tags,
      notes: r.notes,
      // The exporter writes this column and the importer used to drop it — so a
      // backup round-trip silently re-subscribed everyone who had opted out, and
      // the next broadcast mailed them anyway. Carry it through.
      //
      // `null` is carried too, not flattened to `false`: a restore has to
      // preserve "never asked", or the second round-trip of the same file
      // enrols everybody who was never asked.
      do_not_email: r.do_not_email,
      source: 'import',
    }));

  const skipped = rows.length - toInsert.length;
  let imported = 0;
  const insertErrors: CRMImportError[] = [...errors];

  // Chunked inserts (PostgREST default max array params).
  const CHUNK = 100;
  let activityFailed = false;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    // The generated `Insert` type says `do_not_email?: boolean` until migration
    // 20261005020000 is applied; the value genuinely is `boolean | null` now, and
    // the column is nullable in the database the moment it lands. Casting the
    // payload rather than the client keeps the rest of the chain typed.
    const payload = chunk as unknown as CRMContactInsert[];
    const { data: created, error } = await adminClient
      .from('crm_contacts')
      .insert(payload)
      .select('id');

    if (error) {
      failedRows += chunk.length;
      insertErrors.push({
        line: 0,
        message:
          `Insert failed for a batch of ${chunk.length} rows ` +
          `(rows ${i + 1}–${i + chunk.length} of ${toInsert.length} new contacts): ${error.message}`,
      });
      continue;
    }
    const ids = (created || []).map((c) => c.id);
    imported += ids.length;

    if (ids.length > 0) {
      const { error: activityError } = await adminClient.from('crm_activities').insert(
        ids.map((contactId) => ({
          contact_id: contactId,
          type: 'import',
          title: 'Imported from CSV',
          description: `Batch import of ${toInsert.length} contacts`,
          created_by: adminUserId,
        }))
      );
      if (activityError) activityFailed = true;
    }
  }

  // Only report success when work actually landed. A green toast on
  // "Imported 0, skipped N" (e.g. every insert failed) is a false positive.
  const insertFailed = insertErrors.some((e) => e.message.startsWith('Insert failed'));
  const success = imported > 0 || (skipped > 0 && !insertFailed);
  const error = success
    ? undefined
    : insertFailed
      ? 'All inserts failed — no contacts were imported'
      : undefined;

  await auditImport(success ? 'success' : 'failure', {
    imported,
    skipped,
    errors: insertErrors,
    error,
  });

  revalidateCRMRoutes();
  return {
    success,
    imported,
    skipped,
    invalidRows: errors.length,
    errors: insertErrors.slice(0, 50),
    error,
    ...(activityFailed
      ? {
          warning:
            'Imported, but one or more CRM timeline entries could not be recorded. The activity log is incomplete.',
        }
      : {}),
  };
}

export async function mergeCRMContacts({
  keepId,
  removeId,
}: {
  keepId: string;
  removeId: string;
}): Promise<CRMResult> {
  const admin = await requireCRMAdmin();
  const { adminClient, adminUserId } = admin;
  const targetId = keepId.trim() || 'crm-merge';
  let keepContact: CRMContact | null = null;
  let removeContact: CRMContact | null = null;

  const auditMerge = (outcome: 'success' | 'failure', error?: string, before?: unknown) =>
    recordCRMAudit(admin, {
      action: 'crm.contact.merge',
      targetType: 'crm_contact',
      targetId,
      targetLabel:
        [keepContact?.email, removeContact?.email].filter(Boolean).join(' + ') || 'Contact merge',
      before: before ?? null,
      after:
        outcome === 'success'
          ? { kept_contact_id: keepId, removed_contact_id: removeId, merged: true }
          : null,
      outcome,
      error: error ?? null,
      metadata: {
        keep_id: keepId,
        remove_id: removeId,
        requested_contact_count: 2,
        merged_contact_count: outcome === 'success' ? 1 : 0,
      },
    });

  if (keepId === removeId) {
    const message = 'Cannot merge a contact into itself';
    await auditMerge('failure', message);
    return { success: false, error: message };
  }

  // A failed lookup is not a missing contact. `maybeSingle()` keeps "no row"
  // distinct from a real database error, so the latter is reported as a
  // failure instead of as a merge precondition.
  const [{ data: keepData, error: keepError }, { data: removeData, error: removeError }] =
    await Promise.all([
      adminClient.from('crm_contacts').select('*').eq('id', keepId).maybeSingle(),
      adminClient.from('crm_contacts').select('*').eq('id', removeId).maybeSingle(),
    ]);
  keepContact = (keepData as CRMContact | null) ?? null;
  removeContact = (removeData as CRMContact | null) ?? null;
  const beforeMerge = { contacts: [keepContact, removeContact].filter(Boolean) };

  if (keepError) {
    await auditMerge('failure', keepError.message, beforeMerge);
    return { success: false, error: keepError.message };
  }
  if (removeError) {
    await auditMerge('failure', removeError.message, beforeMerge);
    return { success: false, error: removeError.message };
  }
  if (!keepContact || !removeContact) {
    const message = 'Both contacts must exist to merge';
    await auditMerge('failure', message, beforeMerge);
    return { success: false, error: message };
  }

  /*
    Four statements, previously with no transaction and no lock.

    A failure at step three or four left the duplicate alive with its activities
    and tasks already re-pointed at the survivor: a double-counted timeline, the
    same follow-up appearing twice on the board, and an error message naming only
    the step that happened to fail. Two concurrent merges of the same pair both
    read, both wrote, and both added `total_donated_cents` — so the survivor's
    giving total was inflated by one copy.

    `rpc('merge_crm_contacts', …)` runs the whole thing inside the database as
    one statement, so it either commits or it does not, and it takes the survivor
    row `FOR UPDATE` first so a concurrent merge of the same pair serialises
    behind it and then reads the already-merged state. See migration
    20261005030000_merge_crm_contacts.sql; 20261119150000_crm_canonical_donor.sql
    redeclares it so a donor status is never dropped by the survivor's status.

    The RPC is `SECURITY DEFINER` and service-role-only; `requireAdmin()` above is
    the actual authorization boundary, exactly as for every other action here.
    The RLS policies remain as defence in depth for any future direct client path.
  */
  // Cast, because `src/types/supabase.ts` is generated from the live project and
  // does not list the RPC until migration 20261005030000 has been applied. The
  // signature is declared here rather than left to inference so the parameters
  // are checked at this call site; remove the cast when the types are
  // regenerated against a database that has it.
  const rpc = adminClient as unknown as {
    rpc: (
      fn: 'merge_crm_contacts',
      args: { p_keep_id: string; p_remove_id: string; p_actor_id: string | null }
    ) => Promise<{ error: { message: string } | null }>;
  };
  const { error: mergeError } = await rpc.rpc('merge_crm_contacts', {
    p_keep_id: keepId,
    p_remove_id: removeId,
    p_actor_id: adminUserId,
  });

  if (mergeError) {
    const message = `Merge failed: ${mergeError.message}`;
    await auditMerge('failure', message, beforeMerge);
    return { success: false, error: message };
  }

  await auditMerge('success', undefined, beforeMerge);
  revalidateCRMRoutes(keepId);
  return { success: true };
}
