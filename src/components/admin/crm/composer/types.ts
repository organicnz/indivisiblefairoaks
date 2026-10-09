export type BlockType =
  | 'header'
  | 'text'
  | 'callout'
  | 'button'
  | 'event'
  | 'divider'
  | 'signoff'
  | 'image'
  | 'quote'
  | 'stat'
  | 'list'
  | 'social';

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface HeaderBlock extends BaseBlock {
  type: 'header';
  eyebrow?: string;
  heading: string;
  level?: 1 | 2;
}

export interface TextBlock extends BaseBlock {
  type: 'text';
  content: string;
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  title?: string;
  text: string;
  variant?: 'info' | 'alert' | 'success';
}

export interface ButtonBlock extends BaseBlock {
  type: 'button';
  label: string;
  url: string;
  variant?: 'primary' | 'accent' | 'outline';
}

export interface EventBlock extends BaseBlock {
  type: 'event';
  title: string;
  date: string;
  time?: string;
  location: string;
  rsvpUrl?: string;
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
}

export interface SignoffBlock extends BaseBlock {
  type: 'signoff';
  closing: string;
  sender: string;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  url: string;
  alt: string;
  caption?: string;
  linkUrl?: string;
  alignment?: 'left' | 'center' | 'right' | 'full';
}

export interface QuoteBlock extends BaseBlock {
  type: 'quote';
  quote: string;
  author: string;
  role?: string;
}

export interface StatBlock extends BaseBlock {
  type: 'stat';
  value: string;
  label: string;
  description?: string;
  variant?: 'primary' | 'accent' | 'emerald';
}

export interface ListBlock extends BaseBlock {
  type: 'list';
  style: 'bullet' | 'numbered';
  items: string[];
}

export type SocialPlatform =
  | 'website'
  | 'actblue'
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'substack';

export interface SocialLinkItem {
  platform: SocialPlatform;
  url: string;
  label?: string;
}

export interface SocialBlock extends BaseBlock {
  type: 'social';
  heading?: string;
  channels: SocialLinkItem[];
}

export type ComposerBlock =
  | HeaderBlock
  | TextBlock
  | CalloutBlock
  | ButtonBlock
  | EventBlock
  | DividerBlock
  | SignoffBlock
  | ImageBlock
  | QuoteBlock
  | StatBlock
  | ListBlock
  | SocialBlock;

export interface ComposerTemplate {
  id: string;
  name: string;
  description: string;
  badge: string;
  subject: string;
  blocks: ComposerBlock[];
}
