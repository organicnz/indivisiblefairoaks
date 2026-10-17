'use client';

import { useCallback, useEffect, useState } from 'react';
import { getDataPoints } from '@/lib/queries/civic-client';

/**
 * React hook to fetch and reactively sync data points from Supabase via Edge API functions.
 * Listens for local visual-edit save events for real-time instantaneous DOM synchronization.
 */
export function useDataPoints(group?: string, initialData: Record<string, string> = {}) {
  const [dataPoints, setDataPoints] = useState<Record<string, string>>(initialData);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchLive = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getDataPoints(group);
      if (res?.dataPoints && Object.keys(res.dataPoints).length > 0) {
        setDataPoints((prev) => ({
          ...prev,
          ...res.dataPoints,
        }));
      }
    } catch {
      // Fallback cleanly to initialData without throwing
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    // Fetch live data points from Edge API route on client mount
    void fetchLive();

    const handleSaved = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string; value: string }>;
      if (customEvent.detail?.key) {
        const { key, value } = customEvent.detail;
        const aliases: Record<string, string> = {
          product: 'products',
          products: 'products',
          link: 'links',
          links: 'links',
          faq: 'faqs',
          faqs: 'faqs',
          partner: 'partners',
          partners: 'partners',
          term: 'terms',
          terms: 'terms',
        };
        const keyGroup = key.split('.')[0] || '';
        const normKeyGroup = aliases[keyGroup] || keyGroup;
        const normHookGroup = group ? aliases[group] || group : '';
        if (
          !group ||
          key.startsWith(`${group}.`) ||
          (normHookGroup && normKeyGroup === normHookGroup)
        ) {
          setDataPoints((prev) => ({
            ...prev,
            [key]: value,
          }));
        }
      }
    };

    window.addEventListener('data-point-saved', handleSaved);
    return () => {
      window.removeEventListener('data-point-saved', handleSaved);
    };
  }, [group, fetchLive]);

  const get = useCallback(
    (key: string, fallback = ''): string => {
      return dataPoints[key] ?? fallback;
    },
    [dataPoints]
  );

  return { dataPoints, get, loading, refresh: fetchLive };
}
