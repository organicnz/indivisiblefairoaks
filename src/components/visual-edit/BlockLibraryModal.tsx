'use client';

import {
  AlertTriangle,
  Calendar,
  Code,
  Heading,
  HeartHandshake,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Search,
  Sparkles,
  Table,
  Type,
  Users,
  X,
} from 'lucide-react';
import type React from 'react';
import { useId, useMemo, useState } from 'react';
import type { Block, HeadingLevel } from '@/lib/blocks';
import type { VisualComposerBlockCategory } from '@/types/unified';

export interface BlockTemplate {
  id: string;
  category: VisualComposerBlockCategory;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  createBlock: () => Omit<Block, 'id'>;
}

export const BLOCK_TEMPLATES: BlockTemplate[] = [
  // Typography
  {
    id: 'h1',
    category: 'Typography',
    title: 'Hero Heading H1',
    description: 'Page hero heading with dominant typography for major campaigns',
    icon: Heading,
    createBlock: () => ({
      type: 'heading',
      level: 1 as HeadingLevel,
      html: 'Empowering Community & Democracy',
    }),
  },
  {
    id: 'h2',
    category: 'Typography',
    title: 'Heading H2',
    description: 'Major section heading for organizing key civic themes',
    icon: Heading,
    createBlock: () => ({ type: 'heading', level: 2 as HeadingLevel, html: 'New Section Heading' }),
  },
  {
    id: 'h3',
    category: 'Typography',
    title: 'Subheading H3',
    description: 'Subsection header for topics, dates, or grouped details',
    icon: Heading,
    createBlock: () => ({ type: 'heading', level: 3 as HeadingLevel, html: 'Subsection Title' }),
  },
  {
    id: 'h4',
    category: 'Typography',
    title: 'Detail Heading H4',
    description: 'Compact subsection heading for agenda topics, dates, or card titles',
    icon: Heading,
    createBlock: () => ({ type: 'heading', level: 4 as HeadingLevel, html: 'Key Meeting Details' }),
  },
  {
    id: 'paragraph',
    category: 'Typography',
    title: 'Body Text',
    description: 'Standard paragraph text supporting rich HTML & inline formatting',
    icon: Type,
    createBlock: () => ({
      type: 'paragraph',
      html: 'Enter your community message, legislative update, or event context here.',
    }),
  },
  {
    id: 'quote',
    category: 'Typography',
    title: 'Blockquote',
    description: 'Highlighted quotation or civic testimony with gold accent border',
    icon: Quote,
    createBlock: () => ({
      type: 'quote',
      html: 'Democracy is not a spectator sport — it belongs to all of us who show up.',
    }),
  },
  {
    id: 'code',
    category: 'Typography',
    title: 'Code / Monospace Block',
    description: 'Pre-formatted snippet or verbatim technical instructions',
    icon: Code,
    createBlock: () => ({
      type: 'code',
      text: 'bun --bun tsrs --noEmit',
    }),
  },

  // Media
  {
    id: 'image',
    category: 'Media',
    title: 'Supabase S3 Image',
    description: 'Responsive figure with caption and direct media library integration',
    icon: ImageIcon,
    createBlock: () => ({
      type: 'image',
      src: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80',
      alt: 'Civic community gathering',
      caption: 'Indivisible Fair Oaks & Carmichael community members at our monthly rally.',
      width: 1200,
      height: 800,
    }),
  },
  {
    id: 'divider',
    category: 'Media',
    title: 'Horizontal Divider',
    description: 'Subtle clean separator to segment distinct sections',
    icon: Minus,
    createBlock: () => ({
      type: 'divider',
    }),
  },

  // Action
  {
    id: 'button',
    category: 'Action',
    title: 'Action Button CTA',
    description: 'Prominent call-to-action button linked to events, donations, or contact',
    icon: LinkIcon,
    createBlock: () => ({
      type: 'button',
      label: 'Take Civic Action Now',
      href: '/contact?topic=action',
    }),
  },
  {
    id: 'button-donate',
    category: 'Action',
    title: 'Grassroots Donation CTA',
    description: 'Direct fundraising action button for community resilience',
    icon: HeartHandshake,
    createBlock: () => ({
      type: 'button',
      label: 'Support Grassroots Democracy',
      href: '/donate',
    }),
  },
  {
    id: 'button-events',
    category: 'Action',
    title: 'Civic Calendar CTA',
    description: 'Direct navigation button to upcoming rallies and town halls',
    icon: Calendar,
    createBlock: () => ({
      type: 'button',
      label: 'Browse Upcoming Events',
      href: '/events',
    }),
  },
  {
    id: 'button-volunteer',
    category: 'Action',
    title: 'Volunteer Signup CTA',
    description: 'Call-to-action button to recruit active community volunteers',
    icon: Users,
    createBlock: () => ({
      type: 'button',
      label: 'Join Our Volunteer Team',
      href: '/contact?topic=volunteer',
    }),
  },
  {
    id: 'callout-info',
    category: 'Action',
    title: 'Info Callout Box',
    description: 'Highlighted banner with informational background',
    icon: Layers,
    createBlock: () => ({
      type: 'callout',
      tone: 'info',
      html: '<strong>Important Update:</strong> Our next general meeting is this Thursday at 6:30 PM.',
    }),
  },
  {
    id: 'callout-action',
    category: 'Action',
    title: 'Civic Mobilization Banner',
    description: 'Urgent callout styled for rallies, voting deadlines, or petitions',
    icon: Sparkles,
    createBlock: () => ({
      type: 'callout',
      tone: 'action',
      html: '<strong>Urgent Action:</strong> Call your representative today to defend local democracy.',
    }),
  },
  {
    id: 'callout-warning',
    category: 'Action',
    title: 'Community Alert',
    description: 'High-visibility alert banner for crucial deadline notices',
    icon: AlertTriangle,
    createBlock: () => ({
      type: 'callout',
      tone: 'warning',
      html: '<strong>Voter Registration Deadline:</strong> Ensure your registration is current before election week.',
    }),
  },
  {
    id: 'callout-tip',
    category: 'Action',
    title: 'Pro Organizer Tip',
    description: 'Actionable organizing tip with positive emerald styling',
    icon: Lightbulb,
    createBlock: () => ({
      type: 'callout',
      tone: 'tip',
      html: '<strong>Organizer Tip:</strong> Arrive 15 minutes before town halls to connect with fellow community liaisons.',
    }),
  },

  // Structure
  {
    id: 'bulletList',
    category: 'Structure',
    title: 'Bulleted Key Points',
    description: 'Unordered list for policies, attendee benefits, or agendas',
    icon: List,
    createBlock: () => ({
      type: 'bulletList',
      items: [
        'Organize grassroots voting registration drives',
        'Hold elected representatives accountable with public forums',
        'Coordinate peaceful community rallies and educational workshops',
      ],
    }),
  },
  {
    id: 'orderedList',
    category: 'Structure',
    title: 'Numbered Steps',
    description: 'Sequential walkthrough for action steps or guides',
    icon: ListOrdered,
    createBlock: () => ({
      type: 'orderedList',
      items: [
        'Check your voter registration status online',
        'Find your local polling place or ballot drop box',
        'Cast your ballot and encourage three neighbors to vote',
      ],
    }),
  },
  {
    id: 'table',
    category: 'Structure',
    title: 'Data Table Grid',
    description: 'Structured rows and columns for schedules, rosters, or metrics',
    icon: Table,
    createBlock: () => ({
      type: 'table',
      head: ['Event', 'Date', 'Location', 'Status'],
      rows: [
        ['Community Rally', 'Nov 2, 10:00 AM', 'Fair Oaks Park', 'Confirmed'],
        ['Civic Phone Bank', 'Nov 4, 5:30 PM', 'Carmichael Library', 'Open'],
        ['Post-Election Debrief', 'Nov 8, 7:00 PM', 'Online Zoom', 'RSVP Required'],
      ],
    }),
  },
];

