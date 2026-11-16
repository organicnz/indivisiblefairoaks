/**
 * Client-safe ICE report types and labels. Keep storage, environment, and
 * Supabase imports out of this module so the moderation UI never pulls a
 * service-role client into the browser bundle.
 */
export type IceReportKind = 'enforcement' | 'detention' | 'checkpoint';
export type IceReportStatus = 'received' | 'needs_second_review' | 'published' | 'rejected';

export type IceReportIntakeRow = {
  id: string;
  reference_code: string;
  city: string;
  state_code: string;
  kind: IceReportKind;
  observed_at: string;
  summary: string;
  status: IceReportStatus;
  reviewer_one_id: string | null;
  reviewer_one_at: string | null;
  reviewer_two_id: string | null;
  reviewer_two_at: string | null;
  public_city: string | null;
  public_state_code: string | null;
  public_kind: IceReportKind | null;
  public_observed_at: string | null;
  public_summary: string | null;
  rejection_reason: string | null;
  retention_expires_at: string;
  created_at: string;
  updated_at: string;
};

export type IceReportPublicRow = {
  id: string;
  report_id: string;
  city: string;
  state_code: string;
  kind: IceReportKind;
  observed_at: string;
  summary: string;
  lat: number;
  lng: number;
  published_at: string;
  expires_at: string;
};

export function iceReportKindLabel(kind: IceReportKind) {
  if (kind === 'detention') return 'Detention';
  if (kind === 'checkpoint') return 'Checkpoint';
  return 'Enforcement';
}

export function iceReportStatusLabel(status: IceReportStatus) {
  if (status === 'needs_second_review') return 'Awaiting second reviewer';
  if (status === 'published') return 'Published';
  if (status === 'rejected') return 'Rejected';
  return 'Awaiting first review';
}
