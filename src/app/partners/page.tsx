import { ExternalLink, Handshake } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  alternates: { canonical: '/partners' },
  title: 'Coalition Partners & Allies | Indivisible Fair Oaks-Carmichael',
  description:
    'Meet the national and California grassroots partners, voting rights organizations, and local coalitions working alongside Indivisible Fair Oaks-Carmichael.',
  openGraph: {
    title: 'Coalition Partners & Allies | Indivisible Fair Oaks-Carmichael',
    description:
      'Meet the national and California grassroots partners, voting rights organizations, and local coalitions working alongside Indivisible Fair Oaks-Carmichael.',
    url: 'https://indivisiblefairoaks.org/partners',
    siteName: 'Indivisible Fair Oaks-Carmichael',
    locale: 'en_US',
    type: 'website',
  },
};

export default function PartnersPage() {
  const partners = [
    {
      name: 'National Indivisible Project',
      category: 'National Movement',
      description:
        'A grassroots movement of thousands of local chapters with a shared vision of a democracy by the people, of the people, and for all people.',
      url: 'https://indivisible.org',
    },
    {
      name: 'Indivisible California StateStrong',
      category: 'Statewide Coalition',
      description:
        'Connecting dozens of local Indivisible chapters across California to coordinate legislative advocacy in Sacramento and champion state-level progressive policy.',
      url: 'https://indivisibleca.org',
    },
    {
      name: 'Sister District Sacramento',
      category: 'Electoral Partner',
      description:
        'Mobilizing volunteers to build lasting progressive power in state legislatures across the country by supporting critical swing-district candidates.',
      url: 'https://sisterdistrict.com',
    },
    {
      name: '5 Calls: Make Your Voice Heard',
      category: 'Civic Tech Partner',
      description:
        'The most effective, fast way for everyday citizens to call their elected officials about crucial democracy, healthcare, and civil rights bills.',
      url: 'https://5calls.org',
    },
    {
      name: 'League of Women Voters Sacramento County',
      category: 'Voting Rights & Nonpartisan Guides',
      description:
        'Empowering voters and defending democracy through nonpartisan ballot analysis, candidate forums, and local high school voter registration drives.',
      url: 'https://my.lwv.org/california/sacramento-county',
    },
    {
      name: 'ACLU of Northern California',
      category: 'Civil Liberties & Legal Defense',
      description:
        'Guarding the constitutional rights of all Californians through strategic litigation, community education, and policy reform.',
      url: 'https://www.aclunc.org',
    },
  ];

  return (
    <main className="bg-slate-950 text-white pt-24 pb-20 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Handshake size={14} className="text-amber-400" />
            <span>Grassroots Solidarity</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Our Coalition Partners & Allies
          </h1>
          <div className="h-1.5 w-24 bg-amber-400 rounded-full mb-4" />
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
            We believe democracy is a team sport. Indivisible Fair Oaks-Carmichael works in close
            partnership with national organizations, California coalitions, and Sacramento community
            advocates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <span className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
                  {partner.category}
                </span>
                <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                  {partner.name}
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">{partner.description}</p>
              </div>

              <div className="pt-6 border-t border-slate-800/80">
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <span>Visit Partner Website</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <h3 className="text-xl font-bold text-white">Looking to Partner with Our Chapter?</h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
            If your organization shares our dedication to civil rights, progressive governance, and
            democratic defense, we’d love to collaborate on upcoming actions.
          </p>
          <Link
            href="/contact"
            className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all"
          >
            Connect With Our Coalition Team
          </Link>
        </div>
      </div>
    </main>
  );
}