interface BlockLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onInsertBlock: (template: BlockTemplate, targetIndex?: number) => void;
  insertTargetIndex?: number | null;
}

export function BlockLibraryModal({
  open,
  onClose,
  onInsertBlock,
  insertTargetIndex,
}: BlockLibraryModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const titleId = useId();
  const descId = useId();

  const categories = ['All', 'Typography', 'Media', 'Action', 'Structure'];

  const filteredTemplates = useMemo(() => {
    const q = search.toLowerCase().trim();
    return BLOCK_TEMPLATES.filter((t) => {
      const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-[10020] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in-0 pointer-events-auto"
    >
      <div className="flex flex-col w-full max-w-3xl max-h-[85vh] rounded-3xl border border-white/20 bg-slate-950/95 text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-gold/20 text-accent-gold">
              <Layers size={18} />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-bold text-white tracking-wide">
                Visual Composer Element Library
              </h2>
              <p id={descId} className="text-xs text-slate-400">
                {insertTargetIndex !== null && insertTargetIndex !== undefined
                  ? `Insert element above block #${insertTargetIndex + 1}`
                  : 'Select an element to insert into the page layout'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Element Library"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="border-b border-white/10 bg-slate-900/60 p-4 space-y-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3.5 top-3 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              aria-label="Search elements"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search elements (e.g. heading, button, callout, table, image)..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-xs text-white placeholder:text-white/40 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/40"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  selectedCategory === cat
                    ? 'bg-accent-gold text-ink-strong font-black'
                    : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredTemplates.map((template) => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  onInsertBlock(template, insertTargetIndex ?? undefined);
                  onClose();
                }}
                className="group flex flex-col items-start p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-accent-gold/50 text-left transition-all duration-150 cursor-pointer"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gold/15 text-accent-gold group-hover:scale-110 transition-transform">
                    <Icon size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {template.category}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-white group-hover:text-accent-gold transition-colors mb-1">
                  {template.title}
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {template.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 bg-slate-900/80 px-6 py-3 flex items-center justify-between text-xs text-slate-400">
          <span>{filteredTemplates.length} elements available</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-1.5 font-bold text-slate-300 hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
