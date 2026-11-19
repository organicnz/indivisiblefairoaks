'use client';

import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Music,
  PhoneCall,
  Printer,
  Users,
} from 'lucide-react';
import { useState } from 'react';

// The old Drive folder these cards pointed at is no longer publicly readable
// (it returns 404). Keep the cards useful without pretending each one has its
// own downloadable file: every item now goes to the reviewed public archive.
const ARCHIVE_HREF = '/archive';

interface MeetingReview {
  id: string;
  date: string;
  title: string;
  location: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
}

const MEETING_REVIEWS: MeetingReview[] = [
  {
    id: 'oct-2026',
    date: 'October 19, 2026',
    title: 'General Chapter Meeting: Final Election Push & Ballot Strategy',
    location: 'Fair Oaks Public Library & Zoom Hybrid',
    summary:
      'Chapter members and guests convened to finalize the November general election mobilization plan, review local Sacramento County ballot measures, and coordinate poll observer coverage.',
    keyPoints: [
      'Reviewed nonpartisan analysis on local school bonds and county governance measures.',
      'Resistance Choir confirmed performance schedule at the October 24 Get-Out-The-Vote rally.',
      'Postcard committee surpassed their 5,000 voter outreach milestone across swing legislative districts.',
    ],
    actionItems: [
      'Sign up for Sacramento County Vote Center observer shifts.',
      'Pick up printed canvassing packets and door-hangers from the literature table.',
      'Submit nominations for the 2027 chapter steering committee.',
    ],
  },
  {
    id: 'sep-2026',
    date: 'September 21, 2026',
    title: 'Fall Mobilization & Candidate Forum Debrief',
    location: 'Carmichael Park Community Clubhouse',
    summary:
      'In-depth debrief of the Sacramento regional candidate debates, outreach to newly registered young voters in San Juan Unified School District, and organizing mutual aid initiatives.',
    keyPoints: [
      'Presentation by NorCal Resist coalition partners on immigrant rights and legal defense hotlines.',
      'Analysis of state legislative session outcomes signed by Governor Newsom.',
      'Voter registration table recap from the Carmichael Park Farmers Market.',
    ],
    actionItems: [
      'Distribute candidate question matrices to local neighborhood associations.',
      'Help transport senior chapter members to early voting centers starting October 26.',
    ],
  },
  {
    id: 'aug-2026',
    date: 'August 17, 2026',
    title: 'Summer Town Hall & Legislative Advocacy Review',
    location: 'Fair Oaks Public Library',
    summary:
      'Mid-summer review focused on federal democracy defense, congressional accountability call-ins via 5 Calls, and planning the fall canvassing calendar.',
    keyPoints: [
      'Coordinated with Indivisible Yolo and Sacramento chapters for joint rally logistics.',
      'Launched the revised chapter digital guide and Sacramento representative finder.',
    ],
    actionItems: [
      'Weekly phone bank shifts Tuesdays at 6:00 PM.',
      'Join choir practice Thursday evenings at Carmichael Park.',
    ],
  },
];

interface PrintableHandout {
  id: string;
  title: string;
  category: 'Flyer' | 'Script' | 'Agenda' | 'Songbook';
  description: string;
  pages: string;
  format: string;
  iconName: 'file' | 'phone' | 'users' | 'music';
}

const PRINTABLE_HANDOUTS: PrintableHandout[] = [
  {
    id: 'meeting-agenda-oct-2026',
    title: 'Chapter Meeting Agenda & Action Checklist',
    category: 'Agenda',
    description:
      'Full monthly meeting agenda, steering committee updates, upcoming action calendar, and key contact details.',
    pages: '2 Pages',
    format: 'PDF',
    iconName: 'file',
  },
  {
    id: 'phone-action-script',
    title: 'Civic Action Phone Script: Defending California Democracy',
    category: 'Script',
    description:
      'Concise representative calling script for federal and state bills, tailored for 5 Calls and direct congressional office outreach.',
    pages: '1 Page',
    format: 'PDF',
    iconName: 'phone',
  },
  {
    id: 'voter-canvass-flyer',
    title: 'Fair Oaks & Carmichael Voter Registration Walk Flyer',
    category: 'Flyer',
    description:
      'Double-sided half-page handout highlighting registration deadlines, Vote Center locations, and BallotTrax tracking.',
    pages: '2 Pages',
    format: 'PDF',
    iconName: 'users',
  },
  {
    id: 'choir-songbook-extract',
    title: 'Carmichael Resistance Choir Songbook & Chants',
    category: 'Songbook',
    description:
      'Curated sheet music excerpts, protest choruses, and call-and-response lyrics for community rallies and street actions.',
    pages: '4 Pages',
    format: 'PDF',
    iconName: 'music',
  },
];

