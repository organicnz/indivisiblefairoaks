import type { IceSourceReport } from './ice-crawl-types';
import type { IceSourceReportFilters } from './ice-source-report-search';

export type IceSourceReportExportMeta = {
  generatedAt: string;
  filters: IceSourceReportFilters;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function optionalXml(tag: string, value: string | null) {
  return value === null ? `    <${tag} />` : `    <${tag}>${escapeXml(value)}</${tag}>`;
}

/**
 * Export the same public projection shown in the archive. Source attribution,
 * publication time, and retrieval time are always retained; no private crawl
 * pages, raw HTML, or credentials enter the document.
 */
export function serializeIceSourceReportsXml(
  reports: readonly IceSourceReport[],
  meta: IceSourceReportExportMeta
) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<ice_source_reports generated_at="${escapeXml(meta.generatedAt)}" total="${reports.length}">`,
    '  <notice>Each report keeps its original source URL, source label, publication time, and retrieval time. Source text is not independently verified by Indivisible Fair Oaks-Carmichael. Do not use this data to identify, locate, or harass any person.</notice>',
  ];

  if (meta.filters.query) {
    lines.push(`  <filter name="query">${escapeXml(meta.filters.query)}</filter>`);
  }
  if (meta.filters.kind !== 'all') {
    lines.push(`  <filter name="kind">${escapeXml(meta.filters.kind)}</filter>`);
  }
  if (meta.filters.stateCode) {
    lines.push(`  <filter name="state">${escapeXml(meta.filters.stateCode)}</filter>`);
  }
  if (meta.filters.city) {
    lines.push(`  <filter name="city">${escapeXml(meta.filters.city)}</filter>`);
  }

  for (const report of reports) {
    lines.push('  <report>');
    lines.push(`    <id>${escapeXml(report.id)}</id>`);
    lines.push(`    <source_name>${escapeXml(report.source_name)}</source_name>`);
    lines.push(`    <source_url>${escapeXml(report.source_url)}</source_url>`);
    lines.push(optionalXml('source_title', report.source_title));
    lines.push(optionalXml('source_published_at', report.source_published_at));
    lines.push(`    <source_retrieved_at>${escapeXml(report.source_retrieved_at)}</source_retrieved_at>`);
    lines.push(`    <title>${escapeXml(report.title)}</title>`);
    lines.push(`    <text_content>${escapeXml(report.text_content)}</text_content>`);
    lines.push(optionalXml('city', report.city));
    lines.push(optionalXml('state_code', report.state_code));
    lines.push(`    <kind>${escapeXml(report.kind)}</kind>`);
    lines.push(`    <extraction_method>${escapeXml(report.extraction_method)}</extraction_method>`);
    lines.push(`    <published_at>${escapeXml(report.published_at)}</published_at>`);
    lines.push('  </report>');
  }

  lines.push('</ice_source_reports>', '');
  return lines.join('\n');
}

export { escapeXml as escapeIceSourceReportXml };
