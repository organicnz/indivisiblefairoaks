import type { IceSourceReportPublicationStatus } from '@/lib/ice-discovery-publication';

export type IceCrawlSourceStatus = 'ok' | 'partial' | 'error' | 'blocked';

export type IceCrawlSource = {
  id: string;
  url: string;
  label: string;
  enabled: boolean;
  max_pages: number;
  rights_confirmed_at: string;
  last_crawled_at: string | null;
  last_status: IceCrawlSourceStatus | null;
  last_error: string | null;
  last_page_count: number;
  last_report_count: number;
  /** Optional beat filter for feed items; null admits everything. */
  relevance_terms?: string[] | null;
  created_at: string;
  updated_at: string;
};

export type IceSourceReportKind = 'enforcement' | 'detention' | 'checkpoint' | 'other';
export type IceSourceExtractionMethod = 'feed' | 'html' | 'ai' | 'fallback';

export type IceSourceReport = {
  id: string;
  source_name: string;
  source_url: string;
  source_title: string | null;
  source_published_at: string | null;
  source_retrieved_at: string;
  title: string;
  text_content: string;
  refined_text: string | null;
  refined_at: string | null;
  city: string | null;
  state_code: string | null;
  kind: IceSourceReportKind;
  extraction_method: IceSourceExtractionMethod;
  published_at: string;
  publication_status: IceSourceReportPublicationStatus;
  provenance: 'crawl' | 'discovery';
  rights_status: 'confirmed' | 'unconfirmed';
  summary: string | null;
  discovery_id: string | null;
};

export type IceCrawlDiscoveryStatus = 'pending' | 'approved' | 'rejected';
/** Automatic fetch retries stop here; the row stays pending for human review. */
export const ICE_DISCOVERY_MAX_ATTEMPTS = 6;
export type IceCrawlDiscoveryTriageConfidence = 'high' | 'medium' | 'low';
export type IceCrawlDiscoveryTriageRelevance =
  | 'enforcement'
  | 'detention'
  | 'checkpoint'
  | 'related'
  | 'off_topic';

export type IceCrawlDiscovery = {
  id: string;
  url: string;
  title: string;
  publisher: string | null;
  published_at: string | null;
  discovery_query: string;
  story_key: string | null;
  status: IceCrawlDiscoveryStatus;
  source_id: string | null;
  discovered_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  last_attempt_at: string | null;
  /** Transient fetch attempts; at the limit the row is review-only. */
  attempt_count: number;
  /** AI relevance score 0-100; null until the triage pass runs. */
  triage_score: number | null;
  triage_confidence: IceCrawlDiscoveryTriageConfidence | null;
  triage_relevance: IceCrawlDiscoveryTriageRelevance | null;
  triage_reason: string | null;
  triage_model: string | null;
  triaged_at: string | null;
  /** Canonical pending discovery when this row is a collapsed duplicate. */
  duplicate_of: string | null;
};

export function iceDiscoveryAttemptsExhausted(attemptCount: number | null | undefined) {
  return (attemptCount ?? 0) >= ICE_DISCOVERY_MAX_ATTEMPTS;
}

export function iceDiscoveryConfidenceLabel(confidence: IceCrawlDiscoveryTriageConfidence | null) {
  if (confidence === 'high') return 'High confidence';
  if (confidence === 'medium') return 'Medium confidence';
  if (confidence === 'low') return 'Low confidence';
  return 'Not triaged';
}

export function iceDiscoveryRelevanceLabel(relevance: IceCrawlDiscoveryTriageRelevance | null) {
  if (relevance === 'enforcement') return 'ICE enforcement';
  if (relevance === 'detention') return 'Detention';
  if (relevance === 'checkpoint') return 'Checkpoint';
  if (relevance === 'related') return 'Related';
  if (relevance === 'off_topic') return 'Off topic';
  return 'Unclassified';
}

export type IceCrawlSummary = {
  status: IceCrawlSourceStatus;
  pagesFetched: number;
  reportsFound: number;
  discovered: number;
  skipped: number;
  errors: string[];
  note: string;
};

export function iceSourceKindLabel(kind: IceSourceReportKind) {
  if (kind === 'detention') return 'Detention';
  if (kind === 'checkpoint') return 'Checkpoint';
  if (kind === 'enforcement') return 'Enforcement';
  return 'Other';
}
