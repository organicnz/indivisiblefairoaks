'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { recordAdminAudit } from '@/lib/admin-audit';
import { requireAdmin } from '@/lib/admin-auth';
import {
  type NewsletterInput,
  newsletterInputSchema,
  normalizeNewsletterTopics,
  slugifyNewsletter,
} from '@/lib/newsletters';

export interface CivicEventRecord {
  slug: string;
  title: string;
  category:
    | 'Meetings'
    | 'Resistance Choir'
    | 'Voter Mobilization'
    | 'Rallies & Street Action'
    | 'Community';
  date_label: string;
  time_label: string;
  starts_at: string | null;
  ends_at: string | null;
  location_name: string;
  address: string;
  description: string;
  rsvp_url: string;
  highlight: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  /** Issue #153: provenance for rows the Mobilize sync owns. */
  source?: 'manual' | 'mobilize';
  external_id?: string | null;
  external_url?: string | null;
  is_hidden?: boolean;
  sync_locked?: boolean;
  last_synced_at?: string | null;
}

export interface CivicNewsletterRecord {
  slug: string;
  title: string;
  date_label: string;
  description: string;
  body?: string;
  pdf_url?: string | null;
  archive_url?: string | null;
  topics: string[];
  sort_order: number;
  published_at: string | null;
  created_at?: string;
}

export type CivicActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { success: false; error: string };

