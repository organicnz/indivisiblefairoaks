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
  Sparkles,
  Table,
  Type,
  Users,
} from 'lucide-react';
import type React from 'react';
import type { Block, HeadingLevel } from '@/lib/blocks';
import type { VisualComposerBlockCategory } from '@/types/unified';
import { BlockLibraryPanel } from './BlockLibraryPanel';
import { ModalDialog } from './ModalDialog';

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
  if (!open) return null;

  return (
    <ModalDialog
      testId="block-library-dialog"
      ariaLabel="Visual Composer Element Library"
      onDismiss={onClose}
      backdropClassName="fixed inset-0 z-[10020] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in-0 pointer-events-auto"
      panelClassName="flex flex-col w-full max-w-3xl max-h-[85vh] rounded-3xl border border-white/20 bg-slate-950/95 text-white shadow-2xl overflow-hidden overscroll-contain"
    >
      <BlockLibraryPanel
        onInsertBlock={onInsertBlock}
        insertTargetIndex={insertTargetIndex}
        onClose={onClose}
        embedded={false}
      />
    </ModalDialog>
  );
}
