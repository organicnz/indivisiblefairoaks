-- Correct the two voter-guide cards whose copy drifted from the linked file.
--
-- The `voter.guide.candidate_brief.*` keys are retained because they are
-- already in the CMS and read by the page. The only file in that slot is the
-- Hands-Off-Our-Vote-2026-Toolkit.pdf, not a candidate brief; the page and this
-- migration name that real document. A candidate-specific brief needs Erin's
-- source file before it can be added.
--
-- The voter_doc slot links KEY DATES FOR THE ELECTION.docx, so its copy names
-- key election dates rather than a generic voter-information document.
INSERT INTO public.data_points (key, group_name, label, value, content_type)
VALUES
  ('voter.guide.candidate_brief.title', 'voter', 'Voter Guide Hands Off Our Vote Toolkit Title', 'Hands Off Our Vote 2026 Toolkit', 'text'),
  ('voter.guide.candidate_brief.desc', 'voter', 'Voter Guide Hands Off Our Vote Toolkit Description', 'National election protection and ballot measure toolkit for the 2026 election.', 'text'),
  ('voter.guide.candidate_brief.btn', 'voter', 'Voter Guide Hands Off Our Vote Toolkit Button', 'Download Toolkit', 'text'),
  ('voter.guide.voter_doc.title', 'voter', 'Voter Guide Key Election Dates Title', 'Key Dates for the Election', 'text'),
  ('voter.guide.voter_doc.desc', 'voter', 'Voter Guide Key Election Dates Description', 'Official election deadline schedule, including voter registration, vote-by-mail, and Election Day dates.', 'text'),
  ('voter.guide.voter_doc.btn', 'voter', 'Voter Guide Key Election Dates Button', 'View Key Dates', 'text')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  content_type = EXCLUDED.content_type,
  updated_at = NOW();
