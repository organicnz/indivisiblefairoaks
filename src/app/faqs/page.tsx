import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  alternates: { canonical: '/faqs' },
  title: 'Frequently Asked Questions | Indivisible Fair Oaks-Carmichael',
  description:
    'Answers to common questions about Indivisible Fair Oaks-Carmichael meetings, the Resistance Choir, voter outreach, and getting involved.',
  openGraph: {
    title: 'Frequently Asked Questions | Indivisible Fair Oaks-Carmichael',
    description:
      'Answers to common questions about Indivisible Fair Oaks-Carmichael meetings, the Resistance Choir, voter outreach, and getting involved.',
    url: 'https://indivisiblefairoaks.org/faqs',
    siteName: 'Indivisible Fair Oaks-Carmichael',
    locale: 'en_US',
    type: 'website',
  },
};

export default function FAQPage() {
  const faqs = [
    {
      category: 'About Our Chapter',
      questions: [
        {
          q: 'What is Indivisible Fair Oaks-Carmichael?',
          a: 'We are a grassroots community organization in Sacramento County, California, affiliated with the national Indivisible movement. We are dedicated to defending democracy, protecting voting rights, promoting social and climate justice, and holding our elected officials accountable.',
        },
        {
          q: 'When and where are the regular chapter meetings held?',
          a: "We gather on the first Tuesday of every month from 6:30 PM to 8:00 PM at St. Michael's Episcopal Church, 2140 Mission Avenue, Carmichael, CA 95608. Hybrid Zoom options are also provided for members participating remotely.",
        },
        {
          q: 'Do I have to live in Fair Oaks or Carmichael to join?',
          a: 'Not at all! We welcome neighbors from Citrus Heights, Orangevale, Arden-Arcade, Rancho Cordova, Sacramento, and surrounding communities across California Congressional Districts CA-06 and CA-03.',
        },
      ],
    },
    {
      category: 'Carmichael Resistance Choir',
      questions: [
        {
          q: 'Do I need to audition to join the Resistance Choir?',
          a: 'No audition is required! All voices, experience levels, and musical backgrounds are warmly welcomed. Rehearsals are held every other Wednesday evening from 6:30 PM to 8:00 PM.',
        },
        {
          q: 'Where does the choir perform?',
          a: 'We sing at peaceful street corner demonstrations (such as the intersection of Fair Oaks Blvd & Manzanita Ave), civic rallies, Sacramento Capitol events, and our monthly community gatherings.',
        },
      ],
    },
    {
      category: 'Voter Action & Contributions',
      questions: [
        {
          q: 'Are contributions to Indivisible Fair Oaks tax-deductible?',
          a: 'No. Contributions made through our ActBlue portal are dedicated to grassroots civic advocacy and political mobilization, and are therefore not tax-deductible as charitable gifts. 100% of donations fund meeting hall rentals, rally signs, and voter contact materials.',
        },
        {
          q: 'How can I participate in postcard writing for voter turnout?',
          a: 'We supply pre-printed postcards, verified voter addresses, and proven scripts for swing districts. Visit our Events page or email contact@indivisiblefairoaks.org to join our monthly postcarding blitzes.',
        },
      ],
    },
  ];

  return (
    <div className="bg-slate-950 text-white pt-24 pb-20 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col items-center text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
            <span>Frequently Asked Questions</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Frequently Asked Questions
          </h1>
          <div className="h-1.5 w-24 bg-amber-400 rounded-full mb-4" />
          <p className="text-slate-300 text-sm sm:text-base max-w-xl">
            Have questions about attending a meeting, singing with the choir, or getting involved?
            Find quick answers below.
          </p>
        </div>

        <div className="space-y-12">
          {faqs.map((group) => {
            const categoryId = `faq-category-${group.category
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')}`;
            return (
              <section key={group.category} aria-labelledby={categoryId}>
                <h2
                  id={categoryId}
                  className="text-xl font-bold text-amber-400 uppercase tracking-wider mb-6 flex items-center gap-3"
                >
                  <span>{group.category}</span>
                  <div className="h-px bg-slate-800 flex-1" />
                </h2>
                <div className="space-y-4">
                  {group.questions.map((faq) => (
                    <div
                      key={faq.q}
                      className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                    >
                      <h3 className="text-base sm:text-lg font-bold text-white">{faq.q}</h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-16 text-center p-8 rounded-3xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-blue-500/30 space-y-4">
          <h3 className="text-xl font-black text-white">Still have a question?</h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
            Our volunteer organizing committee is always here to help you get connected.
          </p>
          <Link
            href="/contact"
            className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all"
          >
            Contact Us Directly
          </Link>
        </div>
      </div>
    </div>
  );
}
