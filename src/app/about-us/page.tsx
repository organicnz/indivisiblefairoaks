import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'About Us | Indivisible Fair Oaks-Carmichael',
  description:
    'Learn about Indivisible Fair Oaks-Carmichael, our mission, values, and grassroots organizing across Fair Oaks, Carmichael, and Sacramento County.',
  alternates: { canonical: '/about' },
};

export default function AboutUsPage() {
  redirect('/about');
}
