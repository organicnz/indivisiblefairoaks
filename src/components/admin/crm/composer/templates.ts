import type { ComposerTemplate } from './types';

export const CAMPAIGN_TEMPLATES: ComposerTemplate[] = [
  {
    id: 'rally-mobilization',
    name: 'Rally & Mobilization Alert',
    description: 'Rally announcement with event details, speaker lineup, and RSVP button.',
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
        id: 'tmpl_1_div',
        type: 'divider',
      },
      {
        id: 'tmpl_1_txt2',
        type: 'text',
        content:
          'Please bring signs, water, and comfortable shoes. The Resistance Choir will perform at 11:30 AM!\n\nCan’t make it in person? Share this alert with friends in our district.',
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
    description: 'Monthly chapter recap, choir rehearsals, and upcoming events.',
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
        id: 'tmpl_3_txt1',
        type: 'text',
        content:
          'Hello {{first_name}},\n\nOver the past month, our chapter has knocked on over 400 doors, registered 65 new voters in Sacramento County, and held two spirited community demonstrations.\n\nHere are three upcoming opportunities to connect and organize with us:',
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
        id: 'tmpl_4_callout',
        type: 'callout',
        variant: 'success',
        title: '$2,500 Match Challenge Active Until Sunday',
        text: 'A generous local donor has offered to match every dollar contributed up to $2,500! That means your $25 becomes $50 for local organizing.',
      },
      {
        id: 'tmpl_4_txt1',
        type: 'text',
        content:
          'Where every dollar goes:\n• $15 pays for 50 nonpartisan voter guides\n• $35 funds a phone bank shift with outreach software\n• $75 covers park permit and sound equipment for our rallies\n\nWe accept zero corporate PAC money — our independence is powered entirely by grassroots contributions from neighbors like you.',
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
];
