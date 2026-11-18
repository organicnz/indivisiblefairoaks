import {
  getIceCrawlStore,
  getPublishedSourceReportCount,
  getPublishedSourceReports,
} from '@/lib/ice-crawl-store';
import type { IceSourceReport } from '@/lib/ice-crawl-types';
import type { IceSourceReportFilters } from '@/lib/ice-source-report-search';

export const PER_PAGE = 20;

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function readPage(params: Record<string, string | string[] | undefined>) {
  const raw = params.page;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function readArchive(page: number, filters: IceSourceReportFilters) {
  const store = getIceCrawlStore();
  if (!store) return { reports: [] as IceSourceReport[], total: 0, totalPages: 1, current: 1 };
  try {
    const total = await getPublishedSourceReportCount(store, filters);
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    const current = Math.min(page, totalPages);
    const reports = await getPublishedSourceReports(
      store,
      PER_PAGE,
      (current - 1) * PER_PAGE,
      filters
    );
    return { reports, total, totalPages, current };
  } catch {
    return { reports: [] as IceSourceReport[], total: 0, totalPages: 1, current: 1 };
  }
}

