import { revalidatePath, revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { recordAdminAudit } from '@/lib/admin-audit';
import { readJsonBodyWithLimit } from '@/lib/request-body';
import { createPublicClient } from '@/lib/supabase-server';

/** Bounded JSON bodies: these routes are reachable by admins, not the open internet. */
const MAX_JSON_BODY_BYTES = 64_000;

const coalitionLinkSchema = z.object({
  slug: z.string().trim().min(1).max(120).optional(),
  original_slug: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1, 'Link name is required').max(200),
  category: z.string().trim().default(''),
  url: z.string().trim().url('Valid URL is required'),
  description: z.string().trim().default(''),
  badge: z.string().trim().nullable().optional(),
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
 * GET /api/coalition-links
 * Public edge-cached endpoint returning coalition and action links directly from Supabase DB.
 */
export async function GET() {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('coalition_links')
      .select('slug, name, category, url, description, badge, sort_order, created_at')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Coalition links query failed:', error);
      return NextResponse.json({ error: 'Failed to fetch coalition links' }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, links: data ?? [] },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    console.error('Coalition links route failed:', err);
    return NextResponse.json({ error: 'Failed to fetch coalition links' }, { status: 500 });
  }
}

/**
 * POST /api/coalition-links
 * Admin-authenticated upsert of a coalition link into Supabase DB coalition_links table.
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

    const body = await readJsonBodyWithLimit(req, MAX_JSON_BODY_BYTES);
    if (!body.ok) {
      return NextResponse.json(
        { error: body.code === 'too-large' ? 'Request body is too large.' : 'Invalid JSON body.' },
        { status: body.code === 'too-large' ? 413 : 400 }
      );
    }
    const json = body.value;
    const parsed = coalitionLinkSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid coalition link payload' },
        { status: 400 }
      );
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
      badge: payload.badge ?? null,
      sort_order: payload.sort_order,
    };
    const auditSave = (
      outcome: 'success' | 'failure',
      targetId: string,
      targetLabel: string,
      after: unknown,
      error?: string
    ) =>
      recordAdminAudit(auth.session.adminClient, {
        actorUserId: auth.session.adminUserId,
        actorEmail: auth.session.adminEmail,
        action: 'coalition_link.save',
        targetType: 'coalition_link',
        targetId,
        targetLabel,
        before: null,
        after,
        mfaLevel: auth.session.mfaLevel,
        outcome,
        error: error ?? null,
        metadata: originalSlug ? { original_slug: originalSlug } : null,
      });

    const write = isRename
      ? auth.session.supabase
          .from('coalition_links')
          .update(upsertRow)
          .eq('slug', originalSlug ?? finalSlug)
      : auth.session.supabase.from('coalition_links').upsert(upsertRow, { onConflict: 'slug' });
    const { data, error } = await write.select('*').single();

    if (error) {
      const message =
        error.code === '23505' ? `"${finalSlug}" is already used by another link.` : error.message;
      await auditSave('failure', finalSlug, payload.name, upsertRow, message);
      if (error.code === '23505') {
        return NextResponse.json({ error: message }, { status: 409 });
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const saved = (data ?? null) as { slug?: string; name?: string } | null;
    await auditSave(
      'success',
      saved?.slug ?? finalSlug,
      saved?.name ?? payload.name,
      data ?? upsertRow
    );
    revalidateTag('coalition-links', 'hours');
    revalidatePath('/links');

    return NextResponse.json({ success: true, link: data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save coalition link' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/coalition-links
 * Admin-authenticated deletion of a coalition link by slug.
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
    const slug = searchParams.get('slug')?.slice(0, 120);

    if (!slug) {
      return NextResponse.json({ error: 'slug parameter required' }, { status: 400 });
    }

    const auditDelete = (outcome: 'success' | 'failure', after: unknown, error?: string) =>
      recordAdminAudit(auth.session.adminClient, {
        actorUserId: auth.session.adminUserId,
        actorEmail: auth.session.adminEmail,
        action: 'coalition_link.delete',
        targetType: 'coalition_link',
        targetId: slug,
        targetLabel: slug,
        before: null,
        after,
        mfaLevel: auth.session.mfaLevel,
        outcome,
        error: error ?? null,
      });

    const { error } = await auth.session.supabase.from('coalition_links').delete().eq('slug', slug);
    if (error) {
      await auditDelete('failure', null, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await auditDelete('success', { deleted: true });

    revalidateTag('coalition-links', 'hours');
    revalidatePath('/links');

    return NextResponse.json({ success: true, deleted: slug }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete coalition link' },
      { status: 500 }
    );
  }
}
