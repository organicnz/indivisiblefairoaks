/**
 * Data-point groups are stored under the plural table name (`links`, `faqs`,
 * `partners`), while keys use the singular prefix (`link.`, `faq.`, `partner.`).
 * Both the reader and every writer must normalize through this function or a
 * save lands in a group the reader never queries.
 */
const GROUP_ALIASES: Record<string, string> = {
  link: 'links',
  faq: 'faqs',
  partner: 'partners',
  term: 'terms',
};

/** Normalize a key (`partner.acme.name`) or a group name (`partner`). */
export function dataPointGroup(keyOrGroup: string): string {
  const first = keyOrGroup.split('.')[0]?.trim().toLowerCase();
  if (!first) return 'general';
  return GROUP_ALIASES[first] ?? first;
}