function fail(error: string): { success: false; error: string } {
  return { success: false, error };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const eventSchema = z.object({
  slug: z.string().trim().min(1).max(120).optional(),
  // Set by the editor when an existing row is open. Without it a changed slug
  // upserts a second row and leaves the original public event in place.
  original_slug: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  category: z.enum([
    'Meetings',
    'Resistance Choir',
    'Voter Mobilization',
    'Rallies & Street Action',
    'Community',
  ]),
  date_label: z.string().trim().min(1, 'Date label is required').max(100),
  time_label: z.string().trim().min(1, 'Time label is required').max(100),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  location_name: z.string().trim().max(200).default(''),
  address: z.string().trim().max(300).default(''),
  description: z.string().trim().default(''),
  rsvp_url: z.string().trim().max(500).default(''),
  highlight: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

/**
 * Fetch all events for the admin / CRM management surfaces.
 */
export async function getCivicEventsAdmin(): Promise<CivicActionResult<CivicEventRecord[]>> {
  try {
    const { adminClient } = await requireAdmin();
    const { data, error } = await adminClient
      .from('events')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('starts_at', { ascending: true });

    if (error) return fail(error.message);
    return { success: true, data: (data ?? []) as CivicEventRecord[] };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to load events');
  }
}

/**
 * Create or update an event.
 */
export async function saveCivicEvent(
  rawInput: z.input<typeof eventSchema>
): Promise<CivicActionResult<CivicEventRecord>> {
  try {
    const { adminClient, adminUserId, adminEmail, mfaLevel } = await requireAdmin();
    const parsed = eventSchema.safeParse(rawInput);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message || 'Invalid event data');
    }

    const payload = parsed.data;
    const finalSlug = payload.slug
      ? slugify(payload.slug)
      : slugify(payload.title) || `event-${Date.now()}`;
    const originalSlug = payload.original_slug ? slugify(payload.original_slug) : null;
    const isRename = Boolean(originalSlug && originalSlug !== finalSlug);

    // `events` gained `external_id` / `sync_locked` in the Mobilize migration,
    // which the generated types do not know about until the next
    // `types:generate` run against a project that has it. Untyped here for the
    // same stated reason `src/lib/queries/civic.ts` casts its client.
    const eventsClient = adminClient as unknown as SupabaseClient;

    // Issue #153: editing a Mobilize-sourced row is a human asserting ownership
    // of its wording. The sync must then leave it alone entirely — otherwise a
    // corrected title or a shortened description is overwritten within the
    // hour, and the editor silently loses the argument.
    let locksSync = false;
    let existingEvent: CivicEventRecord | null = null;
    // A rename must inspect the row being edited, not the new slug: reusing the
    // new slug here would miss the Mobilize provenance and let the sync
    // overwrite the renamed row on its next pass.
    const sourceSlug = originalSlug ?? (payload.slug ? finalSlug : null);
    if (sourceSlug) {
      const { data: existing, error: lookupError } = await eventsClient
        .from('events')
        .select('*')
        .eq('slug', sourceSlug)
        .maybeSingle();
      if (lookupError) return fail(lookupError.message);
      existingEvent = (existing as CivicEventRecord | null) ?? null;
      locksSync = Boolean(existingEvent?.external_id);
    }

    const upsertRow = {
      slug: finalSlug,
      title: payload.title,
      category: payload.category,
      date_label: payload.date_label,
      time_label: payload.time_label,
      starts_at: payload.starts_at || null,
      ends_at: payload.ends_at || null,
      location_name: payload.location_name,
      address: payload.address,
      description: payload.description,
      rsvp_url: payload.rsvp_url,
      highlight: payload.highlight,
      sort_order: payload.sort_order,
      updated_at: new Date().toISOString(),
      ...(locksSync ? { sync_locked: true } : {}),
    };

    const write = isRename
      ? eventsClient
          .from('events')
          .update(upsertRow)
          .eq('slug', originalSlug ?? finalSlug)
      : eventsClient.from('events').upsert(upsertRow, { onConflict: 'slug' });
    const { data, error } = await write.select('*').single();

    if (error) {
      const message =
        error.code === '23505' ? `"${finalSlug}" is already used by another event.` : error.message;
      await recordAdminAudit(adminClient, {
        actorUserId: adminUserId,
        actorEmail: adminEmail,
        action: existingEvent ? 'event.update' : 'event.create',
        targetType: 'event',
        targetId: finalSlug,
        targetLabel: existingEvent?.title ?? payload.title,
        before: existingEvent,
        after: null,
        mfaLevel,
        outcome: 'failure',
        error: message,
      });
      return fail(message);
    }

    const savedEvent = data as CivicEventRecord;
    await recordAdminAudit(adminClient, {
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: existingEvent ? 'event.update' : 'event.create',
      targetType: 'event',
      targetId: savedEvent.slug,
      targetLabel: savedEvent.title,
      before: existingEvent,
      after: savedEvent,
      mfaLevel,
      outcome: 'success',
    });

    revalidateTag('events', { expire: 0 });
    revalidatePath('/events');
    revalidatePath('/');

    return { success: true, data: savedEvent };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to save event');
  }
}

/**
 * Delete an event by slug.
 */
export async function deleteCivicEvent(slug: string): Promise<CivicActionResult> {
  try {
    const { adminClient, adminUserId, adminEmail, mfaLevel } = await requireAdmin();
    const cleanSlug = slugify(slug);
    if (!cleanSlug) return fail('Event slug is required');

    // `events` gained the Mobilize provenance columns in a migration the
    // generated types do not know about yet; see `saveCivicEvent`.
    const eventsClient = adminClient as unknown as SupabaseClient;
    const { data: existing, error: lookupError } = await eventsClient
      .from('events')
      .select('*')
      .eq('slug', cleanSlug)
      .maybeSingle();
    if (lookupError) return fail(lookupError.message);

    const existingEvent = (existing as CivicEventRecord | null) ?? null;
    if (existingEvent?.external_id) {
      const message = 'This event comes from Mobilize. Hide it instead of deleting it.';
      await recordAdminAudit(adminClient, {
        actorUserId: adminUserId,
        actorEmail: adminEmail,
        action: 'event.delete',
        targetType: 'event',
        targetId: cleanSlug,
        targetLabel: existingEvent.title,
        before: existingEvent,
        after: null,
        mfaLevel,
        outcome: 'denied',
        error: message,
      });
      return fail(message);
    }

    const { data: deleted, error } = await eventsClient
      .from('events')
      .delete()
      .eq('slug', cleanSlug)
      .select('slug')
      .maybeSingle();
    if (error || !deleted) {
      const message = error?.message || 'Event not found';
      await recordAdminAudit(adminClient, {
        actorUserId: adminUserId,
        actorEmail: adminEmail,
        action: 'event.delete',
        targetType: 'event',
        targetId: cleanSlug,
        targetLabel: existingEvent?.title ?? cleanSlug,
        before: existingEvent,
        after: null,
        mfaLevel,
        outcome: 'failure',
        error: message,
      });
      return fail(message);
    }

    await recordAdminAudit(adminClient, {
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: 'event.delete',
      targetType: 'event',
      targetId: cleanSlug,
      targetLabel: existingEvent?.title ?? cleanSlug,
      before: existingEvent,
      after: null,
      mfaLevel,
      outcome: 'success',
    });

    revalidateTag('events', { expire: 0 });
    revalidatePath('/events');
    revalidatePath('/');

    return { success: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to delete event');
  }
}

/**
 * Fetch all newsletters for the admin / CRM management surfaces.
 */
export async function getCivicNewslettersAdmin(): Promise<
  CivicActionResult<CivicNewsletterRecord[]>
> {
  try {
    const { adminClient } = await requireAdmin();
    const { data, error } = await adminClient
      .from('newsletters')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) return fail(error.message);
    const rows = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      topics: Array.isArray(row.topics) ? row.topics : [],
    })) as CivicNewsletterRecord[];

    return { success: true, data: rows };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to load newsletters');
  }
}

