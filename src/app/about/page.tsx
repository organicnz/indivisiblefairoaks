import { CheckCircle2, Heart, Shield, Sparkles, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyRegion } from '@/components/cms/CopyRegion';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
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
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        icon={Users}
        eyebrow={
          <DataPoint name="about.hero.eyebrow" initialData={dataPoints}>
            Grassroots Democracy In Action
          </DataPoint>
        }
        title={
          <DataPoint
            name="about.hero.headline"
            as="h1"
            initialData={dataPoints}
            className={MASTHEAD_TITLE}
          >
            About Indivisible Fair Oaks-Carmichael
          </DataPoint>
        }
        intro={
          <DataPoint
            name="about.hero.subhead"
            as="p"
            initialData={dataPoints}
            className={MASTHEAD_INTRO}
          >
            We are a local grassroots chapter representing residents in and near Fair Oaks and
            Carmichael, California, dedicated to protecting our democracy through peaceful civic
            power.
          </DataPoint>
        }
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Our Mission */}
        <section className="space-y-6">
          <DataPoint
            name="about.mission.headline"
            as="h2"
            initialData={dataPoints}
            className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl"
          >
            <Shield className="text-accent dark:text-accent-gold" />
            <span>Our Mission Statement</span>
          </DataPoint>
          <CopyRegion id="about-mission">
            <div className="space-y-4 border-y border-border bg-surface-card p-6 text-base leading-relaxed text-muted-foreground sm:p-8">
              <DataPoint
                name="about.mission.intro"
                as="p"
                initialData={dataPoints}
                className="font-semibold text-foreground dark:text-white text-lg"
              >
                The mission of the Fair Oaks - Carmichael Indivisible Chapter is to cultivate a
                disciplined, non-violent grassroots movement that:
              </DataPoint>
              <ul className="space-y-3 pt-2">
                <li className="flex items-start gap-3">
                  <CheckCircle2
                    className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-1"
                    size={18}
                  />
                  <span>
                    <DataPoint
                      name="about.mission.point1_title"
                      as="strong"
                      initialData={dataPoints}
                      className="text-foreground dark:text-white mr-1"
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
                  <CheckCircle2
                    className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-1"
                    size={18}
                  />
                  <span>
                    <DataPoint
                      name="about.mission.point2_title"
                      as="strong"
                      initialData={dataPoints}
                      className="text-foreground dark:text-white mr-1"
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
                  <CheckCircle2
                    className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-1"
                    size={18}
                  />
                  <span>
                    <DataPoint
                      name="about.mission.point3_title"
                      as="strong"
                      initialData={dataPoints}
                      className="text-foreground dark:text-white mr-1"
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
                  <CheckCircle2
                    className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-1"
                    size={18}
                  />
                  <span>
                    <DataPoint
                      name="about.mission.point4_title"
                      as="strong"
                      initialData={dataPoints}
                      className="text-foreground dark:text-white mr-1"
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
            className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl"
          >
            <Users
              className="text-primary-ink dark:text-primary-on-dark-muted"
              aria-hidden="true"
            />
            <span>Who We Are</span>
          </DataPoint>
          <CopyRegion id="about-who">
            <div className="text-muted-foreground dark:text-ink-on-dark space-y-4 leading-relaxed">
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
        <section className="border-y border-border bg-surface-card p-6 sm:p-8 space-y-4">
          <DataPoint
            name="about.nonviolence.headline"
            as="h3"
            initialData={dataPoints}
            className="flex items-center gap-2 font-display text-2xl font-semibold tracking-[-0.03em]"
          >
            <Sparkles className="text-accent dark:text-accent-gold" size={20} />
            <span>Commitment to Non-Violent Action & De-escalation</span>
          </DataPoint>
          <CopyRegion id="about-nonviolence">
            <DataPoint
              name="about.nonviolence.body"
              as="p"
              initialData={dataPoints}
              className="text-muted-foreground dark:text-ink-on-dark text-sm leading-relaxed"
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
            className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl"
          >
            <Heart className="text-accent-red" />
            <span>Community Care & Food Drives</span>
          </DataPoint>
          <DataPoint
            name="about.foodbank.body"
            as="p"
            initialData={dataPoints}
            className="text-muted-foreground dark:text-ink-on-dark leading-relaxed"
          >
            We believe that civic justice begins with community care. At every in-person monthly
            gathering, our members bring non-perishable canned goods and staple foods to donate to
            local Carmichael and Fair Oaks food pantries.
          </DataPoint>
        </section>

        {/* Contact & Join */}
        <section className="border-t border-foreground/25 pt-10 text-center space-y-6">
          <DataPoint
            name="about.join.headline"
            as="h3"
            initialData={dataPoints}
            className="font-display text-3xl font-semibold tracking-[-0.03em]"
          >
            Join Our Next Gathering
          </DataPoint>
          <CopyRegion id="about-join">
            <DataPoint
              name="about.join.body"
              as="p"
              initialData={dataPoints}
              className="text-muted-foreground dark:text-ink-on-dark text-sm max-w-xl mx-auto"
            >
              Ready to get involved? Join our mailing list, attend our next monthly meeting, or sing
              with the Carmichael Resistance Choir.
            </DataPoint>
          </CopyRegion>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/events"
              className="inline-flex min-h-11 items-center bg-primary px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
            >
              <DataPoint name="about.join.btn_events" as="span" initialData={dataPoints}>
                See Upcoming Events
              </DataPoint>
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center border border-foreground/30 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink"
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
