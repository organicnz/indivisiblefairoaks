'use client';

import type React from 'react';
import { useDataPoints } from '@/hooks/useDataPoints';
import { dataPointGroup } from '@/lib/data-point-groups';

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
  const computedGroup = dataPointGroup(group || name);
  const { dataPoints } = useDataPoints(computedGroup, initialData);

  const rawVal = dataPoints[name];
  const content = rawVal && rawVal.trim() !== '' ? rawVal : fallback || children;

  return (
    <Component data-data-point={name} className={className} {...props}>
      {content}
    </Component>
  );
}
