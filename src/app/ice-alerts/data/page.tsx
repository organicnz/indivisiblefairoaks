import type { Metadata } from 'next';
import { connection } from 'next/server';
import { DataApiSection } from '@/components/ice-alerts/source-data/DataApiSection';
import { DataFieldDictionary } from '@/components/ice-alerts/source-data/DataFieldDictionary';
import { DataMasthead } from '@/components/ice-alerts/source-data/DataMasthead';
import { DataStats } from '@/components/ice-alerts/source-data/DataStats';
import { DataStatusSection } from '@/components/ice-alerts/source-data/DataStatusSection';
import { readData } from '@/components/ice-alerts/source-data/ice-data';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'ICE Source Data & API | ICE Alert',
  description:
    'Download the chapter’s source-attributed public ICE reports as JSON or XML, or query the read-only public API. Every record keeps its original source URL and timestamps.',
  path: '/ice-alerts/data',
  robots: { index: false, follow: false },
});

// Request-time dataset metadata: the crawler writes between requests and the
// public count must not be baked into the static shell.
export const instant = false;

export default async function IceSourceDataPage() {
  await connection();
  const data = await readData();

  return (
    <div className="civic-page min-h-screen bg-background pb-20 pt-(--header-clearance) text-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <DataMasthead />
        <DataStats
          total={data.total}
          latestRetrievedAt={data.latestRetrievedAt}
          sources={data.sources}
        />
        <DataApiSection />
        <DataStatusSection sources={data.sources} />
        <DataFieldDictionary />
      </div>
    </div>
  );
}
