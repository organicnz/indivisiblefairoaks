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
import type { Metadata } from 'next';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { SacramentoRepresentativeFinder } from '@/components/ui/SacramentoRepresentativeFinder';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Voter Information & Guides',
  description:
    'Comprehensive voter resources for Fair Oaks, Carmichael, and Sacramento County. Pre-registration for youth, rights restoration, elected officials directory, and ballot tracking.',
  path: '/voter-info',
});

export default function VoterInfoPage() {
  return (
    <div className="w-full bg-background text-foreground dark:bg-secondary dark:text-white min-h-screen pt-(--header-clearance) pb-20">
      {/* Header Banner with VGPU Constellation Network */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border-b border-white/10 py-16">
        <VgpuCivicConstellation />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pointer-events-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-bright/10 border border-primary-on-dark-muted/30 text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4">
            <Vote size={14} className="text-accent-gold" />
            <span>Sacramento County Voter Center</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Voter Information & Guides
          </h1>
          <p className="text-lg text-ink-on-dark max-w-2xl mx-auto leading-relaxed">
            Your vote is your voice and your power. Explore official guides, check your registration
            status, and know your rights as a California voter.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a
            href="https://registertovote.ca.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-2xl bg-primary/5 border border-primary/30 hover:border-blue-400 transition-all group flex flex-col justify-between dark:bg-blue-900/40 dark:border-primary-bright/40"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-primary-bright flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform">
                <Vote size={24} />
              </div>
              <h2 className="text-xl font-bold text-foreground dark:text-white mb-2">
                Register to Vote Online
              </h2>
              <p className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                Register or update your address and party affiliation through the California
                Secretary of State portal.
              </p>
            </div>
            <div className="pt-6 flex items-center gap-2 text-xs font-bold text-primary-ink dark:text-accent-gold">
              <span>registertovote.ca.gov</span>
              <ExternalLink size={14} />
            </div>
          </a>

          <a
            href="https://wheresmyballot.sos.ca.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-2xl bg-surface-card border border-border dark:bg-secondary dark:border-white/10 hover:border-accent-gold/40 transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-accent-gold/20 text-accent dark:text-accent-gold flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Search size={24} />
              </div>
              <h2 className="text-xl font-bold text-foreground dark:text-white mb-2">
                Track Your Ballot
              </h2>
              <p className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                Sign up for &ldquo;Where&apos;s My Ballot?&rdquo; to receive automatic text and
                email updates when your mail-in ballot is received and counted.
              </p>
            </div>
            <div className="pt-6 flex items-center gap-2 text-xs font-bold text-primary-ink dark:text-accent-gold">
              <span>wheresmyballot.sos.ca.gov</span>
              <ExternalLink size={14} />
            </div>
          </a>

          <a
            href="https://elections.saccounty.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-2xl bg-surface-card border border-border dark:bg-secondary dark:border-white/10 hover:border-emerald-500/40 transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <CheckCircle2 size={24} />
              </div>
              <h2 className="text-xl font-bold text-foreground dark:text-white mb-2">
                Sacramento Elections
              </h2>
              <p className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                Official Sacramento County Voter Registration & Elections Division: find Vote Center
                locations and drop boxes.
              </p>
            </div>
            <div className="pt-6 flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <span>elections.saccounty.gov</span>
              <ExternalLink size={14} />
            </div>
          </a>
        </div>

        {/* 10x Pro Interactive District & Representative Lookup Tool */}
        {/* `id` is a nav target: the Voter Info dropdown links here. `scroll-mt`
            clears the fixed header so the anchored section is not hidden under it. */}
        <div id="representatives" className="scroll-mt-28">
          <SacramentoRepresentativeFinder />
        </div>

        {/* Detailed Guides Section — copy region */}
        <div id="guides" className="space-y-8 scroll-mt-28">
          <CopyRegion id="voter-guides">
            {/* Featured 2026 Voter Guide & Ballot Recommendations */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 border border-primary-bright/30 p-6 sm:p-8 shadow-float mb-8">
              <div className="relative z-10 space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-gold/20 border border-accent-gold/30 text-accent-gold text-xs font-bold uppercase tracking-wider mb-2">
                    <Vote size={13} />
                    <span>Official Chapter Endorsements</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    2026 Voter Guide &amp; Ballot Recommendations
                  </h2>
                  <p className="text-sm text-ink-on-dark max-w-2xl leading-relaxed mt-1">
                    Nonpartisan voting guides, ballot measure analyses, and local candidate
                    recommendations prepared for Fair Oaks, Carmichael, and Sacramento County
                    voters.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Official Voter Guide */}
                  <a
                    href="https://drive.google.com/file/d/10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy/view?ts=6ac7c922"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 sm:p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary-on-dark transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="size-9 rounded-xl bg-primary-bright/20 text-primary-on-dark flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Vote size={18} />
                      </div>
                      <h3 className="font-bold text-sm text-white leading-snug">
                        Sacramento Voter Guide
                      </h3>
                      <p className="text-xs text-ink-muted-on-dark leading-relaxed">
                        Official guide with recommendations on local candidates and county
                        initiatives.
                      </p>
                    </div>
                    <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-accent-gold group-hover:text-accent-gold/80 transition-colors">
                      <span>Open Guide</span>
                      <ExternalLink size={13} />
                    </div>
                  </a>

                  {/* Card 2: Ballot Recommendations */}
                  <a
                    href="https://drive.google.com/file/d/1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN/view?usp=sharing_eil_se_dm&ts=6ac7c902"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 sm:p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary-on-dark transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="size-9 rounded-xl bg-accent-gold/20 text-accent-gold flex items-center justify-center group-hover:scale-105 transition-transform">
                        <CheckCircle2 size={18} />
                      </div>
                      <h3 className="font-bold text-sm text-white leading-snug">
                        Ballot Recommendations
                      </h3>
                      <p className="text-xs text-ink-muted-on-dark leading-relaxed">
                        In-depth breakdown of state propositions and regional ballot measures.
                      </p>
                    </div>
                    <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-accent-gold group-hover:text-accent-gold/80 transition-colors">
                      <span>View Analysis</span>
                      <ExternalLink size={13} />
                    </div>
                  </a>

                  {/* Card 3: Measure Analysis */}
                  <a
                    href="https://drive.google.com/file/d/11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2/view?usp=sharing_eil_se_dm&ts=6ac7c8d5"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 sm:p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary-on-dark transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="size-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <FileDown size={18} />
                      </div>
                      <h3 className="font-bold text-sm text-white leading-snug">
                        Candidate &amp; Measure Brief
                      </h3>
                      <p className="text-xs text-ink-muted-on-dark leading-relaxed">
                        Background report on judicial races, school boards, and county supervisors.
                      </p>
                    </div>
                    <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-accent-gold group-hover:text-accent-gold/80 transition-colors">
                      <span>Download Brief</span>
                      <ExternalLink size={13} />
                    </div>
                  </a>

                  {/* Card 4: Voter Information Document */}
                  <a
                    href="https://docs.google.com/document/d/1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U/edit?usp=sharing_eil_se_dm&rtpof=true&sd=true&ts=6ac7c8ad"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 sm:p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary-on-dark transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="size-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <HelpCircle size={18} />
                      </div>
                      <h3 className="font-bold text-sm text-white leading-snug">
                        Voter Information Doc
                      </h3>
                      <p className="text-xs text-ink-muted-on-dark leading-relaxed">
                        Full reference document on deadlines, polling sites, and voter rights.
                      </p>
                    </div>
                    <div className="pt-3 flex items-center gap-1.5 text-xs font-bold text-accent-gold group-hover:text-accent-gold/80 transition-colors">
                      <span>Read Document</span>
                      <ExternalLink size={13} />
                    </div>
                  </a>
                </div>

                {/* Save America Act Video Spotlight (Issue #89) */}
                <div className="mt-8 rounded-2xl bg-secondary border border-white/10 p-5 sm:p-6 shadow-xl">
                  <div className="flex flex-col lg:flex-row gap-6 items-center">
                    <div className="w-full lg:w-1/2 aspect-video rounded-xl overflow-hidden bg-black border border-white/10 shrink-0">
                      <iframe
                        className="w-full h-full"
                        src="https://www.youtube.com/embed/0a9zLvWVqgQ"
                        title="The SAVE America Act Educational Video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent-gold/15 text-accent-gold text-[11px] font-bold uppercase tracking-wider">
                        Educational Video Spotlight
                      </div>
                      <h4 className="text-base sm:text-lg font-bold text-white leading-snug">
                        Understanding the SAVE America Act (H.R. 8281 / H.R. 7296)
                      </h4>
                      <p className="text-xs text-ink-muted-on-dark leading-relaxed">
                        Watch this concise legal overview explaining the proposed Safeguard American
                        Voter Eligibility (SAVE) Act. Learn how strict documentary
                        proof-of-citizenship mandates impact eligible registered voters—including
                        millions of married women whose legal names differ from their birth
                        certificates, students, rural citizens, and seniors.
                      </p>
                      <div className="pt-1 flex items-center gap-4 text-xs">
                        <span className="text-ink-muted-on-dark">Analysis by Lawyer Oyer</span>
                        <a
                          href="https://www.brennancenter.org/our-work/research-reports/save-act-voter-suppression"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-on-dark hover:underline inline-flex items-center gap-1 font-semibold"
                        >
                          <span>Brennan Center Analysis</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-foreground dark:text-white tracking-tight mb-6">
              Voter Rights &amp; Educational Guides
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Guide 1: Elected Officials */}
              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-primary-bright/20 text-primary-ink dark:text-primary-on-dark-muted flex items-center justify-center">
                  <UserCheck size={20} />
                </div>
                <h3 className="text-xl font-bold text-foreground dark:text-white">
                  Who Represents You?
                </h3>
                <p className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                  A complete directory of elected officials serving Fair Oaks, Carmichael, and
                  Sacramento County at the local, county, state, and federal levels, including
                  contact telephone numbers and district offices.
                </p>
                <div className="pt-2">
                  <a
                    href="https://drive.google.com/open?id=1cugSjV00M6yL3e414nUq8j2hC9H-Kq6L"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-muted dark:bg-white/5 hover:bg-secondary hover:text-white dark:hover:bg-slate-700 dark:hover:text-white text-primary-ink dark:text-accent-gold text-xs font-bold transition-colors"
                  >
                    <FileDown size={14} />
                    <span>Download Directory PDF</span>
                  </a>
                </div>
              </div>

              {/* Guide 2: Youth Pre-Registration */}
              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-accent-gold/20 text-accent dark:text-accent-gold flex items-center justify-center">
                  <Vote size={20} />
                </div>
                <h3 className="text-xl font-bold text-foreground dark:text-white">
                  Pre-Register at 16, Vote at 18
                </h3>
                <p className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                  California youth age 16 and 17 can pre-register online now. When you turn 18, you
                  will automatically be registered to cast your ballot in all elections. Spread the
                  word in local high schools and community colleges!
                </p>
                <div className="pt-2">
                  <a
                    href="https://registertovote.ca.gov"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-muted dark:bg-white/5 hover:bg-secondary hover:text-white dark:hover:bg-slate-700 dark:hover:text-white text-primary-ink dark:text-accent-gold text-xs font-bold transition-colors"
                  >
                    <ExternalLink size={14} />
                    <span>Pre-Register Online</span>
                  </a>
                </div>
              </div>

              {/* Guide 3: Rights Restoration */}
              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <h3 className="text-xl font-bold text-foreground dark:text-white">
                  Voting Rights Restoration
                </h3>
                <p className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                  In California, under Proposition 17, your right to vote is automatically restored
                  immediately upon release from prison. If you are on parole, probation, or in
                  county jail, you have the right to register and vote!
                </p>
                <div className="pt-2">
                  <a
                    href="https://www.sos.ca.gov/elections/voting-resources/voting-california/who-can-vote-california/voting-rights-californians-criminal-history"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-muted dark:bg-white/5 hover:bg-secondary hover:text-white dark:hover:bg-slate-700 dark:hover:text-white text-primary-ink dark:text-accent-gold text-xs font-bold transition-colors"
                  >
                    <ExternalLink size={14} />
                    <span>CA Secretary of State Guide</span>
                  </a>
                </div>
              </div>

              {/* Guide 4: Unhoused Voters */}
              <div className="p-6 rounded-2xl bg-surface-card dark:bg-secondary/80 border border-border dark:border-white/10 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-primary-bright/20 text-primary-ink dark:text-primary-on-dark-muted flex items-center justify-center">
                  <HelpCircle size={20} />
                </div>
                <h3 className="text-xl font-bold text-foreground dark:text-white">
                  Homeless is NOT Voteless
                </h3>
                <p className="text-xs text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                  You do not need a permanent home to vote. California law allows unhoused
                  individuals to list cross-streets, a park, or a shelter as their residential
                  description, and receive mail at a P.O. box or shelter address.
                </p>
                <div className="pt-2">
                  <a
                    href="https://www.sos.ca.gov/elections/voting-resources/voting-california/homeless"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-muted dark:bg-white/5 hover:bg-secondary hover:text-white dark:hover:bg-slate-700 dark:hover:text-white text-primary-ink dark:text-accent-gold text-xs font-bold transition-colors"
                  >
                    <ExternalLink size={14} />
                    <span>Unhoused Voter Procedures</span>
                  </a>
                </div>
              </div>
            </div>
          </CopyRegion>
        </div>

        {/* Official County Contacts & Hotlines — copy region */}
        <div
          id="hotlines"
          className="p-8 rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-primary-bright/30 space-y-6 scroll-mt-28"
        >
          <h2 className="text-2xl font-black text-foreground dark:text-white tracking-tight flex items-center gap-2">
            <Phone className="text-accent dark:text-accent-gold" />
            <span>Sacramento County Elections & Voter Hotlines</span>
          </h2>
          <CopyRegion id="voter-hotlines">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark">
              <div className="space-y-2">
                <strong className="text-foreground dark:text-white block text-base">
                  Sacramento County Elections Office
                </strong>
                <p>7000 65th Street, Suite A, Sacramento, CA 95823</p>
                <p>
                  <strong>Phone:</strong> (916) 875-6451
                </p>
                <p>
                  <strong>Toll-Free:</strong> 1-800-762-8019
                </p>
                <p>
                  <strong>Email:</strong>{' '}
                  <a
                    href="mailto:voterinfo@saccounty.gov"
                    className="text-primary-ink dark:text-primary-on-dark-muted hover:underline"
                  >
                    voterinfo@saccounty.gov
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <strong className="text-foreground dark:text-white block text-base">
                  Nonpartisan Election Protection Hotlines
                </strong>
                <p>If you encounter issues voting, call the national nonpartisan hotlines:</p>
                <p>
                  <strong>English:</strong> 1-866-OUR-VOTE (1-866-687-8683)
                </p>
                <p>
                  <strong>Spanish:</strong> 1-888-VE-Y-VOTA (1-888-839-8682)
                </p>
                <p>
                  <strong>Asian Languages:</strong> 1-888-API-VOTE (1-888-274-8683)
                </p>
              </div>
            </div>
          </CopyRegion>
        </div>
      </div>
    </div>
  );
}
