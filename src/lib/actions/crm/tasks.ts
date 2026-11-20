import { z } from 'zod';
import { CRM_TASKS_MAX_PAGE_SIZE, CRM_TASKS_PAGE_SIZE } from '@/lib/crm-limits';
import type { CRMTask, CRMTaskWithContact } from '@/types/crm';
import type { Database } from '@/types/supabase';
import { type CRMResult, recordCRMAudit, requireCRMAdmin, revalidateCRMRoutes } from './shared';

export type TaskScope = 'open' | 'overdue' | 'upcoming' | 'done' | 'all';

export async function getCRMTasks({
  scope = 'open',
  page = 1,
  pageSize = CRM_TASKS_PAGE_SIZE,
}: {
  scope?: TaskScope;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ tasks: CRMTaskWithContact[]; totalCount: number }> {
  const { adminClient } = await requireCRMAdmin();
  const today = new Date().toISOString().slice(0, 10);
  // Both values reach PostgREST as a range, and this action is a `'use server'`
  // boundary — it is callable directly, not only through the page that already
  // parses `page`. `page: 0` produced a negative offset and a hostile
  // `pageSize` could ask for the whole table. `Number.isFinite` first because
  // `Math.max(1, Math.trunc(NaN))` is still NaN, just as in the broadcast
  // history read.
  const size = Math.min(
    CRM_TASKS_MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(pageSize) ? Math.trunc(pageSize) : CRM_TASKS_PAGE_SIZE)
  );
  const current = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;

  let qb = adminClient
    .from('crm_tasks')
    .select('*, contact:crm_contacts(id, first_name, last_name, email)', { count: 'exact' });

  if (scope === 'open') {
    qb = qb.eq('status', 'open');
  } else if (scope === 'done') {
    qb = qb.eq('status', 'done');
  } else if (scope === 'overdue') {
    qb = qb.eq('status', 'open').lt('due_at', today);
  } else if (scope === 'upcoming') {
    qb = qb.eq('status', 'open').or(`due_at.gte.${today},due_at.is.null`);
  }

  const from = (current - 1) * size;
  const to = from + size - 1;
  const { data, count, error } = await qb
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to load tasks: ${error.message}`);
  }
  if (count === null) {
    throw new Error('Failed to load tasks: total count unavailable');
  }
  return { tasks: (data as CRMTaskWithContact[]) || [], totalCount: count };
}

/**
 * Every follow-up recorded for one constituent.
 *
 * The read used to select only done tasks plus open tasks due today or later,
 * which hid exactly the rows an organizer most needs to see: an overdue call
 * disappeared from the 360 panel's Open filter, and an open task with no due
 * date disappeared entirely. The panel filters the returned list into All / Open
 * / Done itself, so the read must not pre-filter it.
 */
export async function getCRMTasksForContact(contactId: string): Promise<CRMTask[]> {
  const { adminClient } = await requireCRMAdmin();
  const { data, error } = await adminClient
    .from('crm_tasks')
    .select('*')
    .eq('contact_id', contactId)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to load contact tasks: ${error.message}`);
  }
  return data || [];
}

export async function addCRMTask(
  rawInput: z.input<typeof taskSchema>
): Promise<CRMResult<{ taskId?: string }>> {
  const admin = await requireCRMAdmin();
  const { adminClient, adminUserId } = admin;
  const parsed = taskSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { contactId, title, details, dueAt } = parsed.data;
  const insertPayload = {
    contact_id: contactId || null,
    title,
    details: details || null,
    due_at: dueAt || null,
    created_by: adminUserId,
  };
  const auditCreate = (
    outcome: 'success' | 'failure',
    targetId: string,
    after: unknown,
    error?: string
  ) =>
    recordCRMAudit(admin, {
      action: 'crm.task.create',
      targetType: 'crm_task',
      targetId,
      targetLabel: title,
      before: null,
      after,
      outcome,
      error: error ?? null,
      metadata: { contact_id: contactId || null },
    });
  const { data, error } = await adminClient
    .from('crm_tasks')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) {
    // A refused insert created no row, so the target is the creation attempt
    // rather than the contact the task would have belonged to.
    await auditCreate('failure', 'new-task', insertPayload, error.message);
    return { success: false, error: error.message };
  }

  await auditCreate('success', data.id, { ...insertPayload, id: data.id });
  revalidateCRMRoutes(contactId);
  return { success: true, taskId: data.id };
}

