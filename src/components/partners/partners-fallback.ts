export interface Partner {
  slug: string;
  name: string;
  category: string;
  description: string;
  url: string;
}

export const PARTNER_FALLBACK: Partner[] = [
    {
      slug: 'national-indivisible',
      name: 'National Indivisible Project',
      category: 'National Movement',
      description:
        'A grassroots movement of thousands of local chapters with a shared vision of a democracy by the people, of the people, and for all people.',
      url: 'https://indivisible.org',
    },
    {
      slug: 'indivisible-ca-statestrong',
      name: 'Indivisible California StateStrong',
      category: 'Statewide Coalition',
      description:
        'Connecting dozens of local Indivisible chapters across California to coordinate legislative advocacy in Sacramento and champion state-level progressive policy.',
      url: 'https://indivisibleca.org',
    },
    {
      slug: 'sister-district-sac',
      name: 'Sister District Sacramento',
      category: 'Electoral Partner',
      description:
        'Mobilizing volunteers to build lasting progressive power in state legislatures across the country by supporting critical swing-district candidates.',
      url: 'https://sisterdistrict.com',
    },
    {
      slug: '5calls',
      name: '5 Calls: Make Your Voice Heard',
      category: 'Civic Tech Partner',
      description:
        'The most effective, fast way for everyday citizens to call their elected officials about crucial democracy, healthcare, and civil rights bills.',
      url: 'https://5calls.org',
    },
    {
      slug: 'lwv-sacramento',
      name: 'League of Women Voters Sacramento County',
      category: 'Voting Rights & Nonpartisan Guides',
      description:
        'Empowering voters and defending democracy through nonpartisan ballot analysis, candidate forums, and local high school voter registration drives.',
      url: 'https://my.lwv.org/california/sacramento-county',
    },
    {
      slug: 'aclu-norcal',
      name: 'ACLU of Northern California',
      category: 'Civil Liberties & Legal Defense',
      description:
        'Guarding the constitutional rights of all Californians through strategic litigation, community education, and policy reform.',
      url: 'https://www.aclunc.org',
    },
];
