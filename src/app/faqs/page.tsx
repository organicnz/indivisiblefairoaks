import type { Metadata } from 'next';
import { FaqContactCta } from '@/components/faqs/FaqContactCta';
import { FaqList } from '@/components/faqs/FaqList';
import { FaqsMasthead } from '@/components/faqs/FaqsMasthead';
import { FALLBACK_FAQS, type FAQGroup, groupFaqRows } from '@/components/faqs/faqs-data';
import { siteUrl } from '@/config/site';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints, getFaqs } from '@/lib/queries/civic';
import { serializeJsonLd } from '@/lib/utils';

export const metadata: Metadata = pageMetadata({
  title: 'Frequently Asked Questions',
  description:
    'Answers to common questions about Indivisible Fair Oaks-Carmichael meetings, the Resistance Choir, voter outreach, and getting involved.',
  path: '/faqs',
});

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

      <FaqsMasthead dataPoints={dataPoints} />

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <FaqList faqs={faqs} dataPoints={dataPoints} />
        <FaqContactCta dataPoints={dataPoints} />
      </div>
    </div>
  );
}