/**
 * Create or update a newsletter / bulletin post.
 *
 * A create is an INSERT, never an upsert. The old upsert made "New Bulletin"
 * with a slug that already existed overwrite that bulletin — including its
 * title, summary and publication date — while the UI said "created". An edit
 * updates only the row named by `original_slug`, so a stale form reports that
 * the bulletin no longer exists instead of resurrecting or replacing a row.
 */
export async function saveCivicNewsletter(
  rawInput: NewsletterInput
): Promise<CivicActionResult<CivicNewsletterRecord>> {
  try {
    const { adminClient, adminUserId, adminEmail, mfaLevel } = await requireAdmin();
    const parsed = newsletterInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message || 'Invalid newsletter data');
    }

    const payload = parsed.data;
    const finalSlug =
      (payload.slug ? slugifyNewsletter(payload.slug) : '') ||
      slugifyNewsletter(payload.title) ||
      `newsletter-${Date.now()}`;
    const originalSlug =
      payload.original_slug !== undefined ? slugifyNewsletter(payload.original_slug) : null;
    if (payload.original_slug !== undefined && !originalSlug) {
      return fail('The bulletin being edited has an invalid identifier. Refresh and try again.');
    }

    // Read the row being edited (or prove the slug is free) before choosing the
    // write. The result is also the audit record's "before" value.
    const existingResult = originalSlug
      ? await adminClient.from('newsletters').select('*').eq('slug', originalSlug).maybeSingle()
      : await adminClient.from('newsletters').select('slug').eq('slug', finalSlug).maybeSingle();
    if (existingResult.error) return fail(existingResult.error.message);

    const existing = (existingResult.data as CivicNewsletterRecord | null) ?? null;
    if (originalSlug && !existing) {
      return fail('This bulletin no longer exists. Refresh and try again.');
    }
    if (!originalSlug && existing) {
      return fail(`"${finalSlug}" is already used by another bulletin. Pick another slug.`);
    }

    const publishedAt = payload.published_at ?? new Date().toISOString();
    const row = {
      slug: finalSlug,
      title: payload.title,
      date_label: payload.date_label,
      description: payload.description,
      body: payload.body,
      pdf_url: payload.pdf_url,
      archive_url: payload.archive_url,
      topics: payload.topics,
      sort_order: payload.sort_order,
      published_at: publishedAt,
    };

    const auditAction = originalSlug ? 'newsletter.update' : 'newsletter.create';
    const audit = (
      outcome: 'success' | 'failure',
      after: Record<string, unknown> | null,
      error?: string
    ) =>
      recordAdminAudit(adminClient, {
        actorUserId: adminUserId,
        actorEmail: adminEmail,
        action: auditAction,
        targetType: 'newsletter',
        targetId: finalSlug,
        targetLabel: row.title,
        before: existing,
        after,
        mfaLevel,
        outcome,
        error: error ?? null,
      });

    const write = originalSlug
      ? adminClient.from('newsletters').update(row).eq('slug', originalSlug)
      : adminClient.from('newsletters').insert(row);
    const { data, error } = await write.select('*').single();

    if (error) {
      const message =
        error.code === '23505'
          ? `"${finalSlug}" is already used by another bulletin. Pick another slug.`
          : error.code === 'PGRST116'
            ? 'This bulletin no longer exists. Refresh and try again.'
            : error.message;
      await audit('failure', null, message);
      return fail(message);
    }

    const saved = {
      ...(data as Record<string, unknown>),
      topics: normalizeNewsletterTopics(
        Array.isArray((data as Record<string, unknown>).topics)
          ? ((data as Record<string, unknown>).topics as string[])
          : []
      ),
    } as CivicNewsletterRecord;

    await audit('success', saved as unknown as Record<string, unknown>);
    revalidateTag('newsletters', { expire: 0 });
    revalidatePath('/newsletters');
    // A renamed or newly published bulletin must not leave a stale cached
    // detail page behind at the old or new slug.
    revalidatePath('/newsletters/[slug]', 'page');
    revalidatePath('/news');
    revalidatePath('/api/civic/newsletters');

    return { success: true, data: saved };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to save newsletter');
  }
}

/**
 * Delete a newsletter / bulletin post by slug.
 */
