import type { FAQRow } from '@/lib/queries/civic';

export interface FAQGroup {
  category: string;
  questions: { q: string; a: string; slug: string }[];
}

export const FALLBACK_FAQS: FAQGroup[] = [
  {
    category: 'About Our Chapter',
    questions: [
      {
        slug: 'about-indivisible-fairoaks',
        q: 'What is Indivisible Fair Oaks-Carmichael?',
        a: 'We are a grassroots community organization in Sacramento County, California, affiliated with the national Indivisible movement. We are dedicated to defending democracy, protecting voting rights, promoting social and climate justice, and holding our elected officials accountable.',
      },
      {
        slug: 'meeting-location-time',
        q: 'When and where are the regular chapter meetings held?',
        a: "We gather on the first Tuesday of every month from 6:30 PM to 8:00 PM at St. Michael's Episcopal Church, 2140 Mission Avenue, Carmichael, CA 95608. Hybrid Zoom options are also provided for members participating remotely.",
      },
      {
        slug: 'residency-requirements',
        q: 'Do I have to live in Fair Oaks or Carmichael to join?',
        a: 'Not at all! We welcome neighbors from Citrus Heights, Orangevale, Arden-Arcade, Rancho Cordova, Sacramento, and surrounding communities across California Congressional Districts CA-06 and CA-03.',
      },
    ],
  },
  {
    category: 'Carmichael Resistance Choir',
    questions: [
      {
        slug: 'choir-audition',
        q: 'Do I need to audition to join the Resistance Choir?',
        a: 'No audition is required! All voices, experience levels, and musical backgrounds are warmly welcomed. Rehearsals are held every other Wednesday evening from 6:30 PM to 8:00 PM.',
      },
      {
        slug: 'choir-performance-locations',
        q: 'Where does the choir perform?',
        a: 'We sing at peaceful street corner demonstrations (such as the intersection of Fair Oaks Blvd & Manzanita Ave), civic rallies, Sacramento Capitol events, and our monthly community gatherings.',
      },
    ],
  },
  {
    category: 'Voter Action & Contributions',
    questions: [
      {
        slug: 'contributions-tax-deductible',
        q: 'Are contributions to Indivisible Fair Oaks tax-deductible?',
        a: 'No. Contributions made through our ActBlue portal are dedicated to grassroots civic advocacy and political mobilization, and are therefore not tax-deductible as charitable gifts. 100% of donations fund meeting hall rentals, rally signs, and voter contact materials.',
      },
      {
        slug: 'postcard-writing-outreach',
        q: 'How can I participate in postcard writing for voter turnout?',
        a: 'We supply pre-printed postcards, verified voter addresses, and proven scripts for swing districts. Visit our Events page or email contact@indivisiblefairoaks.org to join our monthly postcarding blitzes.',
      },
    ],
  },
];

export function groupFaqRows(rows: FAQRow[]): FAQGroup[] {
  const map = new Map<string, { q: string; a: string; slug: string }[]>();
  for (const row of rows) {
    const list = map.get(row.category) || [];
    list.push({ q: row.question, a: row.answer, slug: row.slug });
    map.set(row.category, list);
  }
  return Array.from(map.entries()).map(([category, questions]) => ({
    category,
    questions,
  }));
}
