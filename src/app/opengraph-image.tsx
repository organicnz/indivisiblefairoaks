import { ImageResponse } from 'next/og';
import { BRAND } from '@/config/brand';
import { SITE_NAME, SITE_SHORT_DESCRIPTION, SITE_TAGLINE } from '@/config/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;

// Root social card. Every route without its own `opengraph-image` inherits this,
// which is what fixed social sharing: previously 40+ routes shipped no `og:image`
// at all and Facebook/X rendered text-only link previews.
export default function RootOgImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: BRAND.surfaceDark,
        padding: '72px',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: '0.15em',
          color: BRAND.inkMutedOnDark,
          textTransform: 'uppercase',
        }}
      >
        {SITE_NAME}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div
          style={{
            display: 'flex',
            height: 10,
            width: 120,
            background: BRAND.accentGold,
            borderRadius: 9999,
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 78,
            fontWeight: 900,
            color: BRAND.surfaceCard,
            letterSpacing: '-0.02em',
            lineHeight: 1.02,
            textTransform: 'uppercase',
          }}
        >
          Grassroots Democracy in Action
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 27,
            color: BRAND.inkOnDark,
            lineHeight: 1.4,
            maxWidth: 900,
          }}
        >
          {SITE_SHORT_DESCRIPTION}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: BRAND.inkMutedOnDark,
          fontSize: 22,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
        }}
      >
        <span>Fair Oaks · Carmichael · Sacramento County</span>
        <span style={{ color: BRAND.accentGold }}>indivisiblefairoaks.org</span>
      </div>
    </div>,
    size
  );
}
