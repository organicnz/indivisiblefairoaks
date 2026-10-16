import { CheckCircle2, Heart, Shield, Sparkles, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CopyRegion } from '@/components/cms/CopyRegion';
import { DataPoint } from '@/components/ui/DataPoint';
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-bright/10 border border-primary-on-dark-muted/30 text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4">
            <Users size={14} className="text-accent-gold" />
            <DataPoint name="about.hero.eyebrow" initialData={dataPoints}>
              Grassroots Democracy In Action
            </DataPoint>
          </div>
          <DataPoint
            name="about.hero.headline"
            as="h1"
            initialData={dataPoints}
            className="text-4xl sm:text-5xl font-black tracking-tight mb-4 text-white"
          >
            About Indivisible Fair Oaks-Carmichael
          </DataPoint>
          <DataPoint
            name="about.hero.subhead"
            as="p"
            initialData={dataPoints}
            className="text-lg text-ink-on-dark max-w-2xl mx-auto leading-relaxed"
          >
            We are a local grassroots chapter representing residents in and near Fair Oaks and
            Carmichael, California, dedicated to protecting our democracy through peaceful civic
            power.
          </DataPoint>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Our Mission */}
        <section className="space-y-6">
          <DataPoint
            name="about.mission.headline"
            as="h2"
            initialData={dataPoints}
            className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-3"
          >
            <Shield className="text-accent" />
            <span>Our Mission Statement</span>
          </DataPoint>
          <CopyRegion id="about-mission">
            <div className="p-8 rounded-2xl bg-surface-muted border border-border shadow-card space-y-4 text-muted-foreground leading-relaxed text-base">
              <DataPoint
                name="about.mission.intro"
                as="p"
                initialData={dataPoints}
                className="font-semibold text-foreground text-lg"
              >
                The mission of the Fair Oaks - Carmichael Indivisible Chapter is to cultivate a
                disciplined, non-violent grassroots movement that:
              </DataPoint>
              <ul className="space-y-3 pt-2">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-1" size={18} />
                  <span>
                    <DataPoint
                      name="about.mission.point1_title"
                      as="strong"
                      initialData={dataPoints}
                      className="text-foreground mr-1"
                    >
                      Stops the rise of authoritarianism:
                    </DataPoint>
                    <DataPoint name="about.mission.point1_desc" as="span" initialData={dataPoints}>
                      Holding officials accountable and sounding the alarm against anti-democratic
                      power grabs.
                    </DataPoint>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-1" size={18} />
                  <span>
                    <DataPoint
                      name="about.mission.point2_title"
                      as="strong"
                      initialData={dataPoints}
                      className="text-foreground mr-1"
                    >
                      Supports and defends democratic norms:
                    </DataPoint>
                    <DataPoint name="about.mission.point2_desc" as="span" initialData={dataPoints}>
                      Protecting voting rights, equal representation, free press, and constitutional
                      governance.
                    </DataPoint>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-1" size={18} />
                  <span>
                    <DataPoint
                      name="about.mission.point3_title"
                      as="strong"
                      initialData={dataPoints}
                      className="text-foreground mr-1"
                    >
                      Elects bold leaders:
                    </DataPoint>
                    <DataPoint name="about.mission.point3_desc" as="span" initialData={dataPoints}>
                      Mobilizing voters to elect public servants who champion democratic integrity
                      and progressive values.
                    </DataPoint>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-1" size={18} />
                  <span>
                    <DataPoint
                      name="about.mission.point4_title"
                      as="strong"
                      initialData={dataPoints}
                      className="text-foreground mr-1"
                    >
                      Secures progressive policies:
                    </DataPoint>
                    <DataPoint name="about.mission.point4_desc" as="span" initialData={dataPoints}>
                      Championing economic justice, environmental stewardship, and civil rights for
                      all people.
                    </DataPoint>
                  </span>
                </li>
              </ul>
            </div>
          </CopyRegion>
        </section>

        {/* Who We Are & Where We Organize */}
        <section className="space-y-6">
          <DataPoint
            name="about.who.headline"
            as="h2"
            initialData={dataPoints}
            className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-3"
          >
            <Users className="text-primary-ink" />
            <span>Who We Are</span>
          </DataPoint>
          <CopyRegion id="about-who">
            <div className="text-muted-foreground space-y-4 leading-relaxed">
              <DataPoint name="about.who.p1" as="p" initialData={dataPoints}>
                We are neighbors, retirees, workers, students, educators, and community members in
                Sacramento County who believe that true democracy requires active, ongoing
                participation. As an affiliated chapter of the national Indivisible network, we
                apply national organizing strategies locally where our voices have the greatest
                impact.
              </DataPoint>
              <DataPoint name="about.who.p2" as="p" initialData={dataPoints}>
                Our monthly gatherings provide a welcoming space for dialogue, education, and
                coordinated action. Whether writing postcards, attending town halls, rallying on
                street corners, or lifting our voices in song, we turn concern into constructive,
                democratic action.
              </DataPoint>
            </div>
          </CopyRegion>
        </section>

        {/* Commitment to Nonviolent Action */}
        <section className="p-8 rounded-2xl bg-surface-muted border border-border shadow-card space-y-4">
          <DataPoint
            name="about.nonviolence.headline"
            as="h3"
            initialData={dataPoints}
            className="text-xl font-bold text-foreground flex items-center gap-2"
          >
            <Sparkles className="text-accent" size={20} />
            <span>Commitment to Non-Violent Action & De-escalation</span>
          </DataPoint>
          <CopyRegion id="about-nonviolence">
            <DataPoint
              name="about.nonviolence.body"
              as="p"
              initialData={dataPoints}
              className="text-muted-foreground text-sm leading-relaxed"
            >
              A foundational pillar behind all Indivisible Fair Oaks-Carmichael events is a strict
              commitment to nonviolence. We expect all attendees to act lawfully, treat fellow
              citizens with dignity, and actively seek to de-escalate potential conflict with
              counter-protesters. Weapons of any kind are strictly prohibited at our gatherings.
            </DataPoint>
          </CopyRegion>
        </section>

        {/* Community Food Bank Drives */}
        <section className="space-y-4">
          <DataPoint
            name="about.foodbank.headline"
            as="h2"
            initialData={dataPoints}
            className="text-2xl font-black text-foreground tracking-tight flex items-center gap-3"
          >
            <Heart className="text-accent-red" />
            <span>Community Care & Food Drives</span>
          </DataPoint>
          <DataPoint
            name="about.foodbank.body"
            as="p"
            initialData={dataPoints}
            className="text-muted-foreground leading-relaxed"
          >
            We believe that civic justice begins with community care. At every in-person monthly
            gathering, our members bring non-perishable canned goods and staple foods to donate to
            local Carmichael and Fair Oaks food pantries.
          </DataPoint>
        </section>

        {/* Contact & Join */}
        <section className="p-8 rounded-2xl bg-surface-muted border border-border shadow-card text-center space-y-6">
          <DataPoint
            name="about.join.headline"
            as="h3"
            initialData={dataPoints}
            className="text-2xl font-black text-foreground"
          >
            Join Our Next Gathering
          </DataPoint>
          <CopyRegion id="about-join">
            <DataPoint
              name="about.join.body"
              as="p"
              initialData={dataPoints}
              className="text-muted-foreground text-sm max-w-xl mx-auto"
            >
              Ready to get involved? Join our mailing list, attend our next monthly meeting, or sing
              with the Carmichael Resistance Choir.
            </DataPoint>
          </CopyRegion>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/events"
              className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs uppercase tracking-wider transition-all"
            >
              <DataPoint name="about.join.btn_events" as="span" initialData={dataPoints}>
                See Upcoming Events
              </DataPoint>
            </Link>
            <Link
              href="/contact"
              className="px-6 py-3 rounded-xl border-2 border-secondary text-foreground hover:bg-secondary hover:text-white dark:border-border font-bold text-xs uppercase tracking-wider transition-all"
            >
              <DataPoint name="about.join.btn_contact" as="span" initialData={dataPoints}>
                Contact Us
              </DataPoint>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
