import { CheckCircle2, Heart, Shield, Sparkles, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'About Us',
  description:
    'Learn about Indivisible Fair Oaks-Carmichael, our mission, values, and grassroots organizing across Fair Oaks, Carmichael, and Sacramento County.',
  path: '/about',
});

export default async function AboutPage() {
  const dataPoints = await getDataPoints('about');

  return (
    <div className="w-full bg-background text-foreground min-h-screen pt-(--header-clearance) pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-white/10 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/images/logo/indivisible-fairoaks-logo-dark.png"
              alt="Indivisible Fair Oaks & Carmichael Chapter Identity"
              width={380}
              height={67}
              className="h-12 sm:h-16 md:h-20 w-auto object-contain drop-shadow-lg"
              priority
            />
          </div>
          <div
            data-data-point="about.hero.eyebrow"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-bright/10 border border-primary-on-dark-muted/30 text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4"
          >
            <Users size={14} className="text-accent-gold" />
            <span>{dataPoints['about.hero.eyebrow'] || 'Grassroots Democracy In Action'}</span>
          </div>
          <h1
            data-data-point="about.hero.headline"
            className="text-4xl sm:text-5xl font-black tracking-tight mb-4 text-white"
          >
            {dataPoints['about.hero.headline'] || 'About Indivisible Fair Oaks-Carmichael'}
          </h1>
          <p
            data-data-point="about.hero.subhead"
            className="text-lg text-ink-on-dark max-w-2xl mx-auto leading-relaxed"
          >
            {dataPoints['about.hero.subhead'] ||
              'We are a local grassroots chapter representing residents in and near Fair Oaks and Carmichael, California, dedicated to protecting our democracy through peaceful civic power.'}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Our Mission */}
        <section className="space-y-6">
          <h2
            data-data-point="about.mission.headline"
            className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-3"
          >
            <Shield className="text-accent" />
            <span>{dataPoints['about.mission.headline'] || 'Our Mission Statement'}</span>
          </h2>
          <CopyRegion id="about-mission">
            <div className="p-8 rounded-2xl bg-surface-muted border border-border shadow-card space-y-4 text-muted-foreground leading-relaxed text-base">
              <p
                data-data-point="about.mission.intro"
                className="font-semibold text-foreground text-lg"
              >
                {dataPoints['about.mission.intro'] ||
                  'The mission of the Fair Oaks - Carmichael Indivisible Chapter is to cultivate a disciplined, non-violent grassroots movement that:'}
              </p>
              <ul className="space-y-3 pt-2">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-1" size={18} />
                  <span data-data-point="about.mission.point1_desc">
                    <strong
                      data-data-point="about.mission.point1_title"
                      className="text-foreground"
                    >
                      {dataPoints['about.mission.point1_title'] ||
                        'Stops the rise of authoritarianism:'}
                    </strong>{' '}
                    {dataPoints['about.mission.point1_desc'] ||
                      'Holding officials accountable and sounding the alarm against anti-democratic power grabs.'}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-1" size={18} />
                  <span data-data-point="about.mission.point2_desc">
                    <strong
                      data-data-point="about.mission.point2_title"
                      className="text-foreground"
                    >
                      {dataPoints['about.mission.point2_title'] ||
                        'Supports and defends democratic norms:'}
                    </strong>{' '}
                    {dataPoints['about.mission.point2_desc'] ||
                      'Protecting voting rights, equal representation, free press, and constitutional governance.'}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-1" size={18} />
                  <span data-data-point="about.mission.point3_desc">
                    <strong
                      data-data-point="about.mission.point3_title"
                      className="text-foreground"
                    >
                      {dataPoints['about.mission.point3_title'] || 'Elects bold leaders:'}
                    </strong>{' '}
                    {dataPoints['about.mission.point3_desc'] ||
                      'Mobilizing voters to elect public servants who champion democratic integrity and progressive values.'}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-1" size={18} />
                  <span data-data-point="about.mission.point4_desc">
                    <strong
                      data-data-point="about.mission.point4_title"
                      className="text-foreground"
                    >
                      {dataPoints['about.mission.point4_title'] || 'Secures progressive policies:'}
                    </strong>{' '}
                    {dataPoints['about.mission.point4_desc'] ||
                      'Championing economic justice, environmental stewardship, and civil rights for all people.'}
                  </span>
                </li>
              </ul>
            </div>
          </CopyRegion>
        </section>

        {/* Who We Are & Where We Organize */}
        <section className="space-y-6">
          <h2
            data-data-point="about.who.headline"
            className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-3"
          >
            <Users className="text-primary-ink" />
            <span>{dataPoints['about.who.headline'] || 'Who We Are'}</span>
          </h2>
          <CopyRegion id="about-who">
            <div className="text-muted-foreground space-y-4 leading-relaxed">
              <p data-data-point="about.who.p1">
                {dataPoints['about.who.p1'] ||
                  'We are neighbors, retirees, workers, students, educators, and community members in Sacramento County who believe that true democracy requires active, ongoing participation. As an affiliated chapter of the national Indivisible network, we apply national organizing strategies locally where our voices have the greatest impact.'}
              </p>
              <p data-data-point="about.who.p2">
                {dataPoints['about.who.p2'] ||
                  'Our monthly gatherings provide a welcoming space for dialogue, education, and coordinated action. Whether writing postcards, attending town halls, rallying on street corners, or lifting our voices in song, we turn concern into constructive, democratic action.'}
              </p>
            </div>
          </CopyRegion>
        </section>

        {/* Commitment to Nonviolent Action */}
        <section className="p-8 rounded-2xl bg-surface-muted border border-border shadow-card space-y-4">
          <h3
            data-data-point="about.nonviolence.headline"
            className="text-xl font-bold text-foreground flex items-center gap-2"
          >
            <Sparkles className="text-accent" size={20} />
            <span>
              {dataPoints['about.nonviolence.headline'] ||
                'Commitment to Non-Violent Action & De-escalation'}
            </span>
          </h3>
          <CopyRegion id="about-nonviolence">
            <p
              data-data-point="about.nonviolence.body"
              className="text-muted-foreground text-sm leading-relaxed"
            >
              {dataPoints['about.nonviolence.body'] ||
                'A foundational pillar behind all Indivisible Fair Oaks-Carmichael events is a strict commitment to nonviolence. We expect all attendees to act lawfully, treat fellow citizens with dignity, and actively seek to de-escalate potential conflict with counter-protesters. Weapons of any kind are strictly prohibited at our gatherings.'}
            </p>
          </CopyRegion>
        </section>

        {/* Community Food Bank Drives */}
        <section className="space-y-4">
          <h2
            data-data-point="about.foodbank.headline"
            className="text-2xl font-black text-foreground tracking-tight flex items-center gap-3"
          >
            <Heart className="text-accent-red" />
            <span>{dataPoints['about.foodbank.headline'] || 'Community Care & Food Drives'}</span>
          </h2>
          <p
            data-data-point="about.foodbank.body"
            className="text-muted-foreground leading-relaxed"
          >
            {dataPoints['about.foodbank.body'] ||
              'We believe that civic justice begins with community care. At every in-person monthly gathering, our members bring non-perishable canned goods and staple foods to donate to local Carmichael and Fair Oaks food pantries.'}
          </p>
        </section>

        {/* Contact & Join */}
        <section className="p-8 rounded-2xl bg-surface-muted border border-border shadow-card text-center space-y-6">
          <h3 data-data-point="about.join.headline" className="text-2xl font-black text-foreground">
            {dataPoints['about.join.headline'] || 'Join Our Next Gathering'}
          </h3>
          <CopyRegion id="about-join">
            <p
              data-data-point="about.join.body"
              className="text-muted-foreground text-sm max-w-xl mx-auto"
            >
              {dataPoints['about.join.body'] ||
                'Ready to get involved? Join our mailing list, attend our next monthly meeting, or sing with the Carmichael Resistance Choir.'}
            </p>
          </CopyRegion>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/events"
              className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs uppercase tracking-wider transition-all"
            >
              See Upcoming Events
            </Link>
            <Link
              href="/contact"
              className="px-6 py-3 rounded-xl border-2 border-secondary text-foreground hover:bg-secondary hover:text-white dark:border-border font-bold text-xs uppercase tracking-wider transition-all"
            >
              Contact Us
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
