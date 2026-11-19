'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

/**
 * The block editor parses stored HTML with `DOMParser`, which only exists in the
 * browser. Without this boundary Next renders the client component on the
 * server, where the parse throws and the admin route returns a 500 before the
 * editor ever hydrates. Loading the editor client-side keeps the same component
 * and props for every consumer while leaving HTML parsing on the client.
 */
export const ContentEditor = dynamic(
  () => import('./ContentEditor').then((module) => module.ContentEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2
          className="h-8 w-8 animate-spin text-primary dark:text-primary-on-dark"
          aria-label="Loading content editor"
        />
      </div>
    ),
  }
);
