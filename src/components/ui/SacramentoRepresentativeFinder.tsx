'use client';

import { Check, Copy, ExternalLink, MapPin, Phone, Search } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

interface Official {
  title: string;
  name: string;
  party: string;
  office: string;
  phone: string;
  website: string;
  notes?: string;
}

interface DistrictInfo {
  zip: string;
  city: string;
  county: string;
  congressionalDistrict: string;
  officials: Official[];
}

const DISTRICT_DATABASE: Record<string, DistrictInfo> = {
  '95628': {
    zip: '95628',
    city: 'Fair Oaks',
    county: 'Sacramento County',
    congressionalDistrict: 'California Congressional District 6 (CA-06)',
    officials: [
      {
        title: 'U.S. Representative (CA-06)',
        name: 'Rep. Ami Bera, M.D.',
        party: 'Democrat',
        office: 'Sacramento / D.C.',
        phone: '(916) 635-0505',
        website: 'https://bera.house.gov',
        notes: 'Represents Fair Oaks, Carmichael, Citrus Heights, and Rancho Cordova.',
      },
      {
        title: 'U.S. Senator',
        name: 'Sen. Alex Padilla',
        party: 'Democrat',
        office: 'Sacramento: (916) 448-2787 • D.C.: (202) 224-3553',
        phone: '(916) 448-2787',
        website: 'https://padilla.senate.gov',
      },
      {
        title: 'U.S. Senator',
        name: 'Sen. Laphonza Butler',
        party: 'Democrat',
        office: 'San Francisco: (415) 808-0400 • D.C.: (202) 224-3841',
        phone: '(202) 224-3841',
        website: 'https://butler.senate.gov',
      },
      {
        title: 'CA State Assembly (District 7)',
        name: 'Asm. Josh Hoover',
        party: 'Republican',
        office: 'Capitol Office: (916) 319-2007',
        phone: '(916) 319-2007',
        website: 'https://ad07.asmrc.org',
      },
      {
        title: 'CA State Senate (District 6)',
        name: 'Sen. Roger Niello',
        party: 'Republican',
        office: 'Capitol Office: (916) 651-4006',
        phone: '(916) 651-4006',
        website: 'https://sr06.senate.ca.gov',
      },
      {
        title: 'Sacramento County Supervisor (Dist 3)',
        name: 'Supervisor Rich Desmond',
        party: 'Nonpartisan',
        office: 'Sacramento County Administration',
        phone: '(916) 874-5471',
        website: 'https://bos.saccounty.gov/District3',
        notes: 'Oversees Fair Oaks, Carmichael, and Arden-Arcade county services.',
      },
    ],
  },
  '95608': {
    zip: '95608',
    city: 'Carmichael',
    county: 'Sacramento County',
    congressionalDistrict: 'California Congressional District 6 (CA-06)',
    officials: [
      {
        title: 'U.S. Representative (CA-06)',
        name: 'Rep. Ami Bera, M.D.',
        party: 'Democrat',
        office: 'Sacramento / D.C.',
        phone: '(916) 635-0505',
        website: 'https://bera.house.gov',
        notes: 'Serves Carmichael, Fair Oaks, and Rancho Cordova.',
      },
      {
        title: 'U.S. Senator',
        name: 'Sen. Alex Padilla',
        party: 'Democrat',
        office: 'Sacramento: (916) 448-2787',
        phone: '(916) 448-2787',
        website: 'https://padilla.senate.gov',
      },
      {
        title: 'U.S. Senator',
        name: 'Sen. Laphonza Butler',
        party: 'Democrat',
        office: 'D.C. Office: (202) 224-3841',
        phone: '(202) 224-3841',
        website: 'https://butler.senate.gov',
      },
      {
        title: 'CA State Assembly (District 7)',
        name: 'Asm. Josh Hoover',
        party: 'Republican',
        office: 'Capitol Office: (916) 319-2007',
        phone: '(916) 319-2007',
        website: 'https://ad07.asmrc.org',
      },
      {
        title: 'Sacramento County Supervisor (Dist 3)',
        name: 'Supervisor Rich Desmond',
        party: 'Nonpartisan',
        office: 'County Board of Supervisors',
        phone: '(916) 874-5471',
        website: 'https://bos.saccounty.gov/District3',
      },
    ],
  },
  '95662': {
    zip: '95662',
    city: 'Orangevale',
    county: 'Sacramento County',
    congressionalDistrict: 'California Congressional District 3 (CA-03)',
    officials: [
      {
        title: 'U.S. Representative (CA-03)',
        name: 'Rep. Kevin Kiley',
        party: 'Republican',
        office: 'Rocklin: (916) 724-2575 • D.C.: (202) 225-2523',
        phone: '(916) 724-2575',
        website: 'https://kiley.house.gov',
        notes: 'Target competitive swing seat in Sacramento / Sierra foothills.',
      },
      {
        title: 'U.S. Senator',
        name: 'Sen. Alex Padilla',
        party: 'Democrat',
        office: 'Sacramento: (916) 448-2787',
        phone: '(916) 448-2787',
        website: 'https://padilla.senate.gov',
      },
      {
        title: 'U.S. Senator',
        name: 'Sen. Laphonza Butler',
        party: 'Democrat',
        office: 'D.C. Office: (202) 224-3841',
        phone: '(202) 224-3841',
        website: 'https://butler.senate.gov',
      },
      {
        title: 'CA State Assembly (District 7)',
        name: 'Asm. Josh Hoover',
        party: 'Republican',
        office: 'Capitol Office: (916) 319-2007',
        phone: '(916) 319-2007',
        website: 'https://ad07.asmrc.org',
      },
    ],
  },
};

