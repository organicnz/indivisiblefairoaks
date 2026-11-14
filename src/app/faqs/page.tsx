import { HelpCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';
import { siteUrl } from '@/config/site';
import { pageMetadata } from '@/lib/metadata';
import { type FAQRow, getDataPoints, getFaqs } from '@/lib/queries/civic';
import { serializeJsonLd } from '@/lib/utils';

export const metadata: Metadata = pageMetadata({
  title: 'Frequently Asked Questions',
  description:
    'Answers to common questions about Indivisible Fair Oaks-Carmichael meetings, the Resistance Choir, voter outreach, and getting involved.',
  path: '/faqs',
});

interface FAQGroup {
  category: string;
  questions: { q: string; a: string; slug: string }[];
}

const FALLBACK_FAQS: FAQGroup[] = [
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

function groupFaqRows(rows: FAQRow[]): FAQGroup[] {
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

export default async function FAQPage() {
  const [dbRows, dataPoints] = await Promise.all([
    getFaqs().catch(() => []),
    getDataPoints('faqs'),
  ]);
  const faqs: FAQGroup[] = dbRows.length > 0 ? groupFaqRows(dbRows) : FALLBACK_FAQS;

  const effectiveQuestion = (item: { q: string; slug: string }) =>
    dataPoints[`faq.${item.slug}.question`]?.trim() || item.q;
  const effectiveAnswer = (item: { a: string; slug: string }) =>
    dataPoints[`faq.${item.slug}.answer`]?.trim() || item.a;

  /*
   * FAQPage structured data.
   * Emitted from the SAME data array the page renders directly from the Supabase DB.
   */
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl('/faqs')}#faq`,
    mainEntity: faqs.flatMap((group) =>
      group.questions.map((item) => ({
        '@type': 'Question',
        name: effectiveQuestion(item),
        acceptedAnswer: { '@type': 'Answer', text: effectiveAnswer(item) },
      }))
    ),
  };

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      {/* JSON-LD. biome's noDangerouslySetInnerHtml is suppressed for this file
          (see biome.json); the value is escaped by serializeJsonLd, which handles
          <, >, & and the JS line separators so it cannot break out of the tag. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
      />

      <PageMasthead
        icon={HelpCircle}
        eyebrow={
          <DataPoint initialData={dataPoints} name="faqs.hero.eyebrow">
            Frequently Asked Questions
          </DataPoint>
        }
        title={
          <DataPoint
            initialData={dataPoints}
            name="faqs.hero.headline"
            as="h1"
            className={MASTHEAD_TITLE}
          >
            Frequently Asked Questions
          </DataPoint>
        }
        intro={
          <DataPoint
            initialData={dataPoints}
            name="faqs.hero.intro"
            as="p"
            className={MASTHEAD_INTRO}
          >
            Have questions about attending a meeting, singing with the choir, or getting involved?
            Find quick answers below.
          </DataPoint>
        }
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-12">
          {faqs.map((group) => {
            const categoryId = `faq-category-${group.category
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')}`;
            return (
              <section key={group.category} aria-labelledby={categoryId}>
                <h2
                  id={categoryId}
                  className="mb-6 flex items-center gap-3 font-display text-2xl font-semibold tracking-[-0.03em]"
                >
                  <span>{group.category}</span>
                  <div className="h-px bg-border dark:bg-white/5 flex-1" />
                </h2>
                <div className="space-y-4">
                  {group.questions.map((faq) => (
                    <div
                      key={faq.q}
                      className="space-y-2 border-t border-border py-4"
                    >
                      <DataPoint
                        initialData={dataPoints}
                        as="h3"
                        name={`faq.${faq.slug}.question`}
                        className="text-base sm:text-lg font-bold text-foreground dark:text-white"
                      >
                        {faq.q}
                      </DataPoint>
                      <DataPoint
                        initialData={dataPoints}
                        as="p"
                        name={`faq.${faq.slug}.answer`}
                        className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed"
                      >
                        {faq.a}
                      </DataPoint>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-16 space-y-4 border-y border-border bg-surface-card p-8 text-center">
          <DataPoint
            initialData={dataPoints}
            name="faqs.still_have_questions"
            as="h3"
            className="font-display text-2xl font-semibold tracking-[-0.03em]"
          >
            Still have a question?
          </DataPoint>
          <DataPoint
            initialData={dataPoints}
            name="faqs.still_have_questions_sub"
            as="p"
            className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark max-w-md mx-auto"
          >
            Our volunteer organizing committee is always here to help you get connected.
          </DataPoint>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center border border-primary bg-primary px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2"
          >
            <DataPoint initialData={dataPoints} as="span" name="faqs.contact_button">
              Contact Us Directly
            </DataPoint>
          </Link>
        </div>
      </div>
    </div>
  );
}
