import { NextResponse } from 'next/server';
import { deleteCRMMedia, getCRMMediaFiles, uploadCRMMedia } from '@/lib/actions/crm';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { adminApiFailureResponse } from '@/lib/admin-api-response';
import { readFormDataWithLimit } from '@/lib/request-body';

const MAX_MEDIA_FORM_BYTES = 6_000_000;

/**
 * Visual Editor Media API
 *
 * CRUD operations for media items associated with visual editor sections and CRM.
 * Media is stored in Supabase S3 Storage bucket 'media'.
 * All operations require admin authentication.
 */

export async function GET(req: Request) {
  try {
    const auth = await requireAdminApi();
    if (!auth.ok) return adminApiFailureResponse(auth);

    const { searchParams } = new URL(req.url);
    const folder = searchParams.get('folder') || 'all';
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 100;

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
    const auth = await requireAdminApi();
    if (!auth.ok) return adminApiFailureResponse(auth);

    const body = await readFormDataWithLimit(req, MAX_MEDIA_FORM_BYTES);
    if (!body.ok) {
      return NextResponse.json(
        {
          error:
            body.code === 'too-large'
              ? 'Image must be 5MB or smaller'
              : 'Send the upload as multipart form data.',
        },
        { status: body.code === 'too-large' ? 413 : 400 }
      );
    }
    const res = await uploadCRMMedia(body.value);

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
    const auth = await requireAdminApi();
    if (!auth.ok) return adminApiFailureResponse(auth);

    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path') || searchParams.get('id');

    if (!path) {
      return NextResponse.json({ error: 'Media path required' }, { status: 400 });
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
