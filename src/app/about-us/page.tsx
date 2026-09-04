import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'About Us | Indivisible Fair Oaks-Carmichael',
  description:
    'Learn about Indivisible Fair Oaks-Carmichael, our mission, values, and grassroots organizing across Fair Oaks, Carmichael, and Sacramento County.',
  openGraph: {
    title: 'About Us | Indivisible Fair Oaks-Carmichael',
    description:
      'Learn about Indivisible Fair Oaks-Carmichael, our mission, values, and grassroots organizing across Fair Oaks, Carmichael, and Sacramento County.',
    url: 'https://indivisiblefairoaks.org/about',
    siteName: 'Indivisible Fair Oaks-Carmichael',
    locale: 'en_US',
    type: 'website',
  },
};

export default function AboutUsPage() {
  redirect('/about');
}
