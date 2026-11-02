'use client';

import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Music,
  PhoneCall,
  Printer,
  Users,
} from 'lucide-react';
import { useState } from 'react';

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
  downloadUrl: string;
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
    downloadUrl: 'https://drive.google.com/open?id=1cugSjV00M6yL3e414nUq8j2hC9H-Kq6L',
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
    downloadUrl: 'https://drive.google.com/open?id=1cugSjV00M6yL3e414nUq8j2hC9H-Kq6L',
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
    downloadUrl: 'https://drive.google.com/open?id=1cugSjV00M6yL3e414nUq8j2hC9H-Kq6L',
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
    downloadUrl: 'https://drive.google.com/open?id=1cugSjV00M6yL3e414nUq8j2hC9H-Kq6L',
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
          <h2 className="text-2xl font-black text-foreground dark:text-white tracking-tight flex items-center gap-2">
            <span className="text-primary-ink dark:text-primary-on-dark-muted font-mono text-xl">
              ✦
            </span>
            <span>Meeting Reviews &amp; Printable Handouts</span>
          </h2>
          <p className="text-sm text-muted-foreground dark:text-ink-on-dark mt-1">
            Official monthly meeting summaries, steering committee recaps, and downloadable materials
            distributed at chapter gatherings.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="inline-flex rounded-xl bg-surface-muted p-1 border border-border shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'reviews'
                ? 'bg-surface-card text-foreground dark:text-white shadow-xs'
                : 'text-muted-foreground dark:text-ink-on-dark hover:text-foreground'
            }`}
            aria-pressed={activeTab === 'reviews'}
          >
            Meeting Reviews
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('handouts')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'handouts'
                ? 'bg-surface-card text-foreground dark:text-white shadow-xs'
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
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground dark:text-ink-muted-on-dark px-1">
              Select Chapter Meeting
            </p>
            {MEETING_REVIEWS.map((review) => {
              const isSelected = selectedReview.id === review.id;
              return (
                <button
                  key={review.id}
                  type="button"
                  onClick={() => setSelectedReview(review)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-foreground dark:bg-primary-bright/15 dark:border-primary-on-dark-muted shadow-xs'
                      : 'bg-surface-card border-border text-foreground hover:bg-surface-muted/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground dark:text-ink-on-dark mb-1">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={13} className="text-accent-gold" />
                      {review.date}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-surface-muted border border-border">
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

            {/* Google Drive Archive Link */}
            <a
              href="https://drive.google.com/open?id=1cugSjV00M6yL3e414nUq8j2hC9H-Kq6L"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-between p-3.5 rounded-xl border border-dashed border-border hover:border-primary/50 bg-surface-card hover:bg-surface-muted/40 text-xs font-bold text-foreground transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <FolderOpen size={16} className="text-accent-gold" />
                <span>Browse Full Meeting Minutes &amp; Archive on Drive</span>
              </div>
              <ExternalLink
                size={14}
                className="text-muted-foreground group-hover:text-primary transition-colors"
              />
            </a>
          </div>

          {/* Right: Selected Meeting Deep Dive */}
          <div className="lg:col-span-7 p-6 rounded-2xl bg-surface-card border border-border shadow-xs space-y-6">
            <div className="border-b border-border pb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-primary-ink dark:text-primary-on-dark-muted uppercase tracking-wider mb-2">
                <Calendar size={14} />
                <span>{selectedReview.date}</span>
                <span>•</span>
                <span>{selectedReview.location}</span>
              </div>
              <h3 className="text-xl font-black text-foreground dark:text-white tracking-tight">
                {selectedReview.title}
              </h3>
              <p className="text-sm text-muted-foreground dark:text-ink-on-dark mt-2 leading-relaxed">
                {selectedReview.summary}
              </p>
            </div>

            {/* Key Discussion Points */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-primary-ink dark:text-accent-gold flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Key Motions &amp; Discussion Points
              </h4>
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
              <h4 className="text-xs font-black uppercase tracking-wider text-secondary-ink dark:text-primary-on-dark-muted flex items-center gap-1.5">
                <FileSpreadsheet size={14} />
                Next Steps &amp; Member Action Items
              </h4>
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
                href="https://drive.google.com/open?id=1cugSjV00M6yL3e414nUq8j2hC9H-Kq6L"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold text-xs uppercase tracking-wider transition-colors"
              >
                <Download size={14} />
                <span>Download Full Minutes (PDF)</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Printable Handouts */}
      {activeTab === 'handouts' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground dark:text-ink-on-dark flex items-start gap-3">
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
                className="p-6 rounded-2xl bg-surface-card border border-border shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-surface-muted border border-border">
                        {renderIcon(handout.iconName)}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-ink-on-dark">
                        {handout.category}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-surface-muted border border-border text-muted-foreground dark:text-ink-on-dark">
                      {handout.pages} • {handout.format}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-foreground dark:text-white">
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
                    href={handout.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    <Download size={14} />
                    <span>Download PDF</span>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Additional Drive Repository Card */}
          <div className="p-6 rounded-2xl bg-surface-muted border border-dashed border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FolderOpen size={24} className="text-accent-gold shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-foreground dark:text-white">
                  Looking for past meeting slide decks, signs, or flyers?
                </h4>
                <p className="text-xs text-muted-foreground dark:text-ink-on-dark mt-0.5">
                  Our shared Google Drive contains all chapter collateral since 2017.
                </p>
              </div>
            </div>
            <a
              href="https://drive.google.com/open?id=1cugSjV00M6yL3e414nUq8j2hC9H-Kq6L"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-card hover:bg-surface-card/80 border border-border text-foreground font-bold text-xs uppercase tracking-wider transition-all shrink-0 shadow-xs"
            >
              <span>Open Handouts Drive</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
