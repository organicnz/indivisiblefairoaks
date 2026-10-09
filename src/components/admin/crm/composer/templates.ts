import type { ComposerTemplate } from './types';

export const CAMPAIGN_TEMPLATES: ComposerTemplate[] = [
  {
    id: 'rally-mobilization',
    name: 'Rally & Mobilization Alert',
    description:
      'Rally announcement with banner image, event details, RSVP button, and social channels.',
    badge: 'Mobilization',
    subject: '🚨 URGENT: Fair Oaks Community Rally for Democracy This Saturday',
    blocks: [
      {
        id: 'tmpl_1_hdr',
        type: 'header',
        eyebrow: 'COMMUNITY MOBILIZATION',
        heading: 'Stand Up for Democracy: Saturday Rally in Carmichael',
        level: 1,
      },
      {
        id: 'tmpl_1_img',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80',
        alt: 'Grassroots democracy demonstration with banners',
        caption: 'Join over 200 Fair Oaks and Carmichael neighbors this weekend.',
        linkUrl: 'https://indivisiblefairoaks.org/actions',
        alignment: 'center',
      },
      {
        id: 'tmpl_1_txt1',
        type: 'text',
        content:
          'Dear Neighbor,\n\nOur democracy is under urgent threat, and grassroots action is our strongest defense. Join fellow activists, organizers, and families across CA-06 as we gather peacefully to demand accountability and protect our civic institutions.',
      },
      {
        id: 'tmpl_1_evt',
        type: 'event',
        title: 'Emergency Fair Oaks Rally for Democracy',
        date: 'This Saturday, Oct 14',
        time: '10:00 AM – 12:30 PM PST',
        location: 'Carmichael Park Main Pavilion, 5750 Grant Ave, Carmichael, CA',
        rsvpUrl: 'https://indivisiblefairoaks.org/actions',
      },
      {
        id: 'tmpl_1_btn',
        type: 'button',
        label: 'RSVP to Rally & Bring 2 Neighbors',
        url: 'https://indivisiblefairoaks.org/actions',
        variant: 'primary',
      },
      {
        id: 'tmpl_1_quote',
        type: 'quote',
        quote:
          'When neighbors organize block by block, we create lasting change that no political machine can ignore.',
        author: 'Elena Rostova',
        role: 'Carmichael Precinct Captain',
      },
      {
        id: 'tmpl_1_social',
        type: 'social',
        heading: 'Spread the Word',
        channels: [
          { platform: 'website', url: 'https://indivisiblefairoaks.org', label: 'Chapter Website' },
          {
            platform: 'actblue',
            url: 'https://indivisiblefairoaks.org/donate',
            label: 'Support the Rally',
          },
        ],
      },
      {
        id: 'tmpl_1_sign',
        type: 'signoff',
        closing: 'In solidarity,',
        sender: 'Indivisible Fair Oaks-Carmichael Organizing Steering Committee',
      },
    ],
  },
  {
    id: 'legislative-action-alert',
    name: 'Legislative Action Alert',
    description: 'Call-in campaign with script and phone numbers to contact representatives.',
    badge: 'Action Alert',
    subject: 'ACTION NEEDED: Call Rep. Bera today to protect voting rights',
    blocks: [
      {
        id: 'tmpl_2_hdr',
        type: 'header',
        eyebrow: 'CRITICAL LEGISLATIVE PUSH',
        heading: '2-Minute Phone Call: Tell Congress to Vote YES on Voting Rights',
        level: 1,
      },
      {
        id: 'tmpl_2_callout',
        type: 'callout',
        variant: 'alert',
        title: 'Vote Scheduled for Thursday Morning',
        text: 'The Senate rules reform vote is taking place this week. A flood of constituent calls today will determine the outcome.',
      },
      {
        id: 'tmpl_2_txt1',
        type: 'text',
        content:
          'Here is your 60-second calling script:\n\n"Hello, my name is {{first_name}} and I am a registered constituent living in district {{district}}. I am calling to urge the Representative to vote YES on the Democracy Defense Act. Our community needs strong federal voting rights protections now."\n\n• Rep. Ami Bera (CA-06): (916) 635-0505\n• Sen. Laphonza Butler: (202) 224-3841\n• Sen. Alex Padilla: (202) 224-3553',
      },
      {
        id: 'tmpl_2_btn',
        type: 'button',
        label: 'Log Your Call & Report Result',
        url: 'https://indivisiblefairoaks.org/contact',
        variant: 'accent',
      },
      {
        id: 'tmpl_2_sign',
        type: 'signoff',
        closing: 'With gratitude for your voice,',
        sender: 'Legislative Action Working Group · Indivisible Fair Oaks',
      },
    ],
  },
  {
    id: 'monthly-newsletter',
    name: 'Grassroots Monthly Newsletter',
    description: 'Monthly chapter recap, stats breakdown, choir rehearsals, and upcoming events.',
    badge: 'Newsletter',
    subject: 'Indivisible Fair Oaks: Monthly Wins, Choir Dates & Upcoming Events',
    blocks: [
      {
        id: 'tmpl_3_hdr',
        type: 'header',
        eyebrow: 'MONTHLY DISPATCH',
        heading: 'Fair Oaks Resistance Roundup: Our October Momentum',
        level: 1,
      },
      {
        id: 'tmpl_3_stat',
        type: 'stat',
        value: '1,420 Voters',
        label: 'Directly Contacted in October',
        description: 'Through phone banking, postcarding, and park pop-ups across CA-06.',
        variant: 'primary',
      },
      {
        id: 'tmpl_3_txt1',
        type: 'text',
        content:
          'Hello {{first_name}},\n\nOver the past month, our chapter has knocked on over 400 doors, registered 65 new voters in Sacramento County, and held two spirited community demonstrations.\n\nHere are three upcoming opportunities to connect and organize with us:',
      },
      {
        id: 'tmpl_3_list',
        type: 'list',
        style: 'bullet',
        items: [
          'Resistance Choir weekly rehearsals every Wednesday at 6:30 PM',
          'Postcarding party for swing districts this Sunday at Fair Oaks Library',
          'Voter registration training workshop on zoom next Tuesday',
        ],
      },
      {
        id: 'tmpl_3_evt',
        type: 'event',
        title: 'Resistance Choir Weekly Rehearsal',
        date: 'Every Wednesday Evening',
        time: '6:30 PM – 8:00 PM',
        location: 'Fair Oaks Community Clubhouse',
        rsvpUrl: 'https://indivisiblefairoaks.org/contact',
      },
      {
        id: 'tmpl_3_callout',
        type: 'callout',
        variant: 'info',
        title: 'Volunteer Spotlight',
        text: 'Special thanks to our postcarding brigade! Over 1,200 handwritten postcards to swing district voters were mailed this week alone.',
      },
      {
        id: 'tmpl_3_btn',
        type: 'button',
        label: 'View Full Calendar of Events',
        url: 'https://indivisiblefairoaks.org/events',
        variant: 'primary',
      },
      {
        id: 'tmpl_3_sign',
        type: 'signoff',
        closing: 'Together in the fight,',
        sender: 'The Indivisible Fair Oaks-Carmichael Team',
      },
    ],
  },
  {
    id: 'grassroots-fundraiser',
    name: 'Grassroots Matching Gift Drive',
    description: 'Fundraising push with matching donation challenge and impact breakdown.',
    badge: 'Fundraising',
    subject: 'Match Alert: Double your impact for local voter mobilization today',
    blocks: [
      {
        id: 'tmpl_4_hdr',
        type: 'header',
        eyebrow: 'DOLLAR-FOR-DOLLAR MATCH',
        heading: 'Help Fund Our CA-06 Voter Outreach Drive',
        level: 1,
      },
      {
        id: 'tmpl_4_stat',
        type: 'stat',
        value: '$2,500 Match',
        label: 'Doubling Every Community Contribution',
        description: 'Active through Sunday midnight.',
        variant: 'emerald',
      },
      {
        id: 'tmpl_4_callout',
        type: 'callout',
        variant: 'success',
        title: '$2,500 Match Challenge Active Until Sunday',
        text: 'A generous local donor has offered to match every dollar contributed up to $2,500! That means your $25 becomes $50 for local organizing.',
      },
      {
        id: 'tmpl_4_list',
        type: 'list',
        style: 'bullet',
        items: [
          '$15 pays for 50 nonpartisan voter guides',
          '$35 funds a phone bank shift with outreach software',
          '$75 covers park permit and sound equipment for our rallies',
        ],
      },
      {
        id: 'tmpl_4_btn',
        type: 'button',
        label: 'Contribute $15, $35 or $75 to Double It',
        url: 'https://indivisiblefairoaks.org/donate',
        variant: 'accent',
      },
      {
        id: 'tmpl_4_sign',
        type: 'signoff',
        closing: 'Thank you for standing with us,',
        sender: 'Finance & Operations Committee · Indivisible Fair Oaks',
      },
    ],
  },
  {
    id: 'volunteer-spotlight',
    name: 'Activist Spotlight & Volunteer Call',
    description: 'Personal activist story, quote block, impact metrics, and join CTA.',
    badge: 'Spotlight',
    subject: 'Why We Knock Doors in Fair Oaks — Meet Organizer Sarah',
    blocks: [
      {
        id: 'tmpl_5_hdr',
        type: 'header',
        eyebrow: 'GRASSROOTS VOICES',
        heading: 'From First-Time Voter to Precinct Captain: Sarah’s Story',
        level: 1,
      },
      {
        id: 'tmpl_5_quote',
        type: 'quote',
        quote:
          'I used to feel overwhelmed by the news. Joining Indivisible Fair Oaks gave me an outlet to channel that worry into real, tangible action right here in my neighborhood.',
        author: 'Sarah Jenkins',
        role: 'CA-06 Canvass Coordinator',
      },
      {
        id: 'tmpl_5_txt1',
        type: 'text',
        content:
          'Sarah started by attending one park rally last spring. Today, she leads our canvassing team across Carmichael and Fair Oaks.\n\nYou do not need years of political experience to make a difference. All you need is the willingness to listen to neighbors and share why local democracy matters.',
      },
      {
        id: 'tmpl_5_stat',
        type: 'stat',
        value: '350+ Volunteers',
        label: 'Active Across Sacramento County',
        description: 'Organizing canvasses, choir rehearsals, and phone banks every week.',
        variant: 'primary',
      },
      {
        id: 'tmpl_5_btn',
        type: 'button',
        label: 'Sign Up for a 2-Hour Volunteer Shift',
        url: 'https://indivisiblefairoaks.org/contact',
        variant: 'primary',
      },
      {
        id: 'tmpl_5_social',
        type: 'social',
        heading: 'Stay Connected',
        channels: [
          {
            platform: 'website',
            url: 'https://indivisiblefairoaks.org',
            label: 'Indivisible Fair Oaks',
          },
          { platform: 'actblue', url: 'https://indivisiblefairoaks.org/donate', label: 'Donate' },
        ],
      },
      {
        id: 'tmpl_5_sign',
        type: 'signoff',
        closing: 'In hope and determination,',
        sender: 'The Volunteer Coordination Team',
      },
    ],
  },
];
