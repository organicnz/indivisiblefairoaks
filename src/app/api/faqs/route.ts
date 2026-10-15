import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPublicClient, createServerClient } from '@/lib/supabase-server';

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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch FAQs from database' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/faqs
 * Admin-authenticated upsert of a FAQ item into Supabase DB faqs table.
 */
export async function POST(req: NextRequest) {
  try {
    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { data: profile } = await authClient
      .from('profiles')
      .select('is_admin')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }

    const json = await req.json();
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

    const { data, error } = await authClient
      .from('faqs')
      .upsert(upsertRow, { onConflict: 'slug' })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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
    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { data: profile } = await authClient
      .from('profiles')
      .select('is_admin')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');

    if (!slug && !id) {
      return NextResponse.json({ error: 'slug or id parameter required' }, { status: 400 });
    }

    let deleteQuery = authClient.from('faqs').delete();
    if (slug) {
      deleteQuery = deleteQuery.eq('slug', slug);
    } else if (id) {
      deleteQuery = deleteQuery.eq('id', Number(id));
    }

    const { error } = await deleteQuery;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: slug || id }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete FAQ' },
      { status: 500 }
    );
  }
}
