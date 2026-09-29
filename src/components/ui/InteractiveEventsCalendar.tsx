'use client';

import { CalendarPlus, Clock, Download, ExternalLink, MapPin, Music, Search } from 'lucide-react';
import { useState } from 'react';

export interface CivicEvent {
  id: string;
  title: string;
  category: 'Meetings' | 'Resistance Choir' | 'Voter Mobilization' | 'Rallies & Street Action';
  dateLabel: string;
  timeLabel: string;
  isoDateStart: string;
  isoDateEnd: string;
  locationName: string;
  address: string;
  description: string;
  rsvpUrl: string;
  highlight?: boolean;
}

const EVENTS: CivicEvent[] = [
  {
    id: 'monthly-gathering-sep',
    title: 'Monthly Chapter Gathering & Food Bank Drive',
    category: 'Meetings',
    dateLabel: 'Tuesday, September 1, 2026',
    timeLabel: '6:30 PM – 8:00 PM',
    isoDateStart: '20260901T183000',
    isoDateEnd: '20260901T200000',
    locationName: "St. Michael's Episcopal Church",
    address: '2140 Mission Avenue, Carmichael, CA 95608',
    description:
      'Our primary monthly community gathering. Agenda includes federal and local election strategies, organizing updates, and a food drive for our neighborhood pantry. Please bring canned or non-perishable goods.',
    rsvpUrl: 'https://www.mobilize.us/indivisible/',
    highlight: true,
  },
  {
    id: 'good-trouble-weekend',
    title: 'Good Trouble Lives On! Weekend of Action',
    category: 'Rallies & Street Action',
    dateLabel: 'Friday–Sunday, July 17–19, 2026',
    timeLabel: '10:00 AM – 2:00 PM Daily',
    isoDateStart: '20260717T100000',
    isoDateEnd: '20260719T140000',
    locationName: 'Fair Oaks & Carmichael Public Squares',
    address: 'Fair Oaks Blvd & Manzanita Ave, Carmichael, CA',
    description:
      'Honoring John Lewis through direct community presence, voter rights education, and deep canvassing around voter protection.',
    rsvpUrl: 'https://www.goodtroubleliveson.org/',
    highlight: true,
  },
  {
    id: 'choir-rehearsal-biweekly',
    title: 'Carmichael Resistance Choir Bi-Weekly Rehearsal',
    category: 'Resistance Choir',
    dateLabel: 'Every Other Wednesday',
    timeLabel: '6:30 PM – 8:00 PM',
    isoDateStart: '20260909T183000',
    isoDateEnd: '20260909T200000',
    locationName: 'Community Center / Church Hall',
    address: 'Carmichael, CA (Address provided upon registration)',
    description:
      'Learn 4-part harmonies, freedom anthems, and chants of resistance. No auditions or singing experience required — all voices are warmly welcomed!',
    rsvpUrl: 'mailto:contact@indivisiblefairoaks.org?subject=Join%20Resistance%20Choir',
  },
  {
    id: 'weekend-protest-song',
    title: 'Weekend of Protest Song Demonstration',
    category: 'Resistance Choir',
    dateLabel: 'Saturday Afternoon Rush',
    timeLabel: '3:00 PM – 4:30 PM',
    isoDateStart: '20260919T150000',
    isoDateEnd: '20260919T163000',
    locationName: 'Carmichael Corner Demonstration',
    address: 'Corner of Fair Oaks Blvd & Manzanita Ave, Carmichael, CA',
    description:
      'Singing protest to afternoon traffic and community patrons. Bring your signs, lawn chairs, and voices to stand up for democracy!',
    rsvpUrl: 'https://www.mobilize.us/indivisible/event/1011420/',
  },
  {
    id: 'deep-canvass-training',
    title: 'Deep Canvass Political Persuasion Training',
    category: 'Voter Mobilization',
    dateLabel: 'Saturday, September 12, 2026',
    timeLabel: '10:00 AM – 1:00 PM',
    isoDateStart: '20260912T100000',
    isoDateEnd: '20260912T130000',
    locationName: 'Online / Zoom Workshop',
    address: 'Sacramento County / Virtual',
    description:
      'Learn how to engage conflicted voters in meaningful 1-on-1 dialogue to counter disinformation and build voter turnout in swing districts.',
    rsvpUrl: 'https://www.mobilize.us/wethefighters/',
  },
  {
    id: 'fall-postcards-drive',
    title: 'Postcard Writing & Voter Outreach Blitz',
    category: 'Voter Mobilization',
    dateLabel: 'Sunday, September 20, 2026',
    timeLabel: '2:00 PM – 4:00 PM',
    isoDateStart: '20260920T140000',
    isoDateEnd: '20260920T160000',
    locationName: 'Fair Oaks Community Clubhouse',
    address: '7997 California Ave, Fair Oaks, CA 95628',
    description:
      'Writing handwritten postcards to registered voters in California swing districts encouraging turnout. Postcards, addresses, and scripts provided.',
    rsvpUrl: 'mailto:contact@indivisiblefairoaks.org?subject=Postcard%20Blitz%20RSVP',
  },
];

