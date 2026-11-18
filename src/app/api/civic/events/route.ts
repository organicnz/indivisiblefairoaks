import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath, revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
// Issue #149: the GET payload feeds the calendar's rows and links; stamps must
// be Pacific wall time interpreted by the consumers' `ctz=` / `TZID=`, never a
// runtime-zone-of-the-server rendering.
import { recordAdminAudit } from '@/lib/admin-audit';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { instantToPacificBasic } from '@/lib/calendar-time';
import { createPublicClient } from '@/lib/supabase-server';

const eventSchema = z.object({
  slug: z.string().trim().min(1).max(120).optional(),
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * GET /api/civic/events
 * Fetches all civic events directly from the Supabase DB events table.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    // Untyped: `is_hidden` and the Mobilize provenance columns arrived in a
    // migration the generated types do not know about yet (issue #153), the
    // same reason `src/lib/queries/civic.ts` casts its client.
    const supabase = createPublicClient() as unknown as SupabaseClient;
    let query = supabase
      .from('events')
      .select(
        'slug, title, category, date_label, time_label, starts_at, ends_at, location_name, address, description, rsvp_url, highlight, sort_order'
      )
      // Hidden rows are Mobilize events that were deleted or have finished
      // (issue #153). They stay in the table so the admin tab can restore one.
      .eq('is_hidden', false)
      .order('sort_order', { ascending: true })
      .order('starts_at', { ascending: true, nullsFirst: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rawEvents = data ?? [];
    const formatted = rawEvents.map((row) => ({
      id: row.slug,
      slug: row.slug,
      title: row.title,
      category: row.category,
      dateLabel: row.date_label,
      timeLabel: row.time_label,
      // Raw instants are returned alongside the Pacific wall stamps: the admin
      // edit modal round-trips `starts_at`/`ends_at`, and without them the
      // calendar's Edit button saved every event with null instants — which
      // silently broke its Calendar and .ics links.
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isoDateStart: instantToPacificBasic(row.starts_at),
      isoDateEnd: instantToPacificBasic(row.ends_at),
      locationName: row.location_name,
      address: row.address,
      description: row.description,
      rsvpUrl: row.rsvp_url,
      highlight: Boolean(row.highlight),
      sortOrder: row.sort_order,
    }));

    return NextResponse.json(
      { success: true, events: formatted },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch events from database' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/civic/events
 * Admin-authenticated upsert of a civic event into Supabase DB events table.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminApi();
    if (!auth.ok) {
      return NextResponse.json(
        {
          error: auth.error,
          ...(auth.mfaRequired ? { mfaRequired: true } : {}),
          ...(auth.mfaEnrollmentRequired ? { mfaEnrollmentRequired: true } : {}),
        },
        { status: auth.status }
      );
    }

    const { adminUserId, adminEmail, mfaLevel } = auth.session;

    const json = await req.json();
    const parsed = eventSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid event payload' },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const finalSlug = payload.slug
      ? slugify(payload.slug)
      : slugify(payload.title) || `event-${Date.now()}`;
    const originalSlug = payload.original_slug ? slugify(payload.original_slug) : null;
    const isRename = Boolean(originalSlug && originalSlug !== finalSlug);

    // Issue #153: editing a Mobilize-sourced row claims it for a human — the
    // sync then skips it rather than overwriting the edit on its next pass.
    // Writes stay on the session client, so RLS remains a second check after
    // `requireAdminApi` has verified the MFA level and the profile grant.
    const eventsClient = auth.session.supabase as unknown as SupabaseClient;
    let locksSync = false;
    let existingEvent: Record<string, unknown> | null = null;
    // Look up the row being edited, not the submitted slug. On a rename the
    // latter is the new name and would miss the Mobilize provenance, letting
    // the sync overwrite the renamed event on its next pass.
    const sourceSlug = originalSlug ?? (payload.slug ? finalSlug : null);
    if (sourceSlug) {
      const { data: existing, error: lookupError } = await eventsClient
        .from('events')
        .select('*')
        .eq('slug', sourceSlug)
        .maybeSingle();
      if (lookupError) {
        return NextResponse.json({ error: lookupError.message }, { status: 500 });
      }
      existingEvent = (existing as Record<string, unknown> | null) ?? null;
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
      ? eventsClient.from('events').update(upsertRow).eq('slug', originalSlug ?? finalSlug)
      : eventsClient.from('events').upsert(upsertRow, { onConflict: 'slug' });
    const { data, error } = await write.select('*').single();

    if (error) {
      const message =
        error.code === '23505'
          ? `"${finalSlug}" is already used by another event.`
          : error.message;
      await recordAdminAudit(auth.session.adminClient, {
        actorUserId: adminUserId,
        actorEmail: adminEmail,
        action: existingEvent ? 'event.update' : 'event.create',
        targetType: 'event',
        targetId: finalSlug,
        targetLabel:
          (existingEvent?.title as string | undefined) ?? payload.title,
        before: existingEvent,
        after: null,
        mfaLevel,
        outcome: 'failure',
        error: message,
      });
      if (error.code === '23505') {
        return NextResponse.json(
          { error: message },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    await recordAdminAudit(auth.session.adminClient, {
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: existingEvent ? 'event.update' : 'event.create',
      targetType: 'event',
      targetId: (data?.slug as string | undefined) ?? finalSlug,
      targetLabel:
        (data?.title as string | undefined) ??
        (existingEvent?.title as string | undefined) ??
        payload.title,
      before: existingEvent,
      after: data,
      mfaLevel,
      outcome: 'success',
    });

    // The modal posts to this API first. Without this invalidation a successful
    // save left `/events` and the homepage on their cached copies, so the
    // editor could publish a correction that readers would not see until the
    // cache expired.
    revalidateTag('events', 'hours');
    revalidatePath('/events');
    revalidatePath('/');

    return NextResponse.json({ success: true, event: data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save event' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/civic/events
 * Admin-authenticated deletion of a civic event from Supabase DB events table.
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdminApi();
    if (!auth.ok) {
      return NextResponse.json(
        {
          error: auth.error,
          ...(auth.mfaRequired ? { mfaRequired: true } : {}),
          ...(auth.mfaEnrollmentRequired ? { mfaEnrollmentRequired: true } : {}),
        },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'Event slug is required' }, { status: 400 });
    }

    const { adminUserId, adminEmail, mfaLevel } = auth.session;

    const eventsClient = auth.session.supabase as unknown as SupabaseClient;
    const { data: existing, error: lookupError } = await eventsClient
      .from('events')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    const existingEvent = (existing as Record<string, unknown> | null) ?? null;
    if (existingEvent?.external_id) {
      const message = 'This event comes from Mobilize. Hide it instead of deleting it.';
      await recordAdminAudit(auth.session.adminClient, {
        actorUserId: adminUserId,
        actorEmail: adminEmail,
        action: 'event.delete',
        targetType: 'event',
        targetId: slug,
        targetLabel:
          (existingEvent?.title as string | undefined) ?? slug,
        before: existingEvent,
        after: null,
        mfaLevel,
        outcome: 'denied',
        error: message,
      });
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const { error } = await eventsClient.from('events').delete().eq('slug', slug);

    if (error) {
      await recordAdminAudit(auth.session.adminClient, {
        actorUserId: adminUserId,
        actorEmail: adminEmail,
        action: 'event.delete',
        targetType: 'event',
        targetId: slug,
        targetLabel:
          (existingEvent?.title as string | undefined) ?? slug,
        before: existingEvent,
        after: null,
        mfaLevel,
        outcome: 'failure',
        error: error.message,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recordAdminAudit(auth.session.adminClient, {
      actorUserId: adminUserId,
      actorEmail: adminEmail,
      action: 'event.delete',
      targetType: 'event',
      targetId: slug,
      targetLabel:
        (existingEvent?.title as string | undefined) ?? slug,
      before: existingEvent,
      after: null,
      mfaLevel,
      outcome: 'success',
    });

    revalidateTag('events', 'hours');
    revalidatePath('/events');
    revalidatePath('/');

    return NextResponse.json({ success: true, deletedSlug: slug }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete event' },
      { status: 500 }
    );
  }
}
