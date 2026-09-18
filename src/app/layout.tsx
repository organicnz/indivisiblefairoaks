import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Toaster } from 'sonner';
import { SettingsHydrator } from '@/components/account/SettingsHydrator';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { WallEChatWidget } from '@/components/ui/WallEChatWidget';
import type { UserSettings } from '@/lib/store/settings';
import { getSettings } from '@/lib/supabase-server';
import Providers from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://indivisiblefairoaks.org'),
  title: 'Indivisible Fair Oaks-Carmichael | Grassroots Democracy in Action',
  description:
    'Indivisible Fair Oaks-Carmichael is a non-violent grassroots movement defending democracy, resisting authoritarianism, electing progressive leaders, and advocating for our community.',
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
  openGraph: {
    title: 'Indivisible Fair Oaks-Carmichael | Grassroots Democracy in Action',
    description:
      'A grassroots chapter representing residents in Fair Oaks and Carmichael, CA, committed to defending democratic norms and progressive change.',
    url: 'https://indivisiblefairoaks.org',
    siteName: 'Indivisible Fair Oaks-Carmichael',
    locale: 'en_US',
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
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
    <html lang="en" className={`${inter.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-secondary font-sans selection:bg-primary selection:text-secondary">
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
        </Providers>
        <Toaster position="bottom-right" richColors theme="light" />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
