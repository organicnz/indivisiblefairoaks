/**
 * The voter data-point keys `/voter-info` actually renders.
 *
 * The page used to read the whole `voter` group, which also carries the 20
 * keys of the 2026 guide block that moved to `/archive`. Those keys were
 * serialized into the page's RSC payload on every visit even though nothing
 * rendered them. The page now asks for this list instead.
 *
 * The list is exhaustive for the evergreen page: hero, action cards,
 * representative finder, rights guides and hotlines. The archived 2026 keys
 * are deliberately absent; `/archive` still reads the whole group. A key that
 * is added to one of these components has to be added here too, or its CMS
 * copy would silently fall back to the JSX default — the unit test beside this
 * module scans the components and fails when that happens.
 */
export const VOTER_INFO_ARCHIVED_2026_PREFIXES = [
  'voter.guides.',
  'voter.guide.',
  'voter.spotlight.',
] as const;

/**
 * The 20 data points the 2026 archive block renders on `/archive`.
 *
 * `/archive` used to call `getDataPoints('voter')`, which read the entire
 * voter group — the 56 evergreen keys that `/voter-info` renders plus these
 * 20 — and serialized all of it into the archive page's RSC payload. Only the
 * 2026 block uses voter copy there, so the page asks Supabase for exactly this
 * list instead. The unit test beside this module scans `VoterGuidesSection`
 * and fails if a new archived key is rendered without being added here.
 */
export const VOTER_ARCHIVE_2026_DATA_POINT_KEYS = [
  'voter.guides.badge',
  'voter.guides.headline',
  'voter.guides.subhead',
  'voter.guide.sac_voter_guide.title',
  'voter.guide.sac_voter_guide.desc',
  'voter.guide.sac_voter_guide.btn',
  'voter.guide.ballot_recs.title',
  'voter.guide.ballot_recs.desc',
  'voter.guide.ballot_recs.btn',
  'voter.guide.candidate_brief.title',
  'voter.guide.candidate_brief.desc',
  'voter.guide.candidate_brief.btn',
  'voter.guide.voter_doc.title',
  'voter.guide.voter_doc.desc',
  'voter.guide.voter_doc.btn',
  'voter.spotlight.badge',
  'voter.spotlight.title',
  'voter.spotlight.desc',
  'voter.spotlight.author',
  'voter.spotlight.link',
] as const;

export const VOTER_INFO_DATA_POINT_KEYS = [
  'voter.action.elections_desc',
  'voter.action.elections_title',
  'voter.action.register_desc',
  'voter.action.register_title',
  'voter.action.track_desc',
  'voter.action.track_title',
  'voter.guide1.btn',
  'voter.guide1.desc',
  'voter.guide1.title',
  'voter.guide2.btn',
  'voter.guide2.desc',
  'voter.guide2.title',
  'voter.guide3.btn',
  'voter.guide3.desc',
  'voter.guide3.title',
  'voter.guide4.btn',
  'voter.guide4.desc',
  'voter.guide4.title',
  'voter.guides_section.title',
  'voter.hero.eyebrow',
  'voter.hero.intro',
  'voter.hero.title',
  'voter.hotlines.asian_languages',
  'voter.hotlines.english',
  'voter.hotlines.headline',
  'voter.hotlines.national_desc',
  'voter.hotlines.national_title',
  'voter.hotlines.office_address',
  'voter.hotlines.office_email',
  'voter.hotlines.office_phone',
  'voter.hotlines.office_title',
  'voter.hotlines.office_tollfree',
  'voter.hotlines.spanish',
  'voter.hotlines.subhead',
  'voter.repfinder.btn_lookup',
  'voter.repfinder.call_action_label',
  'voter.repfinder.call_script_heading',
  'voter.repfinder.copied_btn',
  'voter.repfinder.copy_btn',
  'voter.repfinder.eyebrow',
  'voter.repfinder.headline',
  'voter.repfinder.input_label',
  'voter.repfinder.input_placeholder',
  'voter.repfinder.party_dem',
  'voter.repfinder.party_nonpartisan',
  'voter.repfinder.party_rep',
  'voter.repfinder.script_democracy',
  'voter.repfinder.script_environment',
  'voter.repfinder.script_voting',
  'voter.repfinder.selected_community',
  'voter.repfinder.subhead',
  'voter.repfinder.tab_climate',
  'voter.repfinder.tab_democracy',
  'voter.repfinder.tab_voting',
  'voter.repfinder.tip_text',
  'voter.repfinder.what_to_say',
] as const;
