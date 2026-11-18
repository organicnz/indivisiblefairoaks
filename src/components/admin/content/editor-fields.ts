import type { ContentType } from '@/lib/content';

export interface EditorFields {
  title: string;
  slug: string;
  excerpt: string;
  type: ContentType;
  status: 'publish' | 'draft';
  featuredImage: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
}