const CATEGORIES = [
  'All Actions',
  'Meetings',
  'Resistance Choir',
  'Voter Mobilization',
  'Rallies & Street Action',
] as const;

export function InteractiveEventsCalendar({
  initialEvents,
}: {
  initialEvents?: CivicEvent[];
} = {}) {
  const [activeCategory, setActiveCategory] = useState<string>('All Actions');
  const [searchQuery, setSearchQuery] = useState('');

  // Supabase rows when provided; inline rows keep pre-migration deploys working.
  const base = initialEvents && initialEvents.length > 0 ? initialEvents : EVENTS;
  const filteredEvents = base.filter((event) => {
    const matchesCategory = activeCategory === 'All Actions' || event.category === activeCategory;
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.locationName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const generateGoogleCalendarUrl = (event: CivicEvent) => {
    const title = encodeURIComponent(`Indivisible: ${event.title}`);
    const details = encodeURIComponent(
      `${event.description}\n\nRSVP / More info: ${event.rsvpUrl}`
    );
    const location = encodeURIComponent(`${event.locationName}, ${event.address}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${event.isoDateStart}/${event.isoDateEnd}&details=${details}&location=${location}`;
  };

  const downloadIcsFile = (event: CivicEvent) => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Indivisible Fair Oaks-Carmichael//Civic Calendar//EN',
      'BEGIN:VEVENT',
      `UID:${event.id}-${Date.now()}@indivisiblefairoaks.org`,
      `DTSTAMP:${event.isoDateStart}Z`,
      `DTSTART:${event.isoDateStart}`,
      `DTEND:${event.isoDateEnd}`,
      `SUMMARY:Indivisible: ${event.title}`,
      `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
      `LOCATION:${event.locationName}, ${event.address}`,
      `URL:${event.rsvpUrl}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${event.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Controls: Search and Filter Chips */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-secondary/90 border border-white/10 backdrop-blur-md">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted-on-dark"
            size={16}
          />
          <input
            type="text"
            placeholder="Search actions, meetings, or locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-primary-bright text-white shadow-md'
                  : 'bg-secondary/60 text-ink-muted-on-dark hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 gap-6">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-secondary border border-white/10 text-ink-muted-on-dark">
            No events found matching your criteria. Try selecting &ldquo;All Actions&rdquo; or
            clearing the search query.
          </div>
        ) : (
          // A live region on the *list container*, not on each result: a
          // screen reader should hear "6 events" once, not six announcements as
          // the grid renders. The count is the information a sighted user gets
          // from the list reflowing under them.
          <>
            <p role="status" aria-live="polite" className="sr-only">
              {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'} shown
            </p>
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className={`rounded-2xl p-6 sm:p-8 transition-all relative overflow-hidden flex flex-col justify-between ${
                  event.highlight
                    ? 'bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-primary-bright/40 shadow-xl'
                    : 'bg-secondary/80 border border-white/10/80 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-primary-on-dark text-xs font-mono font-semibold">
                      {event.category === 'Resistance Choir' && <Music size={12} />}
                      {event.category}
                    </span>
                    {event.highlight && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent-gold/20 text-accent-gold text-[11px] font-bold uppercase tracking-wider">
                        Featured Gathering
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-4">
                    {event.title}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-ink-on-dark mb-5">
                    <div className="flex items-center gap-2.5">
                      <Clock size={16} className="text-primary-on-dark-muted shrink-0" />
                      <div>
                        <span className="font-semibold text-white block">{event.dateLabel}</span>
                        <span className="text-ink-muted-on-dark text-xs">{event.timeLabel}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <MapPin size={16} className="text-accent-gold shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-white block">{event.locationName}</span>
                        <span className="text-ink-muted-on-dark text-xs">{event.address}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-ink-on-dark leading-relaxed mb-6">
                    {event.description}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-white/10/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {/* Google Calendar Link */}
                    <a
                      href={generateGoogleCalendarUrl(event)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
                      title="Add event to Google Calendar"
                    >
                      <CalendarPlus size={14} className="text-primary-on-dark-muted" />
                      <span>Google Cal</span>
                    </a>

                    {/* iCal / Outlook .ics Download */}
                    <button
                      type="button"
                      onClick={() => downloadIcsFile(event)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
                      title="Download iCal .ics for Apple Calendar & Outlook"
                    >
                      <Download size={14} className="text-accent-gold" />
                      <span>.ics Export</span>
                    </button>
                  </div>

                  <a
                    href={event.rsvpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-bright hover:bg-primary-light text-white font-bold text-xs uppercase tracking-wider shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary transition-colors duration-300 ease-out"
                  >
                    <span>RSVP for Event</span>
                    <ExternalLink size={13} aria-hidden="true" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
