'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';

export interface CivicEventRecord {
  slug: string;
  title: string;
  category: 'Meetings' | 'Resistance Choir' | 'Voter Mobilization' | 'Rallies & Street Action';
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
}

export interface CivicNewsletterRecord {
  slug: string;
  title: string;
  date_label: string;
  description: string;
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
  title: z.string().trim().min(1, 'Title is required').max(200),
  category: z.enum([
    'Meetings',
    'Resistance Choir',
    'Voter Mobilization',
    'Rallies & Street Action',
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

const newsletterSchema = z.object({
  slug: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  date_label: z.string().trim().min(1, 'Date label is required').max(100),
  description: z.string().trim().default(''),
  topics: z.array(z.string().trim()).default([]),
  sort_order: z.number().int().default(0),
  published_at: z.string().nullable().optional(),
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
    const { adminClient } = await requireAdmin();
    const parsed = eventSchema.safeParse(rawInput);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message || 'Invalid event data');
    }

    const payload = parsed.data;
    const finalSlug = payload.slug
      ? slugify(payload.slug)
      : slugify(payload.title) || `event-${Date.now()}`;

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
    };

    const { data, error } = await adminClient
      .from('events')
      .upsert(upsertRow, { onConflict: 'slug' })
      .select('*')
      .single();

    if (error) return fail(error.message);

    revalidateTag('events', 'hours');
    revalidatePath('/events');
    revalidatePath('/');

    return { success: true, data: data as CivicEventRecord };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to save event');
  }
}

/**
 * Delete an event by slug.
 */
export async function deleteCivicEvent(slug: string): Promise<CivicActionResult> {
  try {
    const { adminClient } = await requireAdmin();
    const cleanSlug = slugify(slug);
    if (!cleanSlug) return fail('Event slug is required');

    const { error } = await adminClient.from('events').delete().eq('slug', cleanSlug);
    if (error) return fail(error.message);

    revalidateTag('events', 'hours');
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
 */
export async function saveCivicNewsletter(
  rawInput: z.input<typeof newsletterSchema>
): Promise<CivicActionResult<CivicNewsletterRecord>> {
  try {
    const { adminClient } = await requireAdmin();
    const parsed = newsletterSchema.safeParse(rawInput);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message || 'Invalid newsletter data');
    }

    const payload = parsed.data;
    const finalSlug = payload.slug
      ? slugify(payload.slug)
      : slugify(payload.title) || `newsletter-${Date.now()}`;

    const upsertRow = {
      slug: finalSlug,
      title: payload.title,
      date_label: payload.date_label,
      description: payload.description,
      topics: payload.topics,
      sort_order: payload.sort_order,
      published_at: payload.published_at || new Date().toISOString(),
    };

    const { data, error } = await adminClient
      .from('newsletters')
      .upsert(upsertRow, { onConflict: 'slug' })
      .select('*')
      .single();

    if (error) return fail(error.message);

    revalidateTag('newsletters', 'hours');
    revalidatePath('/news');

    return {
      success: true,
      data: {
        ...(data as Record<string, unknown>),
        topics: Array.isArray((data as Record<string, unknown>).topics)
          ? ((data as Record<string, unknown>).topics as string[])
          : [],
      } as CivicNewsletterRecord,
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to save newsletter');
  }
}

/**
 * Delete a newsletter / bulletin post by slug.
 */
export async function deleteCivicNewsletter(slug: string): Promise<CivicActionResult> {
  try {
    const { adminClient } = await requireAdmin();
    const cleanSlug = slugify(slug);
    if (!cleanSlug) return fail('Newsletter slug is required');

    const { error } = await adminClient.from('newsletters').delete().eq('slug', cleanSlug);
    if (error) return fail(error.message);

    revalidateTag('newsletters', 'hours');
    revalidatePath('/news');

    return { success: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to delete newsletter');
  }
}
