-- Seed coalition links data points into public.data_points
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('link.indivisible-national.name', 'links', 'Indivisible National Title', 'Indivisible National', 'text'),
  ('link.indivisible-national.desc', 'links', 'Indivisible National Description', 'The national movement to elect progressive leaders and rebuild our democracy. Guides, toolkits, and national call campaigns.', 'text'),
  ('link.indivisible-national.badge', 'links', 'Indivisible National Badge', 'National Hub', 'text'),
  ('link.indivisible-ca.name', 'links', 'Indivisible California State Network Title', 'Indivisible California State Network', 'text'),
  ('link.indivisible-ca.desc', 'links', 'Indivisible California State Network Description', 'Coordinating Indivisible chapters across California for Sacramento legislative advocacy and statewide election protection.', 'text'),
  ('link.mobilize-directory.name', 'links', 'Mobilize.us Indivisible Directory Title', 'Mobilize.us Indivisible Directory', 'text'),
  ('link.mobilize-directory.desc', 'links', 'Mobilize.us Indivisible Directory Description', 'Find upcoming local meetings, rallies, text banks, and phone banks organized by Indivisible chapters across California.', 'text'),
  ('link.ca-voter-reg.name', 'links', 'California Online Voter Registration Title', 'California Online Voter Registration', 'text'),
  ('link.ca-voter-reg.desc', 'links', 'California Online Voter Registration Description', 'Register to vote online or update your address and party registration with the California Secretary of State.', 'text'),
  ('link.ca-voter-reg.badge', 'links', 'California Online Voter Registration Badge', 'Official SOS', 'text'),
  ('link.ballottrax.name', 'links', 'Where''s My Ballot? (BallotTrax) Title', 'Where''s My Ballot? (BallotTrax)', 'text'),
  ('link.ballottrax.desc', 'links', 'Where''s My Ballot? (BallotTrax) Description', 'Track when your vote-by-mail ballot is printed, mailed, received, and counted by your county elections office.', 'text'),
  ('link.sac-elections.name', 'links', 'Sacramento County Elections Division Title', 'Sacramento County Elections Division', 'text'),
  ('link.sac-elections.desc', 'links', 'Sacramento County Elections Division Description', 'Official county portal for ballot drop-off locations, Vote Center hours, and official election results.', 'text'),
  ('link.lwv-sacramento.name', 'links', 'League of Women Voters Sacramento Title', 'League of Women Voters of Sacramento County', 'text'),
  ('link.lwv-sacramento.desc', 'links', 'League of Women Voters Sacramento Description', 'Trusted, nonpartisan in-depth analysis of statewide ballot propositions and local candidate debates.', 'text'),
  ('link.aclu-norcal.name', 'links', 'ACLU Northern California Title', 'ACLU of Northern California', 'text'),
  ('link.aclu-norcal.desc', 'links', 'ACLU Northern California Description', 'Defending civil liberties, constitutional rights, and public protest protections across Northern California.', 'text'),
  ('link.actblue-portal.name', 'links', 'ActBlue Contribution Portal Title', 'ActBlue Contribution Portal', 'text'),
  ('link.actblue-portal.desc', 'links', 'ActBlue Contribution Portal Description', 'Direct contribution portal to support Indivisible Fair Oaks-Carmichael grassroots organizing.', 'text'),
  ('link.actblue-portal.badge', 'links', 'ActBlue Contribution Portal Badge', 'Support Our Work', 'text')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  updated_at = NOW();
