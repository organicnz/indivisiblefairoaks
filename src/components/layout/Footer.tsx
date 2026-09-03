import { Heart, Mail, MapPin, Music } from 'lucide-react';
import Link from 'next/link';

async function CopyrightYear() {
  'use cache';
  return <span>{new Date().getFullYear()}</span>;
}

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand & Mission Column */}
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md">
                IF
              </div>
              <div>
                <span className="text-white font-black text-lg tracking-tight uppercase block leading-tight">
                  Indivisible
                </span>
                <span className="text-blue-400 text-xs font-semibold uppercase block leading-tight">
                  Fair Oaks & Carmichael
                </span>
              </div>
            </Link>
            <p className="mt-4 text-xs sm:text-sm text-slate-400 leading-relaxed">
              A grassroots movement dedicated to defending democracy, resisting authoritarianism,
              electing progressive leaders, and taking direct non-violent action for our community.
            </p>
            <div className="mt-5 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
              <MapPin className="text-amber-400 shrink-0 mt-0.5" size={16} />
              <span>
                Meetings held monthly in Carmichael, CA. Bring a non-perishable food item for local
                food banks!
              </span>
            </div>
          </div>

          {/* Site Navigation */}
          <div className="col-span-1">
            <h3 className="text-amber-400 text-xs font-black uppercase tracking-widest mb-4">
              Explore
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
            <h3 className="text-amber-400 text-xs font-black uppercase tracking-widest mb-4">
              Get Involved
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
                  <Music size={14} className="text-blue-400" />
                  Sing in the Choir
                </Link>
              </li>
              <li>
                <a
                  href="mailto:subscribe@indivisiblefairoaks.org"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Mail size={14} className="text-blue-400" />
                  Subscribe to Newsletter
                </a>
              </li>
              <li>
                <Link
                  href="/donate"
                  className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold transition-colors"
                >
                  <Heart size={14} className="fill-amber-400" />
                  Donate via ActBlue
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Transparency */}
          <div className="col-span-1">
            <h3 className="text-amber-400 text-xs font-black uppercase tracking-widest mb-4">
              Connect With Us
            </h3>
            <div className="space-y-3 text-xs sm:text-sm">
              <p className="text-slate-400">
                Have a question or want to get involved with our local organizing team?
              </p>
              <div>
                <span className="text-slate-500 text-[11px] block uppercase tracking-wider">
                  General Inquiries:
                </span>
                <a
                  href="mailto:contact@indivisiblefairoaks.org"
                  className="text-blue-400 hover:text-blue-300 font-semibold break-all"
                >
                  contact@indivisiblefairoaks.org
                </a>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block uppercase tracking-wider">
                  Mailing List:
                </span>
                <a
                  href="mailto:subscribe@indivisiblefairoaks.org"
                  className="text-blue-400 hover:text-blue-300 font-semibold break-all"
                >
                  subscribe@indivisiblefairoaks.org
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © <CopyrightYear /> Indivisible Fair Oaks-Carmichael. All rights reserved. Grassroots
            volunteer organization.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-slate-400 transition-colors">
              About
            </Link>
            <Link href="/contact" className="hover:text-slate-400 transition-colors">
              Contact
            </Link>
            <a
              href="https://secure.actblue.com/donate/indivisiblefoc1432155925"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              ActBlue
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