export async function deleteCivicNewsletter(slug: string): Promise<CivicActionResult> {
  try {
    const { adminClient, adminUserId, adminEmail, mfaLevel } = await requireAdmin();
    const cleanSlug = slugifyNewsletter(slug);
    if (!cleanSlug) return fail('Newsletter slug is required');

    const { data: existing, error: lookupError } = await adminClient
      .from('newsletters')
      .select('*')
      .eq('slug', cleanSlug)
      .maybeSingle();
    if (lookupError) return fail(lookupError.message);

    const audit = (outcome: 'success' | 'failure', error?: string) =>
      recordAdminAudit(adminClient, {
        actorUserId: adminUserId,
        actorEmail: adminEmail,
        action: 'newsletter.delete',
        targetType: 'newsletter',
        targetId: cleanSlug,
        targetLabel: (existing as CivicNewsletterRecord | null)?.title ?? cleanSlug,
        before: existing,
        after: null,
        mfaLevel,
        outcome,
        error: error ?? null,
      });

    const { data: deleted, error } = await adminClient
      .from('newsletters')
      .delete()
      .eq('slug', cleanSlug)
      .select('slug')
      .maybeSingle();
    if (error) {
      await audit('failure', error.message);
      return fail(error.message);
    }
    if (!deleted) {
      await audit('failure', 'Newsletter not found');
      return fail('Newsletter not found');
    }

    await audit('success');
    revalidateTag('newsletters', { expire: 0 });
    revalidatePath('/newsletters');
    revalidatePath('/newsletters/[slug]', 'page');
    revalidatePath('/news');
    revalidatePath('/api/civic/newsletters');

    return { success: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to delete newsletter');
  }
}

export interface CoalitionLinkRecord {
  slug: string;
  name: string;
  category: string;
  url: string;
  description: string;
  badge: string | null;
  sort_order: number;
  created_at?: string;
}

const linkSchema = z.object({
  slug: z.string().trim().min(1).max(120).optional(),
  original_slug: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1, 'Link name is required').max(200),
  category: z.string().trim().default('Movement Partners'),
  url: z.string().trim().url('Valid URL is required (http/https)').max(500),
  description: z.string().trim().default(''),
  badge: z.string().trim().max(100).nullable().optional(),
  sort_order: z.number().int().default(0),
});

/**
 * Fetch all coalition and civic action links for admin management.
 */
export async function getCoalitionLinksAdmin(): Promise<CivicActionResult<CoalitionLinkRecord[]>> {
  try {
    const { adminClient } = await requireAdmin();
    const { data, error } = await adminClient
      .from('coalition_links')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) return fail(error.message);
    return { success: true, data: (data ?? []) as CoalitionLinkRecord[] };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to load coalition links');
  }
}

/**
 * Create or update a coalition link.
 */
export async function saveCoalitionLink(
  rawInput: z.input<typeof linkSchema>
): Promise<CivicActionResult<CoalitionLinkRecord>> {
  try {
    const { adminClient } = await requireAdmin();
    const parsed = linkSchema.safeParse(rawInput);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message || 'Invalid link data');
    }

    const payload = parsed.data;
    const finalSlug = payload.slug
      ? slugify(payload.slug)
      : slugify(payload.name) || `link-${Date.now()}`;
    const originalSlug = payload.original_slug ? slugify(payload.original_slug) : null;
    const isRename = Boolean(originalSlug && originalSlug !== finalSlug);

    const upsertRow = {
      slug: finalSlug,
      name: payload.name,
      category: payload.category,
      url: payload.url,
      description: payload.description,
      badge: payload.badge || null,
      sort_order: payload.sort_order,
    };

    const write = isRename
      ? adminClient
          .from('coalition_links')
          .update(upsertRow)
          .eq('slug', originalSlug ?? finalSlug)
      : adminClient.from('coalition_links').upsert(upsertRow, { onConflict: 'slug' });
    const { data, error } = await write.select('*').single();

    if (error) {
      if (error.code === '23505') {
        return fail(`"${finalSlug}" is already used by another link.`);
      }
      return fail(error.message);
    }

    revalidateTag('coalition-links', { expire: 0 });
    revalidatePath('/links');

    return { success: true, data: data as CoalitionLinkRecord };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to save coalition link');
  }
}

/**
 * Delete a coalition link by slug.
 */
export async function deleteCoalitionLink(slug: string): Promise<CivicActionResult> {
  try {
    const { adminClient } = await requireAdmin();
    const cleanSlug = slugify(slug);
    if (!cleanSlug) return fail('Link slug is required');

    const { data: deleted, error } = await adminClient
      .from('coalition_links')
      .delete()
      .eq('slug', cleanSlug)
      .select('slug')
      .maybeSingle();
    if (error) return fail(error.message);
    if (!deleted) return fail('Link not found');

    revalidateTag('coalition-links', { expire: 0 });
    revalidatePath('/links');

    return { success: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to delete coalition link');
  }
}
