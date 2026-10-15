/**
 * Civic data fetchers safe to call from Client Components.
 * Fetches directly through Edge API routes without exposing database clients to the browser.
 */
import type { CoalitionLinkRow, DataPointRow, FAQRow, PartnerRow } from './civic';

export async function getTickerEvents(): Promise<
  { label: string; detail: string; href: string; badge: string }[]
> {
  try {
    const res = await fetch('/api/civic/events');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.events)) {
        return json.events.map(
          (e: { title: string; dateLabel: string; timeLabel: string; category: string }) => ({
            label: e.title,
            detail: `${e.dateLabel} • ${e.timeLabel}`,
            href: '/events',
            badge: e.category,
          })
        );
      }
    }
  } catch (err) {
    console.error('Error fetching ticker events via Edge API:', err);
  }
  return [];
}

export async function getFaqs(): Promise<{ faqs: FAQRow[]; categories: string[] }> {
  try {
    const res = await fetch('/api/faqs');
    if (res.ok) {
      const json = await res.json();
      return {
        faqs: Array.isArray(json.faqs) ? json.faqs : [],
        categories: Array.isArray(json.categories) ? json.categories : [],
      };
    }
  } catch (err) {
    console.error('Error fetching FAQs via Edge API:', err);
  }
  return { faqs: [], categories: [] };
}

export async function getPartners(): Promise<PartnerRow[]> {
  try {
    const res = await fetch('/api/partners');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.partners)) {
        return json.partners;
      }
    }
  } catch (err) {
    console.error('Error fetching partners via Edge API:', err);
  }
  return [];
}

export async function getCoalitionLinks(): Promise<CoalitionLinkRow[]> {
  try {
    const res = await fetch('/api/coalition-links');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.links)) {
        return json.links;
      }
    }
  } catch (err) {
    console.error('Error fetching coalition links via Edge API:', err);
  }
  return [];
}

export async function getDataPoints(
  group?: string
): Promise<{ dataPoints: Record<string, string>; rows: DataPointRow[] }> {
  try {
    const url = group ? `/api/data-points?group=${encodeURIComponent(group)}` : '/api/data-points';
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      return {
        dataPoints: json.dataPoints || {},
        rows: Array.isArray(json.rows) ? json.rows : [],
      };
    }
  } catch (err) {
    console.error('Error fetching data points via Edge API:', err);
  }
  return { dataPoints: {}, rows: [] };
}

export async function saveDataPoint(payload: {
  key: string;
  value: string;
  group_name?: string;
  label?: string;
}): Promise<{ success: boolean; dataPoint?: DataPointRow; error?: string }> {
  try {
    const res = await fetch('/api/data-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || 'Failed to save data point' };
    }
    return { success: true, dataPoint: json.dataPoint };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error saving data point',
    };
  }
}
