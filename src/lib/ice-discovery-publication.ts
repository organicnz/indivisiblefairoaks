/**
 * Publication state for an ICE source report.
 *
 * Two independent gates decide whether a row is public:
 *
 * 1. `rights_status = 'confirmed'` — a human confirmed the chapter may
 *    republish the source's text.
 * 2. `publication_status = 'published'` — the row was submitted for public
 *    release. Discovery intake writes `draft` unless the operator explicitly
 *    enables auto-publication.
 *
 * `published_at` adds the third, time-based condition every public read already
 * enforced: a row cannot become visible before its publication timestamp.
 */

export type IceSourceReportPublicationStatus = 'draft' | 'published';

export type IceSourceReportPublicationState =
  | 'public'
  | 'scheduled'
  | 'draft-rights'
  | 'draft-unpublished';

export function parseIceDiscoveryAutoPublish(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export function discoveryPublicationStatus(autoPublish: boolean): IceSourceReportPublicationStatus {
  return autoPublish ? 'published' : 'draft';
}

export function iceSourceReportPublicationState(
  row: {
    publication_status: IceSourceReportPublicationStatus | string | null;
    rights_status: 'confirmed' | 'unconfirmed' | null;
    published_at: string | null;
  },
  now = Date.now()
): IceSourceReportPublicationState {
  if (row.rights_status !== 'confirmed') return 'draft-rights';
  if (row.publication_status !== 'published') return 'draft-unpublished';

  const publishedAt = row.published_at ? Date.parse(row.published_at) : Number.NaN;
  if (Number.isNaN(publishedAt)) return 'draft-unpublished';
  return publishedAt > now ? 'scheduled' : 'public';
}

export function iceSourceReportPublicationStateLabel(
  state: IceSourceReportPublicationState
): string {
  if (state === 'public') return 'Public now';
  if (state === 'scheduled') return 'Scheduled';
  if (state === 'draft-rights') return 'Draft — rights pending';
  return 'Draft — publication held';
}
