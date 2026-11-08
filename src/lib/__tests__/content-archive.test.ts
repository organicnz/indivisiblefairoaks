// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_CANDIDATE_SLUGS,
  ARCHIVE_REVIEW_SLUGS,
  archiveDisposition,
  groupArchiveRows,
} from '@/lib/content-archive';

describe('content archive disposition', () => {
  it('classifies exactly the 14 unreachable rows, with no overlap', () => {
    const all = [...ARCHIVE_CANDIDATE_SLUGS, ...ARCHIVE_REVIEW_SLUGS];
    expect(all).toHaveLength(14);
    expect(new Set(all).size).toBe(14);
    expect(ARCHIVE_CANDIDATE_SLUGS).toHaveLength(8);
    expect(ARCHIVE_REVIEW_SLUGS).toHaveLength(6);
  });

  it('marks every review row as review and every candidate as candidate', () => {
    for (const slug of ARCHIVE_REVIEW_SLUGS) {
      expect(archiveDisposition(slug)).toBe('review');
    }
    for (const slug of ARCHIVE_CANDIDATE_SLUGS) {
      expect(archiveDisposition(slug)).toBe('candidate');
    }
  });

  it('leaves a new unreachable row unknown until a person reviews it', () => {
    expect(archiveDisposition('copy-home-hero')).toBe('unknown');
    expect(archiveDisposition('a-new-old-page')).toBe('unknown');
  });

  it('groups rows without dropping or changing them', () => {
    const rows = [
      { id: 1, slug: 'home', title: 'Home', type: 'page' },
      { id: 3, slug: 'upcoming-events', title: 'Events', type: 'event' },
      { id: 15, slug: 'new-import', title: 'New import', type: 'page' },
    ];
    const plan = groupArchiveRows(rows);
    expect(plan.review.map((row) => row.id)).toEqual([1]);
    expect(plan.candidates.map((row) => row.id)).toEqual([3]);
    expect(plan.unknown.map((row) => row.id)).toEqual([15]);
  });
});
