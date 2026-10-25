import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import { Suspense } from 'react';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { SettingsHydrator } from '@/components/account/SettingsHydrator';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { ThemeAwareToaster } from '@/components/layout/ThemeAwareToaster';
import { ThemeHud } from '@/components/layout/ThemeHud';
import { VgpuThemeCanvas } from '@/components/layout/VgpuThemeCanvas';
import { WallEChatWidget } from '@/components/ui/WallEChatWidget';
import { VisualEditErrorBoundary } from '@/components/visual-edit/VisualEditErrorBoundary';
import { VisualEditOverlay } from '@/components/visual-edit/VisualEditOverlay';
import { BRAND } from '@/config/brand';
import {
  organizationJsonLd,
  rootRobots,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_DESCRIPTION,
  SITE_TAGLINE,
  SITE_URL,
  webSiteJsonLd,
} from '@/config/site';
import { env } from '@/lib/env';
import type { UserSettings } from '@/lib/store/settings';
import { getSettings } from '@/lib/supabase-server';
import { themeBootstrapScript } from '@/lib/theme';
import { serializeJsonLd } from '@/lib/utils';
import Providers from './providers';

const inter = localFont({
  src: './fonts/Inter-Variable.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
});

const outfit = localFont({
  src: './fonts/Outfit-Variable.woff2',
  variable: '--font-outfit',
  display: 'swap',
  weight: '100 900',
});

export const metadata: Metadata = {
  // Derived from env so the apex cutover is a Vercel env change. Previously
  // hardcoded, which meant staging shipped apex canonicals for every page.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | ${SITE_TAGLINE}`,
    // Pages supply bare titles; the brand suffix is applied here, once.
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'Indivisible',
    'Fair Oaks',
    'Carmichael',
    'Sacramento activism',
    'grassroots movement',
    'Carmichael Resistance Choir',
    'voter information',
    'community meetings',
    'democracy',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'Civic organization',
  alternates: { canonical: '/' },
  // Non-production builds (preview, staging) are noindex so they never compete
  // with the apex. Flips automatically when NEXT_PUBLIC_SITE_URL points at it.
  robots: rootRobots(),
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_SHORT_DESCRIPTION,
    // No `url` here on purpose — every page sets its own via pageMetadata().
    // A root-level url is inherited verbatim by any child that omits one.
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_SHORT_DESCRIPTION,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: BRAND.surfaceDark },
  ],
};

async function SettingsLoader() {
  const settings = await getSettings();
  return <SettingsHydrator settings={settings as UserSettings | null} />;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
    >
      <head>
        {/* The palette must be chosen before the first paint. The theme store
            applies its answer after hydration, which would flash the wrong
            palette on every navigation; this script runs synchronously before
            anything renders. Its branches are `resolveEffectiveTheme`'s, kept
            in step by `theme-bootstrap` tests — it cannot import that module,
            because an inline <script> runs before any bundle exists.

            `beforeInteractive` rather than a plain <script>: the App Router
            serializes a raw head script into the flight payload as *data*, so
            it reaches the browser without ever executing. */}
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: theme bootstrap, emitted from lib/theme.ts, no interpolation
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript() }}
        />
        {/* Entity graph for the chapter. Emitted once here rather than per page so
            every URL carries the same `sameAs`/`logo` identity. */}
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: serialized JSON-LD, escaped by serializeJsonLd
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: serialized JSON-LD, escaped by serializeJsonLd
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(webSiteJsonLd()) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans selection:bg-primary selection:text-white">
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:bg-primary focus:text-white focus:font-black focus:uppercase focus:tracking-widest focus:text-xs focus:px-4 focus:py-2 focus:rounded-full"
          >
            Skip to content
          </a>
          <Suspense fallback={null}>
            <SettingsLoader />
          </Suspense>
          <Header />
          <main id="main-content" className="flex-grow flex flex-col">
            {children}
          </main>
          <Footer />
          <WallEChatWidget />
          <VisualEditErrorBoundary>
            <VisualEditOverlay />
          </VisualEditErrorBoundary>
        </Providers>
        <ThemeAwareToaster />
        <ThemeHud />
        <VgpuThemeCanvas />
        {env.NEXT_E2E_BUILD !== 'true' && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
