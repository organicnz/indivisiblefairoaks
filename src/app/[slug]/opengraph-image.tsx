import { ImageResponse } from 'next/og';
import { getPublishedContent } from '@/lib/queries/content';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Indivisible Fair Oaks-Carmichael content page';

export default async function ContentOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getPublishedContent(slug);

  // Unknown/fuzzed slugs must not pay for a satori render — fail fast so
  // bot crawls can't burn function CPU generating garbage images.
  if (!content) {
    return new Response('Not Found', { status: 404 });
  }

  const title = content.title;
  const description =
    content.body?.replace(/<[^>]*>?/gm, '').slice(0, 140) ??
    'Grassroots democracy in action — Fair Oaks, Carmichael, and Sacramento County, CA.';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#0F172A',
        padding: '72px',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: '0.15em',
          color: '#94A3B8',
          textTransform: 'uppercase',
        }}
      >
        Indivisible Fair Oaks-Carmichael
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            height: 10,
            width: 120,
            background: '#F59E0B',
            borderRadius: 9999,
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 900,
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#94A3B8', lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#64748B',
          fontSize: 22,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
        }}
      >
        <span>Defending Democracy & Community</span>
        <span style={{ color: '#F59E0B' }}>indivisiblefairoaks.org</span>
      </div>
    </div>,
    size
  );
}
