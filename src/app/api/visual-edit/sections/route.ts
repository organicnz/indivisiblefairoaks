import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { Database } from '@/types/supabase';

/**
 * Visual Editor Sections API
 *
 * CRUD operations for visual editor sections across CMS content, CRM contacts,
 * tasks, broadcasts, and custom pages. All operations require admin
 * authentication via the admin client.
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pathname = searchParams.get('pathname') || '/';

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    // Check admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin required' }, { status: 403 });
    }

    // Fetch published content sections
    const { data: contentSections } = await supabase
      .from('content')
      .select('*')
      .eq('status', 'publish');

    const sections = (contentSections || []).map((row: any) => ({
      id: `content-${row.id}`,
      type: 'cms' as const,
      title: row.title || row.slug || 'Untitled',
      slug: row.slug,
      content: row.body,
      metadata: row.metadata,
      status: row.status,
      backendId: row.id,
    }));

    return NextResponse.json({ sections });
  } catch (error) {
    console.error('Failed to fetch visual edit sections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { section, operation } = body;

    if (!section) {
      return NextResponse.json({ error: 'Section data required' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    // Check admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin required' }, { status: 403 });
    }

    // Handle different operations
    if (operation === 'create') {
      const { data, error } = await supabase
        .from('content')
        .insert({
          title: section.title,
          slug: section.slug || null,
          body: section.content || '',
          excerpt: section.excerpt || null,
          type: section.type || 'page',
          status: section.status || 'draft',
          featured_image: section.featured_image || null,
          metadata: section.metadata || {},
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        section: {
          id: `content-${data.id}`,
          type: 'cms',
          title: data.title,
          slug: data.slug,
          content: data.body,
          metadata: data.metadata,
          status: data.status,
          backendId: data.id,
        },
      });
    } else if (operation === 'update') {
      const { id } = section;
      if (!id) {
        return NextResponse.json({ error: 'Section ID required for update' }, { status: 400 });
      }

      const { expectedUpdatedAt, ...updateData } = section;

      const { data, error } = await supabase
        .from('content')
        .update(updateData)
        .eq('id', Number(id.replace('content-', '')))
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        section: {
          id: `content-${data.id}`,
          type: 'cms',
          title: data.title,
          slug: data.slug,
          content: data.body,
          metadata: data.metadata,
          status: data.status,
          backendId: data.id,
        },
      });
    } else if (operation === 'delete') {
      const { id } = section;
      if (!id) {
        return NextResponse.json({ error: 'Section ID required for delete' }, { status: 400 });
      }

      const { error } = await supabase
        .from('content')
        .delete()
        .eq('id', Number(id.replace('content-', '')));

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Invalid operation. Use: create, update, or delete' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Failed to save visual edit section:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Section ID required' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    // Check admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin required' }, { status: 403 });
    }

    const rowId = Number(id.replace('content-', ''));

    const { error } = await supabase.from('content').delete().eq('id', rowId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete visual edit section:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
