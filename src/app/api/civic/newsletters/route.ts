import { revalidatePath, revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { recordAdminAudit } from '@/lib/admin-audit';
import { requireAdminApi } from '@/lib/admin-api-auth';
import {
  newsletterInputSchema,
  normalizeNewsletterTopics,
  slugifyNewsletter,
} from '@/lib/newsletters';
import { buildNewsletterVisibilityFilter } from '@/lib/queries/civic';
import { createPublicClient } from '@/lib/supabase-server';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function revalidateNewsletters(): void {
  revalidateTag('newsletters', 'hours');
  revalidatePath('/newsletters');
  revalidatePath('/news');
  revalidatePath('/api/civic/newsletters');
}

/**
 * GET /api/civic/newsletters
 * Public chapter bulletins. Future-dated entries are omitted until their
 * publication timestamp passes; the admin manager reads the full table.
 */
export async function GET() {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('newsletters')
      .select('slug, title, date_label, description, topics, sort_order, published_at, created_at')
      .or(buildNewsletterVisibilityFilter(new Date().toISOString()))
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, newsletters: data ?? [] },
      {
        status: 200,
        // Short enough that an admin save is visible without a deploy, long
        // enough that the public page's initial load is served from the edge.
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch newsletters from database' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/civic/newsletters
 * Admin-authenticated create or update. A create is an INSERT: reusing an
 * existing slug returns a conflict instead of silently replacing that bulletin.
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

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = newsletterInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid newsletter payload' },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const finalSlug =
      (payload.slug ? slugifyNewsletter(payload.slug) : '') ||
      slugifyNewsletter(payload.title) ||
      `newsletter-${Date.now()}`;
    const originalSlug =
      payload.original_slug !== undefined ? slugifyNewsletter(payload.original_slug) : null;
    if (payload.original_slug !== undefined && !originalSlug) {
      return NextResponse.json(
        { error: 'The bulletin being edited has an invalid identifier. Refresh and try again.' },
        { status: 400 }
      );
    }

    const existingResult = originalSlug
      ? await auth.session.supabase
          .from('newsletters')
          .select('*')
          .eq('slug', originalSlug)
          .maybeSingle()
      : await auth.session.supabase
          .from('newsletters')
          .select('slug')
          .eq('slug', finalSlug)
          .maybeSingle();
    if (existingResult.error) {
      return NextResponse.json({ error: existingResult.error.message }, { status: 500 });
    }

    const existing = existingResult.data;
    if (originalSlug && !existing) {
      return NextResponse.json(
        { error: 'This bulletin no longer exists. Refresh and try again.' },
        { status: 404 }
      );
    }
    if (!originalSlug && existing) {
      return NextResponse.json(
        { error: `"${finalSlug}" is already used by another bulletin. Pick another slug.` },
        { status: 409 }
      );
    }

    const row = {
      slug: finalSlug,
      title: payload.title,
      date_label: payload.date_label,
      description: payload.description,
      topics: payload.topics,
      sort_order: payload.sort_order,
      published_at: payload.published_at ?? new Date().toISOString(),
    };

    const auditAction = originalSlug ? 'newsletter.update' : 'newsletter.create';
    const audit = (
      outcome: 'success' | 'failure',
      after: Record<string, unknown> | null,
      error?: string
    ) =>
      recordAdminAudit(auth.session.adminClient, {
        actorUserId: auth.session.adminUserId,
        actorEmail: auth.session.adminEmail,
        action: auditAction,
        targetType: 'newsletter',
        targetId: finalSlug,
        targetLabel: row.title,
        before: existing,
        after,
        mfaLevel: auth.session.mfaLevel,
        outcome,
        error: error ?? null,
      });

    const write = originalSlug
      ? auth.session.supabase.from('newsletters').update(row).eq('slug', originalSlug)
      : auth.session.supabase.from('newsletters').insert(row);
    const { data, error } = await write.select('*').single();

    if (error) {
      const status =
        error.code === '23505' ? 409 : error.code === 'PGRST116' ? 404 : 500;
      const message =
        error.code === '23505'
          ? `"${finalSlug}" is already used by another bulletin. Pick another slug.`
          : error.code === 'PGRST116'
            ? 'This bulletin no longer exists. Refresh and try again.'
            : error.message;
      await audit('failure', null, message);
      return NextResponse.json({ error: message }, { status });
    }

    const saved = {
      ...(data as Record<string, unknown>),
      topics: normalizeNewsletterTopics(
        Array.isArray((data as Record<string, unknown>).topics)
          ? ((data as Record<string, unknown>).topics as string[])
          : []
      ),
    };

    await audit('success', saved);
    revalidateNewsletters();

    return NextResponse.json(
      { success: true, newsletter: saved },
      { status: 200, headers: NO_STORE }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save newsletter' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/civic/newsletters
 * Admin-authenticated deletion. A missing row is a 404, not a success.
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
    const rawSlug = searchParams.get('slug');
    const slug = rawSlug ? slugifyNewsletter(rawSlug) : '';
    if (!slug) {
      return NextResponse.json({ error: 'Newsletter slug is required' }, { status: 400 });
    }

    const { data: existing, error: lookupError } = await auth.session.supabase
      .from('newsletters')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
    }

    const audit = (outcome: 'success' | 'failure', error?: string) =>
      recordAdminAudit(auth.session.adminClient, {
        actorUserId: auth.session.adminUserId,
        actorEmail: auth.session.adminEmail,
        action: 'newsletter.delete',
        targetType: 'newsletter',
        targetId: slug,
        targetLabel: existing.title ?? slug,
        before: existing,
        after: null,
        mfaLevel: auth.session.mfaLevel,
        outcome,
        error: error ?? null,
      });

    const { data: deleted, error } = await auth.session.supabase
      .from('newsletters')
      .delete()
      .eq('slug', slug)
      .select('slug')
      .maybeSingle();
    if (error) {
      await audit('failure', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!deleted) {
      await audit('failure', 'Newsletter not found');
      return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
    }

    await audit('success');
    revalidateNewsletters();

    return NextResponse.json(
      { success: true, deletedSlug: slug },
      { status: 200, headers: NO_STORE }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete newsletter' },
      { status: 500 }
    );
  }
}
