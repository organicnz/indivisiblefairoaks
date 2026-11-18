-- Seed the ICE rapid-response editorial copy now exposed through DataPoint.
-- DO NOTHING keeps any wording an editor has already saved; these rows only
-- make the first deploy match the fallback JSX exactly.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('ice.rapid.guide.eyebrow', 'ice', 'Rapid Guide Eyebrow', 'Rapid response, safely', 'text'),
  ('ice.rapid.guide.title', 'ice', 'Rapid Guide Title', 'If you see something, do this.', 'text'),
  ('ice.rapid.guide.intro', 'ice', 'Rapid Guide Introduction', 'A community alert should help neighbors make a safety decision, not become a surveillance log. Keep observations short, locations general, and identity out of the map.', 'text'),
  ('ice.rapid.guide.warning', 'ice', 'Rapid Guide Warning', 'Do not interfere with or obstruct enforcement activity.', 'text'),
  ('ice.rapid.guide.warning_detail', 'ice', 'Rapid Guide Warning Detail', 'You can carefully observe or film from a safe distance. Filming in public is generally protected, but safety comes first. This is not legal advice.', 'text'),
  ('ice.rapid.limits.eyebrow', 'ice', 'Rapid Guide Limits Eyebrow', 'Hard limits', 'text'),
  ('ice.rapid.limits.title', 'ice', 'Rapid Guide Limits Title', 'What this map will not do.', 'text'),
  ('ice.rapid.sources.eyebrow', 'ice', 'Rapid Guide Sources Eyebrow', 'Sources & freshness', 'text'),
  ('ice.rapid.sources.title', 'ice', 'Rapid Guide Sources Title', 'Every layer says where it came from.', 'text'),
  ('ice.rapid.channels.eyebrow', 'ice', 'Alert Channels Eyebrow', 'Alert channels', 'text'),
  ('ice.rapid.channels.title', 'ice', 'Alert Channels Title', 'Choose how you hear about a surge.', 'text'),
  ('ice.rapid.channels.intro', 'ice', 'Alert Channels Introduction', 'This chapter runs email and browser alerts. The national Stop ICE Alerts Network runs text and Signal alerts. They are separate services, so review their privacy and security terms before joining.', 'text'),
  ('ice.rapid.channels.email.title', 'ice', 'Email Alert Channel Title', 'Email + browser', 'text'),
  ('ice.rapid.channels.email.body', 'ice', 'Email Alert Channel Description', 'City-level surge alerts from this chapter, with email confirmation and one-click unsubscribe.', 'text'),
  ('ice.rapid.channels.text.title', 'ice', 'Text Alert Channel Title', 'Text alerts', 'text'),
  ('ice.rapid.channels.text.body', 'ice', 'Text Alert Channel Description', 'Receive national alerts by SMS, or report a sighting to the national network. Never send names, plates, or addresses.', 'text'),
  ('ice.rapid.channels.signal.title', 'ice', 'Signal Alert Channel Title', 'Signal alerts', 'text'),
  ('ice.rapid.channels.signal.body', 'ice', 'Signal Alert Channel Description', 'Find the nationwide or local read-only alert group run by Stop ICE. Review the network''s security notes before joining.', 'text'),
  ('ice.rapid.channels.footnote', 'ice', 'Alert Channels Footnote', 'The text and Signal links leave this site. Indivisible Fair Oaks-Carmichael does not operate or monitor those national channels and does not receive the messages you send there. This chapter accepts private reports only through its intake form. Raw reports are never published; a unique, low-risk report may publish only a generated city-level summary, and similar reports are combined.', 'text'),
  ('ice.reading.eyebrow', 'ice', 'Historical Map Reading Eyebrow', 'How to read this map', 'text'),
  ('ice.reading.title', 'ice', 'Historical Map Reading Title', 'A historical record, not a live alert.', 'text'),
  ('ice.reading.intro', 'ice', 'Historical Map Reading Introduction', 'Cluster numbers and circle sizes help show where large numbers of arrest records were assigned. They cannot tell you what is happening now, and this should not be treated as a live safety feed.', 'text')
ON CONFLICT (key) DO NOTHING;

