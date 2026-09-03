'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/error-report';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, { digest: error.digest });
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
              color: '#D1FF00',
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
