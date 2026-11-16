import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { env } from '@/lib/env';
import { US_STATE_CODES } from '@/lib/rapid-city-match';
import type {
  IceReportIntakeRow,
  IceReportKind,
  IceReportPublicRow,
  IceReportStatus,
} from '@/lib/ice-report-shared';

export type {
  IceReportIntakeRow,
  IceReportKind,
  IceReportPublicRow,
  IceReportStatus,
} from '@/lib/ice-report-shared';

export const ICE_REPORT_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
export const ICE_REPORT_FUTURE_TOLERANCE_MS = 5 * 60 * 1_000;
export const ICE_REPORT_RETENTION_DAYS = 30;
export const ICE_REPORT_PUBLIC_DAYS = 7;

type IceReportIntakeInsert = {
  id?: string;
  reference_code: string;
  city: string;
  state_code: string;
  kind: IceReportKind;
  observed_at: string;
  summary: string;
  retention_expires_at: string;
};

type IceReportIntakeUpdate = Partial<
  Pick<
    IceReportIntakeRow,
    | 'status'
    | 'reviewer_one_id'
    | 'reviewer_one_at'
    | 'reviewer_two_id'
    | 'reviewer_two_at'
    | 'public_city'
    | 'public_state_code'
    | 'public_kind'
    | 'public_observed_at'
    | 'public_summary'
    | 'rejection_reason'
  >
>;

