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
  city: string | null;
  state_code: string | null;
  kind: IceSourceReportKind;
  extraction_method: IceSourceExtractionMethod;
  published_at: string;
};

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