-- Step-by-step rapid-response guidance.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('ice.rapid.steps.safe.title', 'ice', 'Rapid Step 1 Title', 'Stay back. Stay safe.', 'text'),
  ('ice.rapid.steps.safe.body', 'ice', 'Rapid Step 1 Body', 'Do not approach, confront, or obstruct enforcement activity. Move to a safe place before you do anything else.', 'text'),
  ('ice.rapid.steps.observe.title', 'ice', 'Rapid Step 2 Title', 'Observe from a distance.', 'text'),
  ('ice.rapid.steps.observe.body', 'ice', 'Rapid Step 2 Body', 'If it is safe, note the time, general location, and what you can see. You may carefully film from a distance; filming in public is generally protected by the First Amendment. Do not publish names, faces, plates, or immigration status.', 'text'),
  ('ice.rapid.steps.share.title', 'ice', 'Rapid Step 3 Title', 'Share and connect.', 'text'),
  ('ice.rapid.steps.share.body', 'ice', 'Rapid Step 3 Body', 'Use a trusted rapid-response network. Help people reach legal support and family. Do not use a sighting to identify, follow, or harass anyone.', 'text'),

  ('ice.rapid.resources.emergency.title', 'ice', 'Emergency Resource Title', 'Immediate danger', 'text'),
  ('ice.rapid.resources.emergency.body', 'ice', 'Emergency Resource Description', 'Call 911. This map cannot dispatch help or verify an emergency.', 'text'),
  ('ice.rapid.resources.emergency.label', 'ice', 'Emergency Resource Link Label', 'Call 911', 'text'),
  ('ice.rapid.resources.rights.title', 'ice', 'Know Your Rights Resource Title', 'Know your rights', 'text'),
  ('ice.rapid.resources.rights.body', 'ice', 'Know Your Rights Resource Description', 'The ACLU’s immigrant-rights guides cover encounters at home, work, and in public.', 'text'),
  ('ice.rapid.resources.rights.label', 'ice', 'Know Your Rights Resource Link Label', 'Open the ACLU guide', 'text'),
  ('ice.rapid.resources.locator.title', 'ice', 'Detention Locator Resource Title', 'Find someone in detention', 'text'),
  ('ice.rapid.resources.locator.body', 'ice', 'Detention Locator Resource Description', 'ICE’s Online Detainee Locator can search for an adult in custody by A-Number or name and country of birth.', 'text'),
  ('ice.rapid.resources.locator.label', 'ice', 'Detention Locator Resource Link Label', 'Open the locator', 'text'),
  ('ice.rapid.resources.report.title', 'ice', 'Report Resource Title', 'Report a sighting', 'text'),
  ('ice.rapid.resources.report.body', 'ice', 'Report Resource Description', 'Submit a private report. Raw text stays private; a unique, low-risk report may publish only a generated city-level summary, and similar reports are combined. Reports with safety flags or no verified city are held for review. Use the national network if you prefer. Never send names, plates, or addresses.', 'text'),
  ('ice.rapid.resources.report.label', 'ice', 'Report Resource Link Label', 'Start a private report', 'text'),

  ('ice.rapid.limits.item1', 'ice', 'Rapid Limit 1', 'No street addresses, number plates, names, faces, or immigration status.', 'text'),
  ('ice.rapid.limits.item2', 'ice', 'Rapid Limit 2', 'No claim that a community report is independently verified by this page.', 'text'),
  ('ice.rapid.limits.item3', 'ice', 'Rapid Limit 3', 'No live tracking of individual officers, vehicles, or people.', 'text'),
  ('ice.rapid.limits.item4', 'ice', 'Rapid Limit 4', 'No legal advice, dispatch, or guarantee that a report is current.', 'text'),

  ('ice.rapid.detention.title', 'ice', 'DetentionHelp Title', 'DetentionHelp', 'text'),
  ('ice.rapid.detention.body', 'ice', 'DetentionHelp Description', 'A free tool from immigrant-rights groups for people in ICE detention preparing a habeas petition, including people without a lawyer. It does not guarantee release.', 'text'),
  ('ice.rapid.detention.cta', 'ice', 'DetentionHelp Link Label', 'Open DetentionHelp', 'text'),
  ('ice.rapid.reunification.title', 'ice', 'Reunification Card Title', 'Family reunification request', 'text'),
  ('ice.rapid.reunification.body', 'ice', 'Reunification Card Description', 'A private, consent-based way to ask for help. Names, photos, and case details are never published on this map.', 'text'),
  ('ice.rapid.reunification.cta', 'ice', 'Reunification Card Link Label', 'Start a private request', 'text'),

  ('ice.rapid.sources.community.body', 'ice', 'Community Source Description', 'Public nightly export. We use city centroids and a short generated summary; the original export includes street addresses and vehicle details that we do not republish. Source-confirmed is the network''s label.', 'text'),
  ('ice.rapid.sources.community.api', 'ice', 'Community API Link Label', 'Chapter API & downloads', 'text'),
  ('ice.rapid.sources.community.export', 'ice', 'Community Export Link Label', 'National data export', 'text'),
  ('ice.rapid.sources.official.body', 'ice', 'Official Source Description', 'Official newsroom RSS. These are agency releases, not live enforcement locations. We summarize the topic and link out instead of reproducing names or case details, and we do not map releases as incidents.', 'text'),
  ('ice.rapid.sources.official.link', 'ice', 'Official Source Link Label', 'ICE newsroom', 'text'),
  ('ice.rapid.sources.historical.title', 'ice', 'Historical Source Title', 'Historical baseline: FOIA release', 'text'),
  ('ice.rapid.sources.historical.link', 'ice', 'Historical Source Link Label', 'Deportation Data Project', 'text'),

  ('ice.reading.cards.city.title', 'ice', 'Reading Guide City Totals Title', 'City totals', 'text'),
  ('ice.reading.cards.city.body', 'ice', 'Reading Guide City Totals Description', 'Each point is the number of records whose city field matches a Census place. It is not a single incident or a street address.', 'text'),
  ('ice.reading.cards.clusters.title', 'ice', 'Reading Guide Clusters Title', 'Clusters and circles', 'text'),
  ('ice.reading.cards.clusters.body', 'ice', 'Reading Guide Clusters Description', 'Numbers group nearby cities at overview zooms and show their combined records. Zoom in for individual city dots; larger circles mean more records assigned to that city.', 'text'),
  ('ice.reading.cards.gaps.title', 'ice', 'Reading Guide Known Gaps Title', 'Known gaps', 'text'),
  ('ice.reading.facts.dedup.title', 'ice', 'Reading Guide Deduplicated Title', 'De-duplicated', 'text'),
  ('ice.reading.facts.source.title', 'ice', 'Reading Guide Source Linked Title', 'Source-linked', 'text'),
  ('ice.reading.facts.source.body', 'ice', 'Reading Guide Source Linked Description', 'The dataset is CC0 and the page links to the Deportation Data Project''s processed release and citation.', 'text'),
  ('ice.reading.facts.emergency.title', 'ice', 'Reading Guide Emergency Title', 'Not an emergency service', 'text'),
  ('ice.reading.facts.emergency.body', 'ice', 'Reading Guide Emergency Description', 'The map cannot dispatch help. In an emergency, call 911. If you encounter enforcement activity, you can carefully observe or film from a safe distance; do not interfere or obstruct. Filming in public is generally protected.', 'text'),
  ('ice.reading.warning.title', 'ice', 'Reading Guide Limits Title', 'What this map does not show', 'text'),
  ('ice.reading.warning.item1', 'ice', 'Reading Guide Limit 1', 'No live reports, current enforcement locations, or street-level events.', 'text'),
  ('ice.reading.warning.item2', 'ice', 'Reading Guide Limit 2', 'No names, faces, plate numbers, or immigration status.', 'text'),
  ('ice.reading.warning.item3', 'ice', 'Reading Guide Limit 3', 'No claim that every arrest happened in the city named in the record.', 'text'),
  ('ice.reading.warning.item4', 'ice', 'Reading Guide Limit 4', 'No records without a usable U.S. city or coordinates.', 'text')
ON CONFLICT (key) DO NOTHING;
