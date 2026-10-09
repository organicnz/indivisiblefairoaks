import { NextResponse } from 'next/server';
import { deleteCRMMedia, getCRMMediaFiles, uploadCRMMedia } from '@/lib/actions/crm';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Visual Editor Media API
 *
 * CRUD operations for media items associated with visual editor sections and CRM.
 * Media is stored in Supabase S3 Storage bucket 'media'.
 * All operations require admin authentication.
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get('folder') || 'all';
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 100;

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin required' }, { status: 403 });
    }

    const res = await getCRMMediaFiles({ folder, search, limit });
    return NextResponse.json({ media: res.items, folders: res.folders });
  } catch (error) {
    console.error('Failed to fetch visual edit media:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin required' }, { status: 403 });
    }

    const formData = await req.formData();
    const res = await uploadCRMMedia(formData);

    if (!res.success) {
      return NextResponse.json({ error: res.error || 'Upload failed' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      media: res.data,
    });
  } catch (error) {
    console.error('Failed to upload visual edit media:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path') || searchParams.get('id');

    if (!path) {
      return NextResponse.json({ error: 'Media path required' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin required' }, { status: 403 });
    }

    const res = await deleteCRMMedia(path);
    if (!res.success) {
      return NextResponse.json({ error: res.error || 'Delete failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete visual edit media:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
