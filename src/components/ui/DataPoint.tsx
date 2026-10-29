'use client';

import type React from 'react';
import { useDataPoints } from '@/hooks/useDataPoints';

interface DataPointProps extends React.HTMLAttributes<HTMLElement> {
  name: string;
  fallback?: React.ReactNode;
  as?: React.ElementType;
  group?: string;
  children?: React.ReactNode;
  initialData?: Record<string, string>;
}

/**
 * Renders a data point stored in Supabase and fetched via Edge API functions.
 * Emits data-data-point attribute so the Visual Editor can edit the text directly
 * without altering JSX classes, layout or visual styling.
 */
const GROUP_ALIASES: Record<string, string> = {
  product: 'products',
  link: 'links',
  faq: 'faqs',
  partner: 'partners',
  term: 'terms',
};

export function DataPoint({
  name,
  fallback,
  as: Component = 'span',
  group,
  children,
  className,
  initialData,
  ...props
}: DataPointProps) {
  const rawGroup = group || name.split('.')[0] || 'general';
  const computedGroup = GROUP_ALIASES[rawGroup.toLowerCase()] || rawGroup;
  const { dataPoints } = useDataPoints(computedGroup, initialData);

  const content = dataPoints[name] || fallback || children;

  return (
    <Component data-data-point={name} className={className} {...props}>
      {content}
    </Component>
  );
}