export function SacramentoRepresentativeFinder() {
  const [zipInput, setZipInput] = useState('95628');
  const [activeDistrict, setActiveDistrict] = useState<DistrictInfo>(DISTRICT_DATABASE['95628']);
  const [copiedScript, setCopiedScript] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<'voting' | 'democracy' | 'environment'>(
    'voting'
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = zipInput.trim();
    if (DISTRICT_DATABASE[clean]) {
      setActiveDistrict(DISTRICT_DATABASE[clean]);
    } else {
      // Fallback with regional senators
      setActiveDistrict({
        zip: clean,
        city: 'Sacramento Region',
        county: 'Sacramento County',
        congressionalDistrict: 'California Congressional District 6 & 3',
        officials: DISTRICT_DATABASE['95628'].officials,
      });
    }
  };

  const getCallScript = () => {
    if (selectedIssue === 'voting') {
      return `Hello, my name is [Your Name], and I am a constituent living in ${activeDistrict.city} at ZIP code ${activeDistrict.zip}. I am calling today to urge you to protect the freedom to vote by supporting federal protections against voter suppression, safeguarding election workers, and opposing any efforts to restrict mail-in voting. Thank you for your service and for representing our community.`;
    }
    if (selectedIssue === 'democracy') {
      return `Hello, my name is [Your Name], and I am a constituent living in ${activeDistrict.city} (ZIP ${activeDistrict.zip}). I am calling to urge you to uphold democratic norms, protect judicial ethics and constitutional checks and balances, and ensure accountability under the rule of law. Our community depends on your leadership. Thank you.`;
    }
    return `Hello, my name is [Your Name], a constituent in ${activeDistrict.city} (ZIP ${activeDistrict.zip}). I am calling to urge robust funding and support for local clean energy initiatives, water conservation, and climate resilience for Sacramento County and Northern California. Thank you.`;
  };

  const copyScript = () => {
    navigator.clipboard.writeText(getCallScript());
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="rounded-3xl bg-secondary border border-white/10 p-6 sm:p-8 md:p-10 shadow-2xl backdrop-blur-xl">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-bright/20 text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4">
          <MapPin size={14} className="text-accent-gold" />
          <span>Instant District & Representative Finder</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
          Know Your Representatives & Hold Them Accountable
        </h2>
        <p className="text-sm sm:text-base text-ink-on-dark leading-relaxed mb-8">
          Enter your local ZIP code to instantly find your federal, state, and county elected
          officials, complete with verified direct phone numbers and constituent advocacy scripts.
        </p>

        {/* ZIP Search Input */}
        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row items-stretch gap-3 mb-8"
        >
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted-on-dark"
              size={18}
            />
            <input
              type="text"
              pattern="[0-9]{5}"
              maxLength={5}
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              placeholder="Enter ZIP (e.g. 95628, 95608, 95662)"
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-secondary border border-slate-700 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3.5 rounded-xl bg-primary-bright hover:bg-primary-light text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all shrink-0 hover:scale-[1.02]"
          >
            Find Officials
          </button>
        </form>

        {/* Current District Header */}
        <div className="p-4 rounded-2xl bg-secondary border border-white/10 mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-accent-gold uppercase tracking-wide">
              Selected Community:
            </div>
            <div className="text-lg font-bold text-white">
              {activeDistrict.city}, CA ({activeDistrict.zip})
            </div>
          </div>
          <div className="text-xs text-ink-muted-on-dark font-mono">
            {activeDistrict.congressionalDistrict}
          </div>
        </div>

        {/* Representatives Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {activeDistrict.officials.map((official) => (
            <div
              key={official.name}
              className="p-5 rounded-2xl bg-secondary border border-white/10/80 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-mono text-ink-muted-on-dark text-[11px]">
                    {official.title}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      official.party === 'Democrat'
                        ? 'bg-primary-bright/20 text-primary-on-dark'
                        : official.party === 'Republican'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-slate-700 text-ink-on-dark'
                    }`}
                  >
                    {official.party}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-1">{official.name}</h3>
                {official.notes && (
                  <p className="text-xs text-ink-muted-on-dark mb-3">{official.notes}</p>
                )}
              </div>

              <div className="pt-4 border-t border-white/10/60 flex items-center justify-between gap-2">
                <a
                  href={`tel:${official.phone.replace(/[^0-9]/g, '')}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-mono font-semibold transition-colors"
                >
                  <Phone size={12} />
                  <span>{official.phone.split('•')[0].trim()}</span>
                </a>
                <a
                  href={official.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-ink-muted-on-dark hover:text-white hover:bg-white/5 transition-colors"
                  aria-label={`Official website for ${official.name}`}
                >
                  <ExternalLink size={15} />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* 5 Calls Constituent Phone Script Generator */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-primary-bright/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="text-xs font-mono text-accent-gold uppercase tracking-wider font-bold mb-1">
                Civic Action Phone Script
              </div>
              <h4 className="text-base font-bold text-white">What To Say When You Call</h4>
            </div>

            {/* Issue Selector Tabs */}
            <div className="flex items-center gap-1 p-1 bg-secondary rounded-xl border border-white/10 text-xs font-medium">
              <button
                type="button"
                onClick={() => setSelectedIssue('voting')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  selectedIssue === 'voting'
                    ? 'bg-primary-bright text-white'
                    : 'text-ink-muted-on-dark hover:text-white'
                }`}
              >
                Voting Rights
              </button>
              <button
                type="button"
                onClick={() => setSelectedIssue('democracy')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  selectedIssue === 'democracy'
                    ? 'bg-primary-bright text-white'
                    : 'text-ink-muted-on-dark hover:text-white'
                }`}
              >
                Democracy
              </button>
              <button
                type="button"
                onClick={() => setSelectedIssue('environment')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  selectedIssue === 'environment'
                    ? 'bg-primary-bright text-white'
                    : 'text-ink-muted-on-dark hover:text-white'
                }`}
              >
                Climate
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-secondary border border-white/10 font-sans text-xs sm:text-sm text-slate-200 leading-relaxed mb-4 relative">
            &ldquo;{getCallScript()}&rdquo;
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted-on-dark">
              💡 Staffers tally calls by topic daily. 2 minutes makes a measurable difference!
            </span>
            <button
              type="button"
              onClick={copyScript}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all shrink-0"
            >
              {copiedScript ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Script</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