type IceReportDatabase = {
  public: {
    Tables: {
      ice_report_intake: {
        Row: IceReportIntakeRow;
        Insert: IceReportIntakeInsert;
        Update: IceReportIntakeUpdate;
        Relationships: [];
      };
      ice_public_reports: {
        Row: IceReportPublicRow;
        Insert: Omit<IceReportPublicRow, 'id' | 'published_at' | 'expires_at'>;
        Update: Partial<IceReportPublicRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      ice_publish_report: {
        Args: {
          p_report_id: string;
          p_reviewer_id: string;
          p_lat: number;
          p_lng: number;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type IceReportStore = SupabaseClient<IceReportDatabase>;

export function getIceReportStore(): IceReportStore | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  return createClient<IceReportDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function iceReportReferenceFromBytes(bytes: Uint8Array) {
  let code = 'C-';
  for (let index = 0; index < 7; index += 1) {
    code += REFERENCE_ALPHABET[bytes[index] % REFERENCE_ALPHABET.length];
  }
  return code;
}

export function makeIceReportReference() {
  return iceReportReferenceFromBytes(crypto.getRandomValues(new Uint8Array(7)));
}

export function stripReportHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reject content that has a high chance of identifying a person, vehicle, or
 * exact place. Human review is still required; this is a first boundary, not a
 * claim of automatic redaction.
 */
export function reportTextIssue(value: string): string | null {
  if (/https?:\/\/|www\./i.test(value)) {
    return 'Remove links. This form is only for a short, first-person observation.';
  }
  if (/\S+@\S+\.\S+/.test(value)) {
    return 'Remove email addresses. Do not send contact details.';
  }
  if (/(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/.test(value)) {
    return 'Remove phone numbers. Do not send contact details.';
  }
  if (/\b\d{5,}\b/.test(value)) {
    return 'Remove long numbers such as plate, case, or address numbers.';
  }
  return null;
}

export function isIceReportKind(value: string): value is IceReportKind {
  return value === 'enforcement' || value === 'detention' || value === 'checkpoint';
}

export function isAcceptableObservedAt(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  if (timestamp > now + ICE_REPORT_FUTURE_TOLERANCE_MS) return false;
  return timestamp >= now - ICE_REPORT_MAX_AGE_MS;
}

const citySchema = z
  .string()
  .trim()
  .min(2, 'Add a city.')
  .max(80, 'Keep the city under 80 characters.')
  .refine(
    (value) => /^[\p{L}][\p{L} .'’\-]*$/u.test(value),
    'Use a city name only. Do not include a street address or number.'
  );

const stateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Choose a U.S. state.')
  .refine((value) => US_STATE_CODES.has(value), 'Choose a U.S. state.');

const summarySchema = z
  .string()
  .transform(stripReportHtml)
  .pipe(
    z
      .string()
      .min(30, 'Add a little more detail (at least 30 characters).')
      .max(600, 'Keep the report under 600 characters.')
      .refine((value) => !reportTextIssue(value), {
        message:
          'Remove links, email addresses, phone numbers, plate numbers, or other long numbers.',
      })
  );

export const iceReportPublicCitySchema = citySchema;
export const iceReportPublicStateSchema = stateSchema;
export const iceReportPublicSummarySchema = z
  .string()
  .transform(stripReportHtml)
  .pipe(
    z
      .string()
      .min(30, 'Write a public summary of at least 30 characters.')
      .max(400, 'Keep the public summary under 400 characters.')
      .refine((value) => !reportTextIssue(value), {
        message:
          'Remove links, email addresses, phone numbers, plate numbers, or other long numbers.',
      })
  );

export const iceReportInputSchema = z.object({
  city: citySchema,
  stateCode: stateSchema,
  kind: z.enum(['enforcement', 'detention', 'checkpoint']),
  observedAt: z
    .string()
    .datetime({ offset: true })
    .refine((value) => isAcceptableObservedAt(value), 'Choose a time within the last 24 hours.'),
  summary: summarySchema,
  consent: z.literal(true, { message: 'Confirm the review and publication terms.' }),
  /** Honeypot. Real browsers leave this empty. */
  company: z.string().max(200).optional(),
});

export const iceReportProofSchema = z.object({
  token: z.string().min(1).max(4_096),
  nonce: z.string().regex(/^\d{1,10}$/),
});

export type IceReportInput = z.infer<typeof iceReportInputSchema>;

export async function insertIceReport(
  store: IceReportStore,
  row: IceReportIntakeInsert
) {
  const { data, error } = await store
    .from('ice_report_intake')
    .insert(row)
    .select('id, reference_code')
    .single();
  if (error) throw new Error(`ice report insert failed: ${error.message}`);
  return data;
}

export async function listIceReportQueue(store: IceReportStore, limit = 100) {
  const { data, error } = await store
    .from('ice_report_intake')
    .select('*')
    .in('status', ['received', 'needs_second_review'])
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`ice report queue failed: ${error.message}`);
  return data ?? [];
}

export async function getIceReportById(store: IceReportStore, id: string) {
  const { data, error } = await store
    .from('ice_report_intake')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`ice report lookup failed: ${error.message}`);
  return data;
}

export async function updateIceReport(
  store: IceReportStore,
  id: string,
  row: IceReportIntakeUpdate
) {
  const { data, error } = await store
    .from('ice_report_intake')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`ice report update failed: ${error.message}`);
  return data;
}

export async function publishIceReport(
  store: IceReportStore,
  reportId: string,
  reviewerId: string,
  lat: number,
  lng: number
) {
  const { data, error } = await store.rpc('ice_publish_report', {
    p_report_id: reportId,
    p_reviewer_id: reviewerId,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getPublishedIceReports(store: IceReportStore, limit = 20) {
  const { data, error } = await store
    .from('ice_public_reports')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('observed_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`public ice reports failed: ${error.message}`);
  return data ?? [];
}

export async function purgeExpiredPublicIceReports(store: IceReportStore) {
  const now = new Date().toISOString();
  const { data, error } = await store
    .from('ice_public_reports')
    .delete()
    .lte('expires_at', now)
    .select('id');
  if (error) throw new Error(`public ice report purge failed: ${error.message}`);
  return data?.length ?? 0;
}

export async function purgeExpiredIceReports(store: IceReportStore) {
  const now = new Date().toISOString();
  const { data, error } = await store
    .from('ice_report_intake')
    .delete()
    .lte('retention_expires_at', now)
    .select('id');
  if (error) throw new Error(`ice report purge failed: ${error.message}`);
  return data?.length ?? 0;
}
