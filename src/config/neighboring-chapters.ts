export interface NeighboringChapter {
  name: string;
  area: string;
  description: string;
  href: string;
  linkLabel: string;
  sourceLabel: string;
  checkedOn: string;
  newsletterStatus: string;
}

/**
 * Neighboring chapter links are deliberately data, not prose in the page.
 *
 * This entry is the public Indivisible.org event listing for Indivisible Citrus
 * Heights. The listing notes that it is hosted by a local group and is not
 * vetted by Indivisible National. It is an event surface, not a newsletter
 * archive, so the card labels that distinction instead of implying a newsletter
 * exists.
 */
export const NEIGHBORING_CHAPTERS: readonly NeighboringChapter[] = [
  {
    name: 'Indivisible Citrus Heights',
    area: 'Citrus Heights',
    description:
      'A Sunday postcard-writing gathering at DarkHeart Brewing, where neighbors write postcards, meet candidates, and learn from guest speakers.',
    href: 'https://indivisible.org/events/indivisible-citrus-heights/',
    linkLabel: 'View their event listing',
    sourceLabel: 'Indivisible.org event listing',
    checkedOn: 'Nov 15, 2026',
    newsletterStatus: 'No public newsletter archive listed',
  },
];
