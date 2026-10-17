import { Heart, Mail, MapPin, Music } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';
import { getDataPoints } from '@/lib/queries/civic';

async function CopyrightYear() {
  'use cache';
  return <span>{new Date().getFullYear()}</span>;
}

export async function Footer() {
  const dataPoints = await getDataPoints('footer');

  return (
    <footer className="bg-secondary text-ink-on-dark border-t border-white/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand & Mission Column */}
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="relative w-11 h-11 shrink-0 group-hover:scale-105 transition-transform">
                <Image
                  src="/images/logo/indivisible-emblem.png"
                  alt="Indivisible Fair Oaks & Carmichael"
                  width={44}
                  height={44}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
              <div>
                <span className="text-white font-black text-lg tracking-tight uppercase block leading-tight group-hover:text-primary-on-dark-muted transition-colors">
                  <DataPoint name="footer.brand.indivisible" initialData={dataPoints}>
                    Indivisible
                  </DataPoint>
                </span>
                <span className="text-primary-on-dark-muted text-xs font-semibold uppercase block leading-tight">
                  <DataPoint name="footer.brand.chapter" initialData={dataPoints}>
                    Fair Oaks & Carmichael
                  </DataPoint>
                </span>
              </div>
            </Link>
            <DataPoint
              name="footer.tagline"
              as="p"
              initialData={dataPoints}
              className="mt-4 text-xs sm:text-sm text-ink-muted-on-dark leading-relaxed"
            >
              A grassroots movement dedicated to defending democracy, resisting authoritarianism,
              electing progressive leaders, and taking direct non-violent action for our community.
            </DataPoint>
            <div className="mt-5 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-ink-on-dark flex items-start gap-2.5">
              <MapPin className="text-accent-gold shrink-0 mt-0.5" size={16} />
              <DataPoint name="footer.meeting_notice" as="span" initialData={dataPoints}>
                Meetings held monthly in Carmichael, CA. Bring a non-perishable food item for local
                food banks!
              </DataPoint>
            </div>
          </div>

          {/* Site Navigation */}
          <div className="col-span-1">
            <h3 className="text-accent-gold text-xs font-black uppercase tracking-widest mb-4">
              <DataPoint name="footer.col_explore" initialData={dataPoints}>
                Explore
              </DataPoint>
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  <DataPoint name="footer.nav.about" as="span" initialData={dataPoints}>
                    About Us & Mission
                  </DataPoint>
                </Link>
              </li>
              <li>
                <Link href="/events" className="hover:text-white transition-colors">
                  <DataPoint name="footer.nav.events" as="span" initialData={dataPoints}>
                    Upcoming Events & Actions
                  </DataPoint>
                </Link>
              </li>
              <li>
                <Link href="/choir" className="hover:text-white transition-colors">
                  <DataPoint name="footer.nav.choir" as="span" initialData={dataPoints}>
                    Carmichael Resistance Choir
                  </DataPoint>
                </Link>
              </li>
              <li>
                <Link href="/voter-info" className="hover:text-white transition-colors">
                  <DataPoint name="footer.nav.voter" as="span" initialData={dataPoints}>
                    Voter Information & Guides
                  </DataPoint>
                </Link>
              </li>
              <li>
                <Link href="/news" className="hover:text-white transition-colors">
                  <DataPoint name="footer.nav.news" as="span" initialData={dataPoints}>
                    Newsletters & Bulletins
                  </DataPoint>
                </Link>
              </li>
              <li>
                <Link href="/links" className="hover:text-white transition-colors">
                  <DataPoint name="footer.nav.links" as="span" initialData={dataPoints}>
                    Coalition & Action Links
                  </DataPoint>
                </Link>
              </li>
            </ul>
          </div>

          {/* Action & Engagement */}
          <div className="col-span-1">
            <h3 className="text-accent-gold text-xs font-black uppercase tracking-widest mb-4">
              <DataPoint name="footer.col_involved" initialData={dataPoints}>
                Get Involved
              </DataPoint>
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium">
              <li>
                <a
                  href="https://www.mobilize.us/indivisible/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <DataPoint name="footer.nav.mobilize" as="span" initialData={dataPoints}>
                    Mobilize.us Events
                  </DataPoint>
                </a>
              </li>
              <li>
                <Link
                  href="/choir"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Music size={14} className="text-primary-on-dark-muted" />
                  <DataPoint name="footer.nav.sing" as="span" initialData={dataPoints}>
                    Sing in the Choir
                  </DataPoint>
                </Link>
              </li>
              <li>
                <a
                  href="mailto:subscribe@indivisiblefairoaks.org"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Mail size={14} className="text-primary-on-dark-muted" />
                  <DataPoint name="footer.nav.subscribe" as="span" initialData={dataPoints}>
                    Subscribe to Newsletter
                  </DataPoint>
                </a>
              </li>
              <li>
                <Link
                  href="/donate"
                  className="inline-flex items-center gap-1.5 text-accent-gold hover:text-accent-gold font-bold transition-colors"
                >
                  <Heart size={14} className="fill-accent-gold" />
                  <DataPoint name="footer.nav.donate" as="span" initialData={dataPoints}>
                    Donate via ActBlue
                  </DataPoint>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Transparency */}
          <div className="col-span-1">
            <h3 className="text-accent-gold text-xs font-black uppercase tracking-widest mb-4">
              <DataPoint name="footer.col_connect" initialData={dataPoints}>
                Connect With Us
              </DataPoint>
            </h3>
            <div className="space-y-3 text-xs sm:text-sm">
              <DataPoint
                name="footer.inquiry_intro"
                as="p"
                initialData={dataPoints}
                className="text-ink-muted-on-dark"
              >
                Have a question or want to get involved with our local organizing team?
              </DataPoint>
              <div>
                <span className="text-ink-muted-on-dark text-[11px] block uppercase tracking-wider">
                  <DataPoint name="footer.label_inquiries" initialData={dataPoints}>
                    General Inquiries:
                  </DataPoint>
                </span>
                <a
                  href="mailto:contact@indivisiblefairoaks.org"
                  className="text-primary-on-dark-muted hover:text-primary-on-dark font-semibold break-all"
                >
                  <DataPoint name="footer.email_contact" as="span" initialData={dataPoints}>
                    contact@indivisiblefairoaks.org
                  </DataPoint>
                </a>
              </div>
              <div>
                <span className="text-ink-muted-on-dark text-[11px] block uppercase tracking-wider">
                  <DataPoint name="footer.label_mailing" initialData={dataPoints}>
                    Mailing List:
                  </DataPoint>
                </span>
                <a
                  href="mailto:subscribe@indivisiblefairoaks.org"
                  className="text-primary-on-dark-muted hover:text-primary-on-dark font-semibold break-all"
                >
                  <DataPoint name="footer.email_subscribe" as="span" initialData={dataPoints}>
                    subscribe@indivisiblefairoaks.org
                  </DataPoint>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted-on-dark">
          <p>
            © <CopyrightYear /> Indivisible Fair Oaks-Carmichael.{' '}
            <DataPoint name="footer.copyright_disclaimer" as="span" initialData={dataPoints}>
              All rights reserved. Grassroots volunteer organization.
            </DataPoint>
          </p>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-slate-200 transition-colors">
              <DataPoint name="footer.bottom.about" as="span" initialData={dataPoints}>
                About
              </DataPoint>
            </Link>
            <Link href="/contact" className="hover:text-slate-200 transition-colors">
              <DataPoint name="footer.bottom.contact" as="span" initialData={dataPoints}>
                Contact
              </DataPoint>
            </Link>
            <a
              href="https://secure.actblue.com/donate/indivisiblefoc1432155925"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-gold hover:text-accent-gold transition-colors"
            >
              <DataPoint name="footer.bottom.actblue" as="span" initialData={dataPoints}>
                ActBlue
              </DataPoint>
            </a>
            <Link href="/login" className="hover:text-slate-200 transition-colors">
              <DataPoint name="footer.bottom.organizer" as="span" initialData={dataPoints}>
                Organizer Access
              </DataPoint>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
