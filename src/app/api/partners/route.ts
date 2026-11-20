import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { recordAdminAudit } from '@/lib/admin-audit';
import { readJsonBodyWithLimit } from '@/lib/request-body';
import { createPublicClient } from '@/lib/supabase-server';

/** Bounded JSON bodies: these routes are reachable by admins, not the open internet. */
const MAX_JSON_BODY_BYTES = 64_000;

const partnerSchema = z.object({
  slug: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1, 'Partner name is required').max(200),
  category: z.string().trim().default(''),
  description: z.string().trim().default(''),
  url: z.string().trim().url('Valid URL is required'),
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
 * GET /api/partners
 * Public edge-cached endpoint returning grassroots partners directly from Supabase DB.
 */
export async function GET() {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('partners')
      .select('slug, name, category, description, url, sort_order, created_at')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Partners query failed:', error);
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, partners: data ?? [] },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    console.error('Partners route failed:', err);
    return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 });
  }
}

/**
 * POST /api/partners
 * Admin-authenticated upsert of a partner into Supabase DB partners table.
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
    const parsed = partnerSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid partner payload' },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const finalSlug = payload.slug
      ? slugify(payload.slug)
      : slugify(payload.name) || `partner-${Date.now()}`;

    const upsertRow = {
      slug: finalSlug,
      name: payload.name,
      category: payload.category,
      description: payload.description,
      url: payload.url,
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
        action: 'partner.save',
        targetType: 'partner',
        targetId,
        targetLabel,
        before: null,
        after,
        mfaLevel: auth.session.mfaLevel,
        outcome,
        error: error ?? null,
      });

    const { data, error } = await auth.session.supabase
      .from('partners')
      .upsert(upsertRow, { onConflict: 'slug' })
      .select('*')
      .single();

    if (error) {
      await auditSave('failure', finalSlug, payload.name, upsertRow, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const saved = (data ?? null) as { slug?: string; name?: string } | null;
    await auditSave(
      'success',
      saved?.slug ?? finalSlug,
      saved?.name ?? payload.name,
      data ?? upsertRow
    );
    return NextResponse.json({ success: true, partner: data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save partner' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partners
 * Admin-authenticated deletion of a partner by slug.
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
        action: 'partner.delete',
        targetType: 'partner',
        targetId: slug,
        targetLabel: slug,
        before: null,
        after,
        mfaLevel: auth.session.mfaLevel,
        outcome,
        error: error ?? null,
      });

    const { error } = await auth.session.supabase.from('partners').delete().eq('slug', slug);
    if (error) {
      await auditDelete('failure', null, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await auditDelete('success', { deleted: true });

    return NextResponse.json({ success: true, deleted: slug }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete partner' },
      { status: 500 }
    );
  }
}
