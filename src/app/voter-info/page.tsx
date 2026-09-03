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

export const metadata: Metadata = {
  title: 'Voter Information & Guides | Indivisible Fair Oaks-Carmichael',
  description:
    'Comprehensive voter resources for Fair Oaks, Carmichael, and Sacramento County. Pre-registration for youth, rights restoration, elected officials directory, and ballot tracking.',
};

export default function VoterInfoPage() {
  return (
    <div className="w-full bg-slate-950 text-white min-h-screen pt-24 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Vote size={14} className="text-amber-400" />
            <span>Sacramento County Voter Center</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Voter Information & Guides
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
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
            className="p-6 rounded-2xl bg-blue-900/40 border border-blue-500/40 hover:border-blue-400 transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform">
                <Vote size={24} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Register to Vote Online</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Register or update your address and party affiliation through the California
                Secretary of State portal.
              </p>
            </div>
            <div className="pt-6 flex items-center gap-2 text-xs font-bold text-amber-400">
              <span>registertovote.ca.gov</span>
              <ExternalLink size={14} />
            </div>
          </a>

          <a
            href="https://wheresmyballot.sos.ca.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Search size={24} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Track Your Ballot</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sign up for &ldquo;Where&apos;s My Ballot?&rdquo; to receive automatic text and
                email updates when your mail-in ballot is received and counted.
              </p>
            </div>
            <div className="pt-6 flex items-center gap-2 text-xs font-bold text-amber-400">
              <span>wheresmyballot.sos.ca.gov</span>
              <ExternalLink size={14} />
            </div>
          </a>

          <a
            href="https://elections.saccounty.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <CheckCircle2 size={24} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Sacramento Elections</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Official Sacramento County Voter Registration & Elections Division: find Vote Center
                locations and drop boxes.
              </p>
            </div>
            <div className="pt-6 flex items-center gap-2 text-xs font-bold text-emerald-400">
              <span>elections.saccounty.gov</span>
              <ExternalLink size={14} />
            </div>
          </a>
        </div>

        {/* Detailed Guides Section */}
        <div className="space-y-8">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Voter Rights & Educational Guides
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Guide 1: Elected Officials */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <UserCheck size={20} />
              </div>
              <h3 className="text-xl font-bold text-white">Who Represents You?</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                A complete directory of elected officials serving Fair Oaks, Carmichael, and
                Sacramento County at the local, county, state, and federal levels, including contact
                telephone numbers and district offices.
              </p>
              <div className="pt-2">
                <a
                  href="https://drive.google.com/open?id=1cugSjV00M6yL3e414nUq8j2hC9H-Kq6L"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 text-xs font-bold transition-colors"
                >
                  <FileDown size={14} />
                  <span>Download Directory PDF</span>
                </a>
              </div>
            </div>

            {/* Guide 2: Youth Pre-Registration */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Vote size={20} />
              </div>
              <h3 className="text-xl font-bold text-white">Pre-Register at 16, Vote at 18</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                California youth age 16 and 17 can pre-register online now. When you turn 18, you
                will automatically be registered to cast your ballot in all elections. Spread the
                word in local high schools and community colleges!
              </p>
              <div className="pt-2">
                <a
                  href="https://registertovote.ca.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 text-xs font-bold transition-colors"
                >
                  <ExternalLink size={14} />
                  <span>Pre-Register Online</span>
                </a>
              </div>
            </div>

            {/* Guide 3: Rights Restoration */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Shield size={20} />
              </div>
              <h3 className="text-xl font-bold text-white">Voting Rights Restoration</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                In California, under Proposition 17, your right to vote is automatically restored
                immediately upon release from prison. If you are on parole, probation, or in county
                jail, you have the right to register and vote!
              </p>
              <div className="pt-2">
                <a
                  href="https://www.sos.ca.gov/elections/voting-resources/voting-california/who-can-vote-california/voting-rights-californians-criminal-history"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 text-xs font-bold transition-colors"
                >
                  <ExternalLink size={14} />
                  <span>CA Secretary of State Guide</span>
                </a>
              </div>
            </div>

            {/* Guide 4: Unhoused Voters */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <HelpCircle size={20} />
              </div>
              <h3 className="text-xl font-bold text-white">Homeless is NOT Voteless</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                You do not need a permanent home to vote. California law allows unhoused individuals
                to list cross-streets, a park, or a shelter as their residential description, and
                receive mail at a P.O. box or shelter address.
              </p>
              <div className="pt-2">
                <a
                  href="https://www.sos.ca.gov/elections/voting-resources/voting-california/homeless"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 text-xs font-bold transition-colors"
                >
                  <ExternalLink size={14} />
                  <span>Unhoused Voter Procedures</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Official County Contacts & Hotlines */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-500/30 space-y-6">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Phone className="text-amber-400" />
            <span>Sacramento County Elections & Voter Hotlines</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm text-slate-300">
            <div className="space-y-2">
              <strong className="text-white block text-base">
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
                <a href="mailto:voterinfo@saccounty.gov" className="text-blue-400 hover:underline">
                  voterinfo@saccounty.gov
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <strong className="text-white block text-base">
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
        </div>
      </div>
    </div>
  );
}
