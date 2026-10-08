export type BlockType = 'header' | 'text' | 'callout' | 'button' | 'event' | 'divider' | 'signoff';

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

export type ComposerBlock =
  | HeaderBlock
  | TextBlock
  | CalloutBlock
  | ButtonBlock
  | EventBlock
  | DividerBlock
  | SignoffBlock;

export interface ComposerTemplate {
  id: string;
  name: string;
  description: string;
  badge: string;
  subject: string;
  blocks: ComposerBlock[];
}
