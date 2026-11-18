export interface LinkItem {
  slug?: string;
  name: string;
  category: string;
  url: string;
  description: string;
  badge?: string;
}

export const LINKS_DATA: LinkItem[] = [
  {
    name: 'Indivisible National',
    category: 'Movement Partners',
    url: 'https://indivisible.org',
    description:
      'The national movement to elect progressive leaders and rebuild our democracy. Guides, toolkits, and national call campaigns.',
    badge: 'National Hub',
  },
  // Sister Indivisible chapters, restored from the chapter's Google Sites Links
  // page (issue #150 — see migration 20261028120000, which mirrors these rows).
  {
    name: 'Indivisible Sacramento',
    category: 'Movement Partners',
    url: 'https://indivisiblesacramento.com',
    description: 'Neighboring Indivisible chapter organizing in Sacramento.',
  },
  {
    name: 'Indivisible Yolo',
    category: 'Movement Partners',
    url: 'https://www.indivisibleyolo.org',
    description: 'Neighboring Indivisible chapter organizing in Yolo County.',
  },
  {
    name: 'Indivisible Roseville',
    category: 'Movement Partners',
    url: 'https://www.indivisible-roseville-ca.org',
    description: 'Neighboring Indivisible chapter organizing in Roseville.',
  },
  {
    name: 'Indivisible El Dorado',
    category: 'Movement Partners',
    url: 'https://www.indivisibleeldorado.org',
    description: 'Neighboring Indivisible chapter organizing in El Dorado County.',
  },
  {
    name: 'Indivisible Elk Grove',
    category: 'Movement Partners',
    url: 'https://indivisibleegt.com',
    description: 'Neighboring Indivisible chapter organizing in Elk Grove.',
  },
  {
    name: '5 Calls',
    category: 'Civic Education',
    url: 'https://5calls.org',
    description: 'An easy way to call your elected officials with scripts for every issue.',
  },
  {
    name: 'NorCal Resist',
    category: 'Movement Partners',
    url: 'https://www.norcalresist.org',
    description:
      'Community members organizing for a better world through shared resources and support.',
  },
  {
    name: 'American River Democrats',
    category: 'Movement Partners',
    url: 'https://www.ardems.org',
    description: 'Community organization serving East Sacramento County communities.',
  },
  {
    name: 'Indivisible California State Network',
    category: 'Movement Partners',
    url: 'https://indivisibleca.org',
    description:
      'Coordinating Indivisible chapters across California for Sacramento legislative advocacy and statewide election protection.',
  },
  {
    name: 'Mobilize.us Indivisible Directory',
    category: 'Movement Partners',
    url: 'https://www.mobilize.us/indivisible/',
    description:
      'Find upcoming local meetings, rallies, text banks, and phone banks organized by Indivisible chapters across California.',
  },
  {
    name: 'California Online Voter Registration',
    category: 'Voter Resources',
    url: 'https://registertovote.ca.gov',
    description:
      'Register to vote online or update your address and party registration with the California Secretary of State.',
    badge: 'Official SOS',
  },
  {
    name: "Where's My Ballot? (BallotTrax)",
    category: 'Voter Resources',
    url: 'https://wheresmyballot.sos.ca.gov',
    description:
      'Track when your vote-by-mail ballot is printed, mailed, received, and counted by your county elections office.',
  },
  {
    name: 'Sacramento County Elections Division',
    category: 'Voter Resources',
    url: 'https://elections.saccounty.gov',
    description:
      'Official county portal for ballot drop-off locations, Vote Center hours, and official election results.',
  },
  {
    name: 'League of Women Voters of Sacramento County',
    category: 'Civic Education',
    url: 'https://www.lwvsacramento.org',
    description:
      'Trusted, nonpartisan in-depth analysis of statewide ballot propositions and local candidate debates.',
  },
  {
    name: 'ACLU of Northern California',
    category: 'Civic Education',
    url: 'https://www.aclunc.org',
    description:
      'Defending civil liberties, constitutional rights, and public protest protections across Northern California.',
  },
  {
    name: 'ActBlue Contribution Portal',
    category: 'Support',
    url: 'https://secure.actblue.com/donate/indivisiblefoc1432155925',
    description:
      'Direct contribution portal to support Indivisible Fair Oaks-Carmichael grassroots organizing.',
    badge: 'Support Our Work',
  },
];
