import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { recordAdminAudit } from '@/lib/admin-audit';
import { readJsonBodyWithLimit } from '@/lib/request-body';
import { createPublicClient } from '@/lib/supabase-server';

/** Bounded JSON bodies: these routes are reachable by admins, not the open internet. */
const MAX_JSON_BODY_BYTES = 64_000;

const faqSchema = z.object({
  slug: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1, 'Category is required').max(100),
  question: z.string().trim().min(1, 'Question is required').max(300),
  answer: z.string().trim().min(1, 'Answer is required'),
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
 * GET /api/faqs
 * Public edge-cached endpoint returning chapter FAQs and distinct categories directly from Supabase DB.
 */
export async function GET() {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('faqs')
      .select('id, slug, category, question, answer, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('FAQ query failed:', error);
      return NextResponse.json({ error: 'Failed to fetch FAQs from database' }, { status: 500 });
    }

    const faqs = data ?? [];
    const categories = Array.from(new Set(faqs.map((f) => f.category))).filter(Boolean);

    return NextResponse.json(
      { success: true, faqs, categories },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    console.error('FAQ route failed:', err);
    return NextResponse.json({ error: 'Failed to fetch FAQs from database' }, { status: 500 });
  }
}

/**
 * POST /api/faqs
 * Admin-authenticated upsert of a FAQ item into Supabase DB faqs table.
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
    const parsed = faqSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid FAQ payload' },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const finalSlug = payload.slug
      ? slugify(payload.slug)
      : slugify(payload.question) || `faq-${Date.now()}`;

    const upsertRow = {
      slug: finalSlug,
      category: payload.category,
      question: payload.question,
      answer: payload.answer,
      sort_order: payload.sort_order,
      updated_at: new Date().toISOString(),
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
        action: 'faq.save',
        targetType: 'faq',
        targetId,
        targetLabel,
        before: null,
        after,
        mfaLevel: auth.session.mfaLevel,
        outcome,
        error: error ?? null,
      });

    const { data, error } = await auth.session.supabase
      .from('faqs')
      .upsert(upsertRow, { onConflict: 'slug' })
      .select('*')
      .single();

    if (error) {
      await auditSave('failure', finalSlug, payload.question, upsertRow, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const saved = (data ?? null) as { slug?: string; question?: string } | null;
    await auditSave(
      'success',
      saved?.slug ?? finalSlug,
      saved?.question ?? payload.question,
      data ?? upsertRow
    );
    return NextResponse.json({ success: true, faq: data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save FAQ' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/faqs
 * Admin-authenticated deletion of a FAQ item from Supabase DB faqs table.
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
    const id = searchParams.get('id');

    if (!slug && !id) {
      return NextResponse.json({ error: 'slug or id parameter required' }, { status: 400 });
    }

    const identifier = slug ?? String(id);
    const auditDelete = (outcome: 'success' | 'failure', after: unknown, error?: string) =>
      recordAdminAudit(auth.session.adminClient, {
        actorUserId: auth.session.adminUserId,
        actorEmail: auth.session.adminEmail,
        action: 'faq.delete',
        targetType: 'faq',
        targetId: identifier,
        targetLabel: identifier,
        before: null,
        after,
        mfaLevel: auth.session.mfaLevel,
        outcome,
        error: error ?? null,
      });

    let deleteQuery = auth.session.supabase.from('faqs').delete();
    if (slug) {
      deleteQuery = deleteQuery.eq('slug', slug);
    } else if (id) {
      const numericId = Number(id);
      if (!Number.isInteger(numericId) || numericId <= 0) {
        return NextResponse.json({ error: 'Invalid FAQ id' }, { status: 400 });
      }
      deleteQuery = deleteQuery.eq('id', numericId);
    }

    const { error } = await deleteQuery;
    if (error) {
      await auditDelete('failure', null, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await auditDelete('success', { deleted: true });

    return NextResponse.json({ success: true, deleted: slug || id }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete FAQ' },
      { status: 500 }
    );
  }
}
