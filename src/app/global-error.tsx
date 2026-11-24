'use client';

import { useEffect } from 'react';
import { reportBoundaryError } from '@/lib/report-boundary-error';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Dual reporting is deliberate: error_reports is the admin-visible,
    // rate-limited first-party log; Sentry carries source-mapped traces for
    // debugging. Neither replaces the other. Both load on demand so their SDKs
    // stay out of the initial bundle.
    reportBoundaryError(error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F172A',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '28rem' }}>
          <h1
            style={{
              // Surface-muted heading on the dark shell — raw lime is
              // reserved for non-text accents only. The retry button below
              // keeps the compliant lime-bg + dark-text CTA pattern.
              color: '#F8FAFC',
              fontSize: '2rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              marginBottom: '1rem',
            }}
          >
            Line Down
          </h1>
          <p style={{ color: '#94A3B8', marginBottom: '2rem', lineHeight: 1.6 }}>
            The whole site hit a snag. We&apos;re on it — try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#D1FF00',
              color: '#0F172A',
              border: 'none',
              padding: '1.25rem 2rem',
              borderRadius: '9999px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