export function MeetingMaterials() {
  const [activeTab, setActiveTab] = useState<'reviews' | 'handouts'>('reviews');
  const [selectedReview, setSelectedReview] = useState<MeetingReview>(MEETING_REVIEWS[0]);

  const renderIcon = (name: PrintableHandout['iconName']) => {
    switch (name) {
      case 'phone':
        return <PhoneCall className="text-secondary-ink dark:text-accent-gold" size={20} />;
      case 'users':
        return <Users className="text-primary-ink dark:text-primary-on-dark-muted" size={20} />;
      case 'music':
        return <Music className="text-accent-gold" size={20} />;
      default:
        return <FileText className="text-secondary-ink dark:text-accent-gold" size={20} />;
    }
  };

  return (
    <section className="space-y-8" aria-label="Meeting Materials and Archives">
      {/* Section Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <p className="civic-section-index">Chapter records</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">
            Meeting Reviews &amp; Printable Handouts
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground dark:text-ink-on-dark">
            Official monthly meeting summaries, steering committee recaps, and downloadable materials
            distributed at chapter gatherings.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="inline-flex shrink-0 border border-border bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`min-h-11 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
              activeTab === 'reviews'
                ? 'bg-primary text-white'
                : 'text-muted-foreground dark:text-ink-on-dark hover:text-foreground'
            }`}
            aria-pressed={activeTab === 'reviews'}
          >
            Meeting Reviews
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('handouts')}
            className={`min-h-11 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
              activeTab === 'handouts'
                ? 'bg-primary text-white'
                : 'text-muted-foreground dark:text-ink-on-dark hover:text-foreground'
            }`}
            aria-pressed={activeTab === 'handouts'}
          >
            Printable Handouts
          </button>
        </div>
      </div>

      {/* TAB 1: Meeting Reviews */}
      {activeTab === 'reviews' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Meeting list selector */}
          <div className="lg:col-span-5 space-y-3">
            <p className="civic-section-index px-1">
              Select Chapter Meeting
            </p>
            {MEETING_REVIEWS.map((review) => {
              const isSelected = selectedReview.id === review.id;
              return (
                <button
                  key={review.id}
                  type="button"
                  onClick={() => setSelectedReview(review)}
                  className={`w-full cursor-pointer border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-surface-card text-foreground hover:bg-surface-muted/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground dark:text-ink-on-dark mb-1">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={13} className="text-accent-gold" />
                      {review.date}
                    </span>
                    <span className="border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                      Recap
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-foreground dark:text-white line-clamp-1">
                    {review.title}
                  </h3>
                  <p className="text-xs text-muted-foreground dark:text-ink-on-dark mt-1 line-clamp-2">
                    {review.summary}
                  </p>
                </button>
              );
            })}

            {/* Legacy archive link */}
            <a
              href={ARCHIVE_HREF}
              className="group mt-4 flex items-center justify-between border border-border bg-surface-card p-4 text-xs font-bold text-foreground transition-colors hover:border-primary/50 hover:bg-surface-muted/40"
            >
              <div className="flex items-center gap-2.5">
                <FolderOpen size={16} className="text-accent-gold" />
                <span>Browse Full Meeting Minutes &amp; Archive</span>
              </div>
              <ChevronRight
                size={14}
                className="text-muted-foreground group-hover:text-primary transition-colors"
              />
            </a>
          </div>

          {/* Right: Selected Meeting Deep Dive */}
          <div className="civic-panel space-y-6 p-6 lg:col-span-7">
            <div className="border-b border-border pb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-primary-ink dark:text-primary-on-dark-muted uppercase tracking-wider mb-2">
                <Calendar size={14} />
                <span>{selectedReview.date}</span>
                <span>•</span>
                <span>{selectedReview.location}</span>
              </div>
              <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">
                {selectedReview.title}
              </h3>
              <p className="text-sm text-muted-foreground dark:text-ink-on-dark mt-2 leading-relaxed">
                {selectedReview.summary}
              </p>
            </div>

            {/* Key Discussion Points */}
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-primary-ink dark:text-accent-gold">
                <CheckCircle2 size={14} />
                Key Motions &amp; Discussion Points
              </p>
              <ul className="space-y-2">
                {selectedReview.keyPoints.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-xs sm:text-sm text-foreground/90 dark:text-ink-on-dark"
                  >
                    <ChevronRight size={14} className="text-primary mt-0.5 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Items */}
            <div className="space-y-3 pt-2">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-secondary-ink dark:text-primary-on-dark-muted">
                <FileSpreadsheet size={14} />
                Next Steps &amp; Member Action Items
              </p>
              <ul className="space-y-2">
                {selectedReview.actionItems.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-xs sm:text-sm text-foreground/90 dark:text-ink-on-dark"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-gold mt-2 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground dark:text-ink-muted-on-dark">
                Official records maintained by the Steering Committee
              </span>
              <a
                href={ARCHIVE_HREF}
                className="inline-flex min-h-11 items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
              >
                <FolderOpen size={14} />
                <span>Browse Archive</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Printable Handouts */}
      {activeTab === 'handouts' && (
        <div className="space-y-6">
          <div className="flex items-start gap-3 border border-primary/20 bg-primary/5 p-4 text-xs text-foreground dark:text-ink-on-dark">
            <Printer className="text-accent-gold shrink-0 mt-0.5" size={18} />
            <p className="leading-relaxed">
              These materials are formatted for standard 8.5&quot; × 11&quot; letter printing. Use
              them for monthly meetings, community canvassing tables, or door-to-door neighbor
              conversations. Need physical copies pre-printed? Ask Christiana or chapter leadership
              at the sign-in desk.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PRINTABLE_HANDOUTS.map((handout) => (
              <div
                key={handout.id}
                className="civic-panel civic-card-lift flex flex-col justify-between p-6 hover:border-primary/40"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="border border-border bg-surface-muted p-2">
                        {renderIcon(handout.iconName)}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-ink-on-dark">
                        {handout.category}
                      </span>
                    </div>
                    <span className="border border-border bg-surface-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground dark:text-ink-on-dark">
                      {handout.pages} • {handout.format}
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">
                    {handout.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                    {handout.description}
                  </p>
                </div>

                <div className="pt-6 mt-4 border-t border-border flex items-center justify-between gap-4">
                  <span className="text-[11px] text-muted-foreground dark:text-ink-muted-on-dark">
                    Ready for Print &amp; Distribution
                  </span>
                  <a
                    href={ARCHIVE_HREF}
                    className="inline-flex min-h-11 items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
                  >
                    <FolderOpen size={14} />
                    <span>Browse Archive</span>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Archive repository card */}
          <div className="flex flex-col items-center justify-between gap-4 border border-border bg-surface-muted p-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <FolderOpen size={24} className="text-accent-gold shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-foreground dark:text-white">
                  Looking for past meeting slide decks, signs, or flyers?
                </h4>
                <p className="text-xs text-muted-foreground dark:text-ink-on-dark mt-0.5">
                  The chapter archive preserves public collateral from the old site.
                </p>
              </div>
            </div>
            <a
              href={ARCHIVE_HREF}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 border border-border bg-surface-card px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary/40"
            >
              <span>Browse Archive</span>
              <ChevronRight size={14} />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
