import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export const REUNIFICATION_BUCKET = 'ice-reunification';
export const REUNIFICATION_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export type ReunificationStatus = 'received' | 'verifying' | 'verified' | 'closed';

export type ReunificationRequest = {
  id: string;
  reference_code: string;
  access_token: string;
  submitter_name: string;
  submitter_email: string;
  submitter_phone: string | null;
  relationship: string;
  person_name: string;
  person_aliases: string | null;
  person_dob: string | null;
  detention_date: string | null;
  detention_city: string | null;
  detention_state: string | null;
  facility: string | null;
  a_number: string | null;
  notes: string | null;
  photo_path: string | null;
  status: ReunificationStatus;
  status_note: string | null;
  consent_contact: boolean;
  consent_privacy: boolean;
  retention_expires_at: string;
  created_at: string;
  updated_at: string;
};

export type ReunificationStatusView = {
  reference_code: string;
  status: ReunificationStatus;
  status_note: string | null;
  created_at: string;
  updated_at: string;
};

type ReunificationInsert = {
  id?: string;
  reference_code: string;
  access_token: string;
  submitter_name: string;
  submitter_email: string;
  submitter_phone: string | null;
  relationship: string;
  person_name: string;
  person_aliases: string | null;
  person_dob: string | null;
  detention_date: string | null;
  detention_city: string | null;
  detention_state: string | null;
  facility: string | null;
  a_number: string | null;
  notes: string | null;
  photo_path: string | null;
  consent_contact: boolean;
  consent_privacy: boolean;
};

type ReunificationDatabase = {
  public: {
    Tables: {
      ice_reunification_requests: {
        Row: ReunificationRequest;
        Insert: ReunificationInsert;
        Update: Partial<
          Pick<
            ReunificationRequest,
            'status' | 'status_note' | 'photo_path' | 'retention_expires_at'
          >
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type ReunificationStore = SupabaseClient<ReunificationDatabase>;

export function getReunificationStore(): ReunificationStore | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  return createClient<ReunificationDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function referenceCodeFromBytes(bytes: Uint8Array) {
  let code = 'R-';
  for (let index = 0; index < 7; index += 1) {
    code += REFERENCE_ALPHABET[bytes[index] % REFERENCE_ALPHABET.length];
  }
  return code;
}

export function makeReferenceCode() {
  return referenceCodeFromBytes(crypto.getRandomValues(new Uint8Array(7)));
}

export function isReunificationUuid(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export type ReunificationImageType = 'image/jpeg' | 'image/png' | 'image/webp';

/** Detect by magic bytes, not the browser-supplied MIME label. */
export function detectReunificationImage(
  bytes: Uint8Array
): ReunificationImageType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

function extensionFor(type: ReunificationImageType) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadReunificationPhoto(
  store: ReunificationStore,
  requestId: string,
  bytes: Uint8Array,
  type: ReunificationImageType
) {
  const path = `${requestId}/photo.${extensionFor(type)}`;
  const { error } = await store.storage
    .from(REUNIFICATION_BUCKET)
    .upload(path, Buffer.from(bytes), {
      contentType: type,
      upsert: false,
    });
  if (error) throw new Error(`reunification photo upload failed: ${error.message}`);
  return path;
}

export async function removeReunificationPhoto(
  store: ReunificationStore,
  path: string
) {
  await store.storage.from(REUNIFICATION_BUCKET).remove([path]);
}

export async function insertReunificationRequest(
  store: ReunificationStore,
  row: ReunificationInsert
) {
  const { data, error } = await store
    .from('ice_reunification_requests')
    .insert(row)
    .select('id, reference_code, access_token')
    .single();
  if (error) throw new Error(`reunification insert failed: ${error.message}`);
  return data;
}

export async function listExpiredReunificationRequests(
  store: ReunificationStore,
  limit = 100
) {
  const { data, error } = await store
    .from('ice_reunification_requests')
    .select('id, photo_path')
    .lte('retention_expires_at', new Date().toISOString())
    .order('retention_expires_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`reunification retention query failed: ${error.message}`);
  return data ?? [];
}

export async function deleteReunificationRequests(
  store: ReunificationStore,
  ids: string[]
) {
  if (ids.length === 0) return;
  const { error } = await store.from('ice_reunification_requests').delete().in('id', ids);
  if (error) throw new Error(`reunification purge failed: ${error.message}`);
}

export async function findReunificationStatus(
  store: ReunificationStore,
  token: string
) {
  const { data, error } = await store
    .from('ice_reunification_requests')
    .select('reference_code, status, status_note, created_at, updated_at')
    .eq('access_token', token)
    .maybeSingle();
  if (error) throw new Error(`reunification status lookup failed: ${error.message}`);
  return data;
}

export function reunificationStatusLabel(status: ReunificationStatus) {
  if (status === 'verifying') return 'Verification in progress';
  if (status === 'verified') return 'Verified — follow-up underway';
  if (status === 'closed') return 'Closed';
  return 'Received — waiting for review';
}

export function reunificationStatusDescription(status: ReunificationStatus) {
  if (status === 'verifying') {
    return 'A volunteer is checking the details you provided against official resources. We may contact you for clarification.';
  }
  if (status === 'verified') {
    return 'The request has been reviewed. A volunteer will use the contact information you provided. We cannot guarantee an outcome or a release date.';
  }
  if (status === 'closed') {
    return 'This request is closed. Contact the chapter if you need it reopened or need another follow-up.';
  }
  return 'Your private request is in the queue. A volunteer will review it and may contact you at the email or phone number you provided.';
}
