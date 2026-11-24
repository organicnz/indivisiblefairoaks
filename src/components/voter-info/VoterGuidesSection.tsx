import {
  CheckCircle2,
  ExternalLink,
  FileDown,
  HelpCircle,
  Phone,
  Search,
  Shield,
  UserCheck,
  Vote,
} from 'lucide-react';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { DataPoint } from '@/components/ui/DataPoint';
import { LiteYouTube } from '@/components/ui/LiteYouTube';
import type { LegacyHref } from './types';

type VoterGuidesSectionProps = {
  dataPoints: Record<string, string>;
  legacyHref: LegacyHref;
};

export function VoterGuidesSection({ dataPoints, legacyHref }: VoterGuidesSectionProps) {
  return (
    <>
      {/* Detailed Guides Section — copy region */}
      <div id="guides" className="space-y-8 scroll-mt-28">
        <CopyRegion id="voter-guides">
          {/* Featured 2026 Voter Guide & Ballot Recommendations */}
          <div className="relative mb-8 border-y border-border bg-surface-card p-6 sm:p-8">
            <div className="relative z-10 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-gold/15 dark:bg-accent-gold/20 border border-accent-gold/30 dark:border-accent-gold/30 text-amber-800 dark:text-accent-gold text-xs font-bold uppercase tracking-wider mb-2">
                  <Vote size={13} />
                  <DataPoint initialData={dataPoints} name="voter.guides.badge" as="span">
                    Official Chapter Endorsements
                  </DataPoint>
                </div>
                <DataPoint
                  initialData={dataPoints}
                  as="h2"
                  name="voter.guides.headline"
                  className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl"
                >
                  2026 Voter Guide &amp; Ballot Recommendations
                </DataPoint>
                <DataPoint
                  initialData={dataPoints}
                  as="p"
                  name="voter.guides.subhead"
                  className="text-sm text-muted-foreground dark:text-ink-on-dark max-w-2xl leading-relaxed mt-1"
                >
                  Nonpartisan voting guides, ballot measure analyses, and local candidate
                  recommendations prepared for Fair Oaks, Carmichael, and Sacramento County voters.
                </DataPoint>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Official Voter Guide */}
                <a
                  href={legacyHref(
                    '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy',
                    'https://drive.google.com/file/d/10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy/view?ts=6ac7c922'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col justify-between border-t border-border bg-transparent py-4 transition-colors hover:text-primary-ink"
                >
                  <div className="space-y-2">
                    <div className="flex size-8 items-center justify-center border border-border bg-background text-primary-ink">
                      <Vote size={18} />
                    </div>
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.guide.sac_voter_guide.title"
                      as="h3"
                      className="font-bold text-sm text-foreground dark:text-white leading-snug"
                    >
                      Sacramento Voter Guide
                    </DataPoint>
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.guide.sac_voter_guide.desc"
                      as="p"
                      className="text-xs text-muted-foreground dark:text-ink-muted-on-dark leading-relaxed"
                    >
                      Official guide with recommendations on local candidates and county
                      initiatives.
                    </DataPoint>
                  </div>
                  <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-primary-ink dark:text-accent-gold group-hover:text-primary dark:group-hover:text-amber-200 transition-colors">
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.guide.sac_voter_guide.btn"
                      as="span"
                    >
                      Open Guide
                    </DataPoint>
                    <ExternalLink size={13} />
                  </div>
                </a>

                {/* Card 2: Ballot Recommendations */}
                <a
                  href={legacyHref(
                    '1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN',
                    'https://drive.google.com/file/d/1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN/view?usp=sharing_eil_se_dm&ts=6ac7c902'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col justify-between border-t border-border bg-transparent py-4 transition-colors hover:text-primary-ink"
                >
                  <div className="space-y-2">
                    <div className="flex size-8 items-center justify-center border border-border bg-background text-accent">
                      <CheckCircle2 size={18} />
                    </div>
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.guide.ballot_recs.title"
                      as="h3"
                      className="font-bold text-sm text-foreground dark:text-white leading-snug"
                    >
                      Ballot Recommendations
                    </DataPoint>
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.guide.ballot_recs.desc"
                      as="p"
                      className="text-xs text-muted-foreground dark:text-ink-muted-on-dark leading-relaxed"
                    >
                      In-depth breakdown of state propositions and regional ballot measures.
                    </DataPoint>
                  </div>
                  <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-primary-ink dark:text-accent-gold group-hover:text-primary dark:group-hover:text-amber-200 transition-colors">
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.guide.ballot_recs.btn"
                      as="span"
                    >
                      View Analysis
                    </DataPoint>
                    <ExternalLink size={13} />
                  </div>
                </a>

                {/* The archive has no candidate-specific document. This slot links the
                      actual Hands-Off-Our-Vote toolkit; Erin must supply a candidate
                      brief before one can be published. */}
                {/* Card 3: Hands Off Our Vote Toolkit */}
                <a
                  href={legacyHref(
                    '11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2',
                    'https://drive.google.com/file/d/11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2/view?usp=sharing_eil_se_dm&ts=6ac7c8d5'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col justify-between border-t border-border bg-transparent py-4 transition-colors hover:text-primary-ink"
                >
                  <div className="space-y-2">
                    <div className="flex size-8 items-center justify-center border border-border bg-background text-primary-ink">
                      <FileDown size={18} />
                    </div>
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.guide.candidate_brief.title"
                      as="h3"
                      className="font-bold text-sm text-foreground dark:text-white leading-snug"
                    >
                      Hands Off Our Vote 2026 Toolkit
                    </DataPoint>
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.guide.candidate_brief.desc"
                      as="p"
                      className="text-xs text-muted-foreground dark:text-ink-muted-on-dark leading-relaxed"
                    >
                      National election protection and ballot measure toolkit for the 2026 election.
                    </DataPoint>
                  </div>
                  <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-primary-ink dark:text-accent-gold group-hover:text-primary dark:group-hover:text-amber-200 transition-colors">
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.guide.candidate_brief.btn"
                      as="span"
                    >
                      Download Toolkit
                    </DataPoint>
                    <ExternalLink size={13} />
                  </div>
                </a>

                {/* Card 4: Key Dates for the Election */}
                <a
                  href={legacyHref(
                    '1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U',
                    'https://docs.google.com/document/d/1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U/edit?usp=sharing_eil_se_dm&rtpof=true&sd=true&ts=6ac7c8ad'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col justify-between border-t border-border bg-transparent py-4 transition-colors hover:text-primary-ink"
                >
                  <div className="space-y-2">
                    <div className="flex size-8 items-center justify-center border border-border bg-background text-primary-ink">
                      <HelpCircle size={18} />
                    </div>
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.guide.voter_doc.title"
                      as="h3"
                      className="font-bold text-sm text-foreground dark:text-white leading-snug"
                    >
                      Key Dates for the Election
                    </DataPoint>
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.guide.voter_doc.desc"
                      as="p"
                      className="text-xs text-muted-foreground dark:text-ink-muted-on-dark leading-relaxed"
                    >
                      Official election deadline schedule, including voter registration,
                      vote-by-mail, and Election Day dates.
                    </DataPoint>
                  </div>
                  <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-primary-ink dark:text-accent-gold group-hover:text-primary dark:group-hover:text-amber-200 transition-colors">
                    <DataPoint initialData={dataPoints} name="voter.guide.voter_doc.btn" as="span">
                      View Key Dates
                    </DataPoint>
                    <ExternalLink size={13} />
                  </div>
                </a>
              </div>

              {/* Save America Act Video Spotlight (Issue #89) */}
              <div className="mt-8 border border-border bg-surface-card p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row gap-6 items-center">
                  <div className="w-full shrink-0 lg:w-1/2">
                    <LiteYouTube
                      videoId="0a9zLvWVqgQ"
                      title="The SAVE America Act Educational Video"
                      poster="/images/gallery/sacramento-capitol-no-kings.jpg"
                      className="border border-border"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-accent-gold/20 text-amber-700 dark:text-accent-gold-on-dark text-[11px] font-bold uppercase tracking-wider">
                      <DataPoint initialData={dataPoints} name="voter.spotlight.badge" as="span">
                        Educational Video Spotlight
                      </DataPoint>
                    </div>
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.spotlight.title"
                      as="h4"
                      className="text-base sm:text-lg font-bold text-foreground dark:text-white leading-snug"
                    >
                      Understanding the SAVE America Act (H.R. 8281 / H.R. 7296)
                    </DataPoint>
                    <DataPoint
                      initialData={dataPoints}
                      name="voter.spotlight.desc"
                      as="p"
                      className="text-xs text-muted-foreground dark:text-ink-muted-on-dark leading-relaxed"
                    >
                      Watch this concise legal overview explaining the proposed Safeguard American
                      Voter Eligibility (SAVE) Act. Learn how strict documentary
                      proof-of-citizenship mandates impact eligible registered voters—including
                      millions of married women whose legal names differ from their birth
                      certificates, students, rural citizens, and seniors.
                    </DataPoint>
                    <div className="pt-1 flex items-center gap-4 text-xs">
                      <DataPoint
                        initialData={dataPoints}
                        name="voter.spotlight.author"
                        as="span"
                        className="text-muted-foreground dark:text-ink-muted-on-dark"
                      >
                        Analysis by Lawyer Oyer
                      </DataPoint>
                      <a
                        href="https://www.brennancenter.org/our-work/research-reports/save-act-voter-suppression"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-ink dark:text-primary-on-dark hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        <DataPoint initialData={dataPoints} name="voter.spotlight.link" as="span">
                          Brennan Center Analysis
                        </DataPoint>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DataPoint
            initialData={dataPoints}
            name="voter.guides_section.title"
            as="h2"
            id="rights"
            className="civic-section-title mb-6 scroll-mt-28"
          >
            Voter Rights &amp; Educational Guides
          </DataPoint>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Guide 1: Elected Officials */}
            <div className="space-y-4 border-t border-foreground/25 pt-6">
              <div className="flex size-10 items-center justify-center border border-border bg-background text-primary-ink">
                <UserCheck size={20} />
              </div>
              <DataPoint
                initialData={dataPoints}
                name="voter.guide1.title"
                as="h3"
                className="text-xl font-bold text-foreground dark:text-white"
              >
                Who Represents You?
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                name="voter.guide1.desc"
                as="p"
                className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
              >
                A complete directory of elected officials serving Fair Oaks, Carmichael, and
                Sacramento County at the local, county, state, and federal levels, including contact
                telephone numbers and district offices.
              </DataPoint>
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <a
                  href="#representatives"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-colors"
                >
                  <Search size={14} />
                  <span>Find Your Reps</span>
                </a>
                <a
                  href="https://5calls.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-muted dark:bg-white/10 hover:bg-primary hover:text-white dark:hover:bg-primary-bright dark:hover:text-white text-primary-ink dark:text-white text-xs font-bold transition-colors"
                >
                  <Phone size={14} />
                  <span>5 Calls App</span>
                  <ExternalLink size={12} />
                </a>
                <a
                  href={legacyHref(
                    '1mpQTszfaP1wLvydcCjLTfw9WKzXNL4YN',
                    'https://drive.google.com/file/d/1mpQTszfaP1wLvydcCjLTfw9WKzXNL4YN/view'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-muted dark:bg-white/10 hover:bg-primary hover:text-white dark:hover:bg-primary-bright dark:hover:text-white text-primary-ink dark:text-white text-xs font-bold transition-colors"
                >
                  <FileDown size={14} />
                  <DataPoint initialData={dataPoints} name="voter.guide1.btn" as="span">
                    Download Directory PDF
                  </DataPoint>
                </a>
              </div>
            </div>

            {/* Guide 2: Youth Pre-Registration */}
            <div className="space-y-4 border-t border-foreground/25 pt-6">
              <div className="flex size-10 items-center justify-center border border-border bg-background text-accent">
                <Vote size={20} />
              </div>
              <DataPoint
                initialData={dataPoints}
                name="voter.guide2.title"
                as="h3"
                className="text-xl font-bold text-foreground dark:text-white"
              >
                Pre-Register at 16, Vote at 18
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                name="voter.guide2.desc"
                as="p"
                className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
              >
                California youth age 16 and 17 can pre-register online now. When you turn 18, you
                will automatically be registered to cast your ballot in all elections. Spread the
                word in local high schools and community colleges!
              </DataPoint>
              <div className="pt-2">
                <a
                  href="https://registertovote.ca.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-muted dark:bg-white/10 hover:bg-primary hover:text-white dark:hover:bg-primary-bright dark:hover:text-white text-primary-ink dark:text-white text-xs font-bold transition-colors"
                >
                  <ExternalLink size={14} />
                  <DataPoint initialData={dataPoints} name="voter.guide2.btn" as="span">
                    Pre-Register Online
                  </DataPoint>
                </a>
              </div>
            </div>

            {/* Guide 3: Rights Restoration */}
            <div className="space-y-4 border-t border-foreground/25 pt-6">
              <div className="flex size-10 items-center justify-center border border-border bg-background text-primary-ink">
                <Shield size={20} />
              </div>
              <DataPoint
                initialData={dataPoints}
                name="voter.guide3.title"
                as="h3"
                className="text-xl font-bold text-foreground dark:text-white"
              >
                Voting Rights Restoration
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                name="voter.guide3.desc"
                as="p"
                className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
              >
                In California, under Proposition 17, your right to vote is automatically restored
                immediately upon release from prison. If you are on parole, probation, or in county
                jail, you have the right to register and vote!
              </DataPoint>
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <a
                  href="https://www.sos.ca.gov/elections/voting-rights-restored"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-muted dark:bg-white/10 hover:bg-primary hover:text-white dark:hover:bg-primary-bright dark:hover:text-white text-primary-ink dark:text-white text-xs font-bold transition-colors"
                >
                  <ExternalLink size={14} />
                  <DataPoint initialData={dataPoints} name="voter.guide3.btn" as="span">
                    CA Secretary of State Guide
                  </DataPoint>
                </a>
                <a
                  href="https://www.sos.ca.gov/elections/voter-bill-rights"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-muted dark:bg-white/10 hover:bg-primary hover:text-white dark:hover:bg-primary-bright dark:hover:text-white text-primary-ink dark:text-white text-xs font-bold transition-colors"
                >
                  <Shield size={14} />
                  <span>Voter Bill of Rights</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Guide 4: Unhoused Voters */}
            <div className="space-y-4 border-t border-foreground/25 pt-6">
              <div className="flex size-10 items-center justify-center border border-border bg-background text-primary-ink">
                <HelpCircle size={20} />
              </div>
              <DataPoint
                initialData={dataPoints}
                name="voter.guide4.title"
                as="h3"
                className="text-xl font-bold text-foreground dark:text-white"
              >
                Homeless is NOT Voteless
              </DataPoint>
              <DataPoint
                initialData={dataPoints}
                name="voter.guide4.desc"
                as="p"
                className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed"
              >
                You do not need a permanent home to vote. California law allows unhoused individuals
                to list cross-streets, a park, or a shelter as their residential description, and
                receive mail at a P.O. box or shelter address.
              </DataPoint>
              <div className="pt-2">
                <a
                  href="https://elections.cdn.sos.ca.gov/statewide-elections/2025-special/trusted-info-homelessness.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-muted dark:bg-white/10 hover:bg-primary hover:text-white dark:hover:bg-primary-bright dark:hover:text-white text-primary-ink dark:text-white text-xs font-bold transition-colors"
                >
                  <ExternalLink size={14} />
                  <DataPoint initialData={dataPoints} name="voter.guide4.btn" as="span">
                    Unhoused Voter Procedures
                  </DataPoint>
                </a>
              </div>
            </div>
          </div>
        </CopyRegion>
      </div>
    </>
  );
}