export async function setCRMTaskStatus({
  id,
  status,
}: {
  id: string;
  status: 'open' | 'done';
}): Promise<CRMResult> {
  const taskStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(['open', 'done']) });
  const parsed = taskStatusSchema.safeParse({ id, status });
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const admin = await requireCRMAdmin();
  const { adminClient } = admin;
  const now = new Date().toISOString();
  const updatePayload = {
    status: parsed.data.status,
    completed_at: parsed.data.status === 'done' ? now : null,
    updated_at: now,
  };
  const { data, error } = await adminClient
    .from('crm_tasks')
    .update(updatePayload)
    .eq('id', parsed.data.id)
    .select('contact_id, title')
    .maybeSingle();

  if (error || !data) {
    const message = error ? error.message : 'That follow-up no longer exists';
    await recordCRMAudit(admin, {
      action: 'crm.task.status',
      targetType: 'crm_task',
      targetId: parsed.data.id,
      targetLabel: null,
      before: null,
      after: updatePayload,
      outcome: 'failure',
      error: message,
    });
    return { success: false, error: message };
  }
  // `.select()` returns the post-update row, so there is no honest `before`
  // state here; the payload records the change without relabelling the new
  // status as the old one.
  await recordCRMAudit(admin, {
    action: 'crm.task.status',
    targetType: 'crm_task',
    targetId: parsed.data.id,
    targetLabel: data.title ?? parsed.data.id,
    before: null,
    after: updatePayload,
    outcome: 'success',
    metadata: { contact_id: data.contact_id ?? null },
  });
  revalidateCRMRoutes(data.contact_id);
  return { success: true };
}

export async function deleteCRMTask(id: string): Promise<CRMResult> {
  const admin = await requireCRMAdmin();
  const { adminClient } = admin;
  const { data, error } = await adminClient
    .from('crm_tasks')
    .delete()
    .eq('id', id)
    .select('contact_id, title')
    .maybeSingle();

  if (error || !data) {
    const message = error ? error.message : 'That follow-up no longer exists';
    await recordCRMAudit(admin, {
      action: 'crm.task.delete',
      targetType: 'crm_task',
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
    action: 'crm.task.delete',
    targetType: 'crm_task',
    targetId: id,
    targetLabel: data.title ?? id,
    before: { id, contact_id: data.contact_id, title: data.title },
    after: { deleted: true },
    outcome: 'success',
    metadata: { contact_id: data.contact_id ?? null },
  });
  revalidateCRMRoutes(data.contact_id);
  return { success: true };
}

export async function updateCRMTask(
  rawInput: z.input<typeof updateTaskSchema>
): Promise<CRMResult> {
  const admin = await requireCRMAdmin();
  const { adminClient } = admin;
  const parsed = updateTaskSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { id, contactId, title, details, dueAt, status } = parsed.data;
  const updatePayload: Database['public']['Tables']['crm_tasks']['Update'] = {
    updated_at: new Date().toISOString(),
  };
  if (title !== undefined) updatePayload.title = title;
  if (details !== undefined) updatePayload.details = details || null;
  if (dueAt !== undefined) updatePayload.due_at = dueAt || null;
  if (contactId !== undefined) updatePayload.contact_id = contactId || null;
  if (status !== undefined) {
    updatePayload.status = status;
    updatePayload.completed_at = status === 'done' ? new Date().toISOString() : null;
  }

  const { data, error } = await adminClient
    .from('crm_tasks')
    .update(updatePayload)
    .eq('id', id)
    .select('contact_id, title')
    .maybeSingle();

  if (error || !data) {
    const message = error ? error.message : 'That follow-up no longer exists';
    await recordCRMAudit(admin, {
      action: 'crm.task.update',
      targetType: 'crm_task',
      targetId: id,
      targetLabel: updatePayload.title ?? null,
      before: null,
      after: updatePayload,
      outcome: 'failure',
      error: message,
    });
    return { success: false, error: message };
  }
  await recordCRMAudit(admin, {
    action: 'crm.task.update',
    targetType: 'crm_task',
    targetId: id,
    targetLabel: data.title ?? id,
    before: null,
    after: updatePayload,
    outcome: 'success',
    metadata: { contact_id: data.contact_id ?? contactId ?? null },
  });
  revalidateCRMRoutes(data.contact_id || contactId);
  return { success: true };
}
const taskSchema = z.object({
  // Optional: a follow-up can belong to the chapter rather than to a person
  // ("call the county clerk", "confirm the venue"). `crm_tasks.contact_id`
  // allows NULL for exactly this, and the board is where those live.
  contactId: z
    .string()
    .uuid('Select a constituent, or leave this blank for a chapter-wide task')
    .nullable()
    .optional(),
  title: z.string().trim().min(1, 'Give the follow-up a title').max(200),
  details: z.string().trim().max(2000).nullable().optional(),
  dueAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD')
    .nullable()
    .optional(),
});

const updateTaskSchema = z.object({
  id: z.string().uuid(),
  contactId: z
    .string()
    .uuid('Select a constituent, or leave this blank for a chapter-wide task')
    .nullable()
    .optional(),
  title: z.string().trim().min(1, 'Give the follow-up a title').max(200).optional(),
  details: z.string().trim().max(2000).nullable().optional(),
  dueAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD')
    .nullable()
    .optional(),
  status: z.enum(['open', 'done']).optional(),
});
