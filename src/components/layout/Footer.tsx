import { Heart, Mail, MapPin, Music } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { DataPoint } from '@/components/ui/DataPoint';

async function CopyrightYear() {
  'use cache';
  return <span>{new Date().getFullYear()}</span>;
}

export function Footer() {
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
                  Indivisible
                </span>
                <span className="text-primary-on-dark-muted text-xs font-semibold uppercase block leading-tight">
                  Fair Oaks & Carmichael
                </span>
              </div>
            </Link>
            <DataPoint
              name="footer.tagline"
              as="p"
              className="mt-4 text-xs sm:text-sm text-ink-muted-on-dark leading-relaxed"
            >
              A grassroots movement dedicated to defending democracy, resisting authoritarianism,
              electing progressive leaders, and taking direct non-violent action for our community.
            </DataPoint>
            <div className="mt-5 p-3 rounded-xl bg-secondary border border-white/10 text-xs text-ink-on-dark flex items-start gap-2.5">
              <MapPin className="text-accent-gold shrink-0 mt-0.5" size={16} />
              <DataPoint name="footer.meeting_notice" as="span">
                Meetings held monthly in Carmichael, CA. Bring a non-perishable food item for local
                food banks!
              </DataPoint>
            </div>
          </div>

          {/* Site Navigation */}
          <div className="col-span-1">
            <h3 className="text-accent-gold text-xs font-black uppercase tracking-widest mb-4">
              <DataPoint name="footer.col_explore">Explore</DataPoint>
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About Us & Mission
                </Link>
              </li>
              <li>
                <Link href="/events" className="hover:text-white transition-colors">
                  Upcoming Events & Actions
                </Link>
              </li>
              <li>
                <Link href="/choir" className="hover:text-white transition-colors">
                  Carmichael Resistance Choir
                </Link>
              </li>
              <li>
                <Link href="/voter-info" className="hover:text-white transition-colors">
                  Voter Information & Guides
                </Link>
              </li>
              <li>
                <Link href="/news" className="hover:text-white transition-colors">
                  Newsletters & Bulletins
                </Link>
              </li>
              <li>
                <Link href="/links" className="hover:text-white transition-colors">
                  Coalition & Action Links
                </Link>
              </li>
            </ul>
          </div>

          {/* Action & Engagement */}
          <div className="col-span-1">
            <h3 className="text-accent-gold text-xs font-black uppercase tracking-widest mb-4">
              <DataPoint name="footer.col_involved">Get Involved</DataPoint>
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium">
              <li>
                <a
                  href="https://www.mobilize.us/indivisible/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  Mobilize.us Events
                </a>
              </li>
              <li>
                <Link
                  href="/choir"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Music size={14} className="text-primary-on-dark-muted" />
                  Sing in the Choir
                </Link>
              </li>
              <li>
                <a
                  href="mailto:subscribe@indivisiblefairoaks.org"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Mail size={14} className="text-primary-on-dark-muted" />
                  Subscribe to Newsletter
                </a>
              </li>
              <li>
                <Link
                  href="/donate"
                  className="inline-flex items-center gap-1.5 text-accent-gold hover:text-accent-gold font-bold transition-colors"
                >
                  <Heart size={14} className="fill-accent-gold" />
                  Donate via ActBlue
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Transparency */}
          <div className="col-span-1">
            <h3 className="text-accent-gold text-xs font-black uppercase tracking-widest mb-4">
              <DataPoint name="footer.col_connect">Connect With Us</DataPoint>
            </h3>
            <div className="space-y-3 text-xs sm:text-sm">
              <DataPoint name="footer.inquiry_intro" as="p" className="text-ink-muted-on-dark">
                Have a question or want to get involved with our local organizing team?
              </DataPoint>
              <div>
                <span className="text-ink-muted-on-dark text-[11px] block uppercase tracking-wider">
                  <DataPoint name="footer.label_inquiries">General Inquiries:</DataPoint>
                </span>
                <a
                  href="mailto:contact@indivisiblefairoaks.org"
                  className="text-primary-on-dark-muted hover:text-primary-on-dark font-semibold break-all"
                >
                  contact@indivisiblefairoaks.org
                </a>
              </div>
              <div>
                <span className="text-ink-muted-on-dark text-[11px] block uppercase tracking-wider">
                  <DataPoint name="footer.label_mailing">Mailing List:</DataPoint>
                </span>
                <a
                  href="mailto:subscribe@indivisiblefairoaks.org"
                  className="text-primary-on-dark-muted hover:text-primary-on-dark font-semibold break-all"
                >
                  subscribe@indivisiblefairoaks.org
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted-on-dark">
          <p>
            © <CopyrightYear /> Indivisible Fair Oaks-Carmichael.{' '}
            <DataPoint name="footer.copyright_disclaimer" as="span">
              All rights reserved. Grassroots volunteer organization.
            </DataPoint>
          </p>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-slate-200 transition-colors">
              About
            </Link>
            <Link href="/contact" className="hover:text-slate-200 transition-colors">
              Contact
            </Link>
            <a
              href="https://secure.actblue.com/donate/indivisiblefoc1432155925"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-gold hover:text-accent-gold transition-colors"
            >
              ActBlue
            </a>
            <Link href="/login" className="hover:text-slate-200 transition-colors">
              Organizer Access
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
