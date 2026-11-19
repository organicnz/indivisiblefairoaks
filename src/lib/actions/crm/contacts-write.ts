import { z } from 'zod';
import {
  CRM_CONTACT_CONSENT_VALUES,
  CRM_CONTACT_DEFAULTS,
  CRM_CONTACT_STATUS_VALUES,
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
import type { ConsentDecision, CRMContact, CRMContactInsert, CRMContactUpdate } from '@/types/crm';
import type { Database } from '@/types/supabase';
import {
  type AdminClient,
  type CRMResult,
  escapeIlike,
  recordCRMAudit,
  requireCRMAdmin,
  revalidateCRMRoutes,
  tagSchema,
} from './shared';

const CRM_ACTIVITY_WARNING =
  'Saved, but the CRM timeline entry could not be recorded. The activity log is incomplete.';

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
}): Promise<CRMResult<{ updatedCount?: number }>> {
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
  /*
   * One operation-level audit row, not one per contact: a 5,000-row bulk would
   * flood both the audit log and each timeline. The metadata carries the
   * requested IDs, requested/affected counts, and the API-level fields this call
   * changed.
   */
  const auditBulkUpdate = (outcome: 'success' | 'failure', updatedCount?: number, error?: string) =>
    recordCRMAudit(admin, {
      action: 'crm.contact.bulk_update',
      targetType: 'crm_contact',
      targetId: contactIds.length === 1 ? contactIds[0] : 'bulk-update',
      targetLabel: `${contactIds.length} selected contact${contactIds.length === 1 ? '' : 's'}`,
      before: null,
      after: null,
      outcome,
      error: error ?? null,
      metadata: {
        requested_count: contactIds.length,
        requested_ids: contactIds,
        ...(updatedCount === undefined ? {} : { updated_count: updatedCount }),
        changed_fields: changedFields,
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
    await auditBulkUpdate('success', count ?? undefined);
    revalidateCRMRoutes();
    // A missing exact count is not zero. The update has already succeeded, so
    // omit the number rather than telling the organizer nothing changed.
    return { success: true, ...(count === null ? {} : { updatedCount: count }) };
  }

  // When modifying tags, fetch existing tags, apply set modifications, and persist
  const { data: contacts, error: fetchErr } = await adminClient
    .from('crm_contacts')
    .select('id, tags')
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
      .select('id')
      .maybeSingle();
    if (updateError) {
      const message =
        updated === 0
          ? updateError.message
          : `${updateError.message} — ${updated} of ${contacts.length} selected contacts were updated before the failure; the rest were not.`;
      await auditBulkUpdate('failure', updated, message);
      return { success: false, updatedCount: updated, error: message };
    }
    if (!updatedContact) {
      const message =
        updated === 0
          ? 'A selected contact no longer exists'
          : `A selected contact no longer exists after ${updated} of ${contacts.length} selected contacts were updated; the rest were not.`;
      await auditBulkUpdate('failure', updated, message);
      return { success: false, updatedCount: updated, error: message };
    }
    updated += 1;
  }

  await auditBulkUpdate('success', contacts.length);
  revalidateCRMRoutes();
  return { success: true, updatedCount: contacts.length };
}

export async function bulkDeleteCRMContacts(
  contactIds: string[]
): Promise<CRMResult<{ deletedCount?: number }>> {
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

  const before = {
    contact_ids: contactIds,
    contacts: selectedRows ?? null,
  };
  const auditBulkDelete = (outcome: 'success' | 'failure', deletedCount?: number, error?: string) =>
    recordCRMAudit(admin, {
      action: 'crm.contact.bulk_delete',
      targetType: 'crm_contact',
      targetId: contactIds.length === 1 ? contactIds[0] : 'bulk-delete',
      targetLabel: `${contactIds.length} selected contact${contactIds.length === 1 ? '' : 's'}`,
      before,
      after: null,
      outcome,
      error: error ?? null,
      metadata: {
        requested_count: contactIds.length,
        ...(deletedCount === undefined ? {} : { deleted_count: deletedCount }),
      },
    });

  const { error, count } = await adminClient
    .from('crm_contacts')
    .delete({ count: 'exact' })
    .in('id', contactIds);

  if (error) {
    await auditBulkDelete('failure', undefined, error.message);
    return { success: false, error: error.message };
  }
  if (count === 0) {
    const message = 'None of the selected constituents still exist';
    await auditBulkDelete('failure', 0, message);
    return { success: false, error: message };
  }

  await auditBulkDelete('success', count ?? undefined);
  revalidateCRMRoutes();
  // Same rule as the update above: do not turn an unavailable count into a
  // claim that zero constituents were deleted.
  return { success: true, ...(count === null ? {} : { deletedCount: count }) };
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
  const { adminClient, adminUserId } = await requireCRMAdmin();

  if (!csv.trim()) {
    return { success: false, error: 'CSV content is required' };
  }
  if (csv.length > 500_000) {
    return { success: false, error: 'CSV too large (max 500KB)' };
  }

  const { rows, errors } = parseCRMImportCsv(csv);
  if (rows.length === 0) {
    return { success: false, errors, error: 'No valid rows found in CSV' };
  }
  if (rows.length > 2000) {
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

  revalidateCRMRoutes();
  return {
    success,
    imported,
    skipped,
    invalidRows: errors.length,
    errors: insertErrors.slice(0, 50),
    error: success
      ? undefined
      : insertFailed
        ? 'All inserts failed — no contacts were imported'
        : undefined,
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
  const { adminClient, adminUserId } = await requireCRMAdmin();

  if (keepId === removeId) {
    return { success: false, error: 'Cannot merge a contact into itself' };
  }

  // A failed lookup is not a missing contact. `maybeSingle()` keeps "no row"
  // distinct from a real database error, so the latter is reported as a
  // failure instead of as a merge precondition.
  const [{ data: keep, error: keepError }, { data: remove, error: removeError }] =
    await Promise.all([
      adminClient.from('crm_contacts').select('*').eq('id', keepId).maybeSingle(),
      adminClient.from('crm_contacts').select('*').eq('id', removeId).maybeSingle(),
    ]);

  if (keepError) return { success: false, error: keepError.message };
  if (removeError) return { success: false, error: removeError.message };
  if (!keep || !remove) {
    return { success: false, error: 'Both contacts must exist to merge' };
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
    return { success: false, error: `Merge failed: ${mergeError.message}` };
  }

  revalidateCRMRoutes(keepId);
  return { success: true };
}
