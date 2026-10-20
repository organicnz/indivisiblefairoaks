'use client';

import { ChevronDown, ChevronUp, Heart, Music, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';

interface Song {
  id: string;
  title: string;
  author: string;
  category: 'Civil Rights' | 'Labor & Freedom' | 'Chants & Street Anthems';
  tempo: string;
  key: string;
  historicalContext: string;
  lyrics: string;
  chords?: string;
}

const SONGBOOK: Song[] = [
  {
    id: 'singing-for-our-lives',
    title: 'Singing for Our Lives',
    author: 'Holly Near (1978)',
    category: 'Civil Rights',
    tempo: 'Moderate & Resolute',
    key: 'F Major / G Major',
    historicalContext:
      'Written by Holly Near following the assassinations of Harvey Milk and Mayor George Moscone in San Francisco, this anthem became an international beacon of nonviolent resistance and LGBTQ+ solidarity.',
    lyrics: `We are a gentle, angry people, and we are singing, singing for our lives.
We are a justice-seeking people, and we are singing, singing for our lives.
We are young and old together, and we are singing, singing for our lives.
We are a land of many colors, and we are singing, singing for our lives.
We are gay and straight together, and we are singing, singing for our lives.
We are a gentle, loving people, and we are singing, singing for our lives.`,
    chords: 'Verse: C - G - Am - F | Chorus: C - G - F - C',
  },
  {
    id: 'aint-gonna-let-nobody',
    title: 'Ain’t Gonna Let Nobody Turn Me Around',
    author: 'Traditional Spiritual / Albany Movement (1962)',
    category: 'Civil Rights',
    tempo: 'Brisk Marching (112 BPM)',
    key: 'Eb Major',
    historicalContext:
      'Adapted by civil rights marchers in Albany, Georgia, and popularized across the South during the Selma to Montgomery marches. Its call-and-response form makes it perfect for rallies without printed sheet music.',
    lyrics: `Ain't gonna let nobody turn me around, turn me around, turn me around.
Ain't gonna let nobody turn me around, I'm gonna keep on a-walkin', keep on a-talkin',
Marchin' up to freedom land.

Ain't gonna let injustice turn me around...
Ain't gonna let no hatred turn me around...
Ain't gonna let voter suppression turn me around...
Ain't gonna let cynicism turn me around...`,
    chords: 'Progression: I - IV - I - V - I (Eb - Ab - Eb - Bb - Eb)',
  },
  {
    id: 'we-shall-not-be-moved',
    title: 'We Shall Not Be Moved',
    author: 'Traditional / Textile Workers Union (1931)',
    category: 'Labor & Freedom',
    tempo: 'Steady & Grounded',
    key: 'G Major',
    historicalContext:
      'Based on the spiritual "I Shall Not Be Moved" (Jeremiah 17:8), this anthem was sung during the Great Depression by integrated unions in the American South and later during civil rights sit-ins.',
    lyrics: `We shall not, we shall not be moved.
We shall not, we shall not be moved.
Just like a tree that’s planted by the water,
We shall not be moved.

Standing for democracy, we shall not be moved...
Black and white together, we shall not be moved...
Young and old together, we shall not be moved...`,
    chords: 'G - G - D7 - G | G - C - G/D - D7 - G',
  },
  {
    id: 'ellas-song',
    title: 'Ella’s Song',
    author: 'Bernice Johnson Reagon / Sweet Honey In The Rock (1988)',
    category: 'Civil Rights',
    tempo: 'Soulful & Passionate',
    key: 'D Minor',
    historicalContext:
      'Commemorating civil rights icon Ella Baker, founder of the Student Nonviolent Coordinating Committee (SNCC). The song immortalizes Baker’s timeless teaching: "Give light and people will find the way."',
    lyrics: `We who believe in freedom cannot rest.
We who believe in freedom cannot rest until it comes.

Until the killing of black men, black mothers’ sons,
Is as important as the killing of white men, white mothers’ sons.

That which touches me most is that I had a chance to work with people,
Passing on to others that which was passed on to me.`,
    chords: 'Dm - Bb - C - Dm',
  },
  {
    id: 'this-land-is-your-land',
    title: 'This Land Is Your Land (Original Restored Verses)',
    author: 'Woody Guthrie (1940)',
    category: 'Labor & Freedom',
    tempo: 'Uplifting Folk',
    key: 'E Major / D Major',
    historicalContext:
      'Guthrie wrote this counter-anthem to "God Bless America", describing the breathtaking beauty of America while protesting private property barriers and hunger on relief lines. The choir sings all restored original stanzas.',
    lyrics: `This land is your land, this land is my land,
From California to the New York island,
From the Redwood Forest to the Gulf Stream waters,
This land was made for you and me.

As I went walking I saw a sign there,
And on the sign it said "No Trespassing."
But on the other side it didn't say nothing,
That side was made for you and me.`,
    chords: 'D - G - D - A7 - D',
  },
];

export function ChoirSongbookExplorer() {
  const { dataPoints } = useDataPoints('choir');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedSongId, setExpandedSongId] = useState<string | null>('singing-for-our-lives');
  const [showChords, setShowChords] = useState(false);

  const categories = [
    { id: 'All', key: 'choir.songbook.all_categories', defaultLabel: 'All Repertoire' },
    { id: 'Civil Rights', key: 'choir.songbook.cat.civil_rights', defaultLabel: 'Civil Rights' },
    { id: 'Labor & Freedom', key: 'choir.songbook.cat.labor', defaultLabel: 'Labor & Freedom' },
    {
      id: 'Chants & Street Anthems',
      key: 'choir.songbook.cat.chants',
      defaultLabel: 'Chants & Street Anthems',
    },
  ];

  const filteredSongs = SONGBOOK.filter((song) => {
    const matchesCat = selectedCategory === 'All' || song.category === selectedCategory;
    const matchesSearch =
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.lyrics.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="rounded-3xl bg-surface-card border border-border text-foreground dark:bg-secondary dark:border-white/10 dark:text-white p-6 sm:p-8 md:p-10 shadow-card dark:shadow-2xl backdrop-blur-xl space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary-ink dark:bg-primary-bright/20 dark:border-transparent dark:text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-3">
          <Music size={14} className="text-accent-gold" />
          <DataPoint as="span" name="choir.songbook.eyebrow" initialData={dataPoints}>
            Carmichael Resistance Choir Songbook
          </DataPoint>
        </div>
        <DataPoint
          as="h2"
          name="choir.songbook.headline"
          initialData={dataPoints}
          className="text-2xl sm:text-3xl font-black text-foreground dark:text-white tracking-tight mb-2"
        >
          Anthems, Chants & Freedom Songs
        </DataPoint>
        <DataPoint
          as="p"
          name="choir.songbook.subhead"
          initialData={dataPoints}
          className="text-sm sm:text-base text-muted-foreground dark:text-ink-on-dark max-w-2xl leading-relaxed"
        >
          Browse our repertoire of four-part harmony arrangements and call-and-response rally
          chants. Click any song to view lyrics, chord charts, and historical background.
        </DataPoint>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface-muted border border-border">
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-ink-muted-on-dark"
            size={16}
          />
          <input
            type="text"
            placeholder={
              dataPoints['choir.songbook.search_placeholder'] ||
              'Search songs by title, lyrics, or historical era…'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-card border border-border text-foreground placeholder:text-muted-foreground dark:bg-secondary dark:border-slate-700 dark:text-white dark:placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-primary dark:focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-primary hover:bg-primary-dark text-white dark:bg-primary-bright shadow-sm'
                  : 'bg-surface-card text-muted-foreground hover:text-foreground border border-border dark:bg-secondary dark:text-ink-muted-on-dark dark:hover:text-slate-200 dark:border-transparent'
              }`}
            >
              <DataPoint as="span" name={cat.key} initialData={dataPoints}>
                {cat.defaultLabel}
              </DataPoint>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowChords((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all border cursor-pointer ${
              showChords
                ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-accent-gold/20 dark:text-accent-gold dark:border-accent-gold/40'
                : 'bg-surface-card text-muted-foreground border-border hover:text-foreground dark:bg-secondary dark:text-ink-muted-on-dark dark:border-white/10 dark:hover:text-slate-200'
            }`}
          >
            {showChords ? 'Chords: Visible' : 'Show Chords'}
          </button>
        </div>
      </div>

      {/* Song List */}
      <div className="space-y-4">
        {filteredSongs.length === 0 ? (
          <div className="p-8 text-center space-y-1">
            <DataPoint
              as="h3"
              name="choir.songbook.empty_title"
              initialData={dataPoints}
              className="font-bold text-foreground dark:text-white text-sm"
            >
              No songs matched your search.
            </DataPoint>
            <DataPoint
              as="p"
              name="choir.songbook.empty_desc"
              initialData={dataPoints}
              className="text-xs text-muted-foreground dark:text-ink-muted-on-dark"
            >
              Try searching for a different keyword, artist, or historical era.
            </DataPoint>
          </div>
        ) : (
          <>
            {/* One announcement for the list, not one per row. */}
            <p role="status" aria-live="polite" className="sr-only">
              {filteredSongs.length} song{filteredSongs.length === 1 ? '' : 's'} shown
            </p>
            {filteredSongs.map((song) => {
              const isExpanded = expandedSongId === song.id;
              return (
                <div
                  key={song.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isExpanded
                      ? 'bg-surface-card border-primary/40 shadow-card dark:bg-secondary/80 dark:border-primary-bright/50 dark:shadow-xl'
                      : 'bg-surface-card border-border hover:border-primary/30 dark:bg-secondary/40 dark:border-white/10 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Header Row / Toggle */}
                  <button
                    type="button"
                    onClick={() => setExpandedSongId(isExpanded ? null : song.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`song-body-${song.id}`}
                    className="w-full min-h-11 p-5 sm:p-6 text-left flex items-center justify-between gap-4 transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-inset"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isExpanded
                            ? 'bg-primary text-white dark:bg-primary-bright'
                            : 'bg-surface-muted text-primary-ink border border-border dark:border-transparent dark:bg-white/5 dark:text-primary-on-dark-muted'
                        }`}
                      >
                        <Music size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-base sm:text-lg font-bold text-foreground dark:text-white leading-snug">
                            {song.title}
                          </h3>
                          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-surface-muted border border-border dark:border-transparent dark:bg-white/5 text-[10px] font-mono text-muted-foreground dark:text-ink-on-dark">
                            {song.category}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground dark:text-ink-muted-on-dark">
                          {song.author}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex items-center gap-3 text-xs font-mono text-muted-foreground dark:text-ink-muted-on-dark">
                        <span>Key: {song.key}</span>
                        <span>•</span>
                        <span>{song.tempo}</span>
                      </div>
                      <div className="p-1 rounded-lg text-muted-foreground dark:text-ink-muted-on-dark">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div
                      id={`song-body-${song.id}`}
                      className="px-5 sm:px-6 pb-6 pt-2 border-t border-border dark:border-white/10 space-y-6"
                    >
                      {/* Historical Context */}
                      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs sm:text-sm text-foreground leading-relaxed flex items-start gap-3 dark:bg-blue-950/30 dark:border-primary-bright/20 dark:text-primary-on-dark/90">
                        <Sparkles size={16} className="text-accent-gold shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-foreground dark:text-white block mb-0.5">
                            <DataPoint
                              as="span"
                              name="choir.songbook.context_tab"
                              initialData={dataPoints}
                            >
                              Historical Context &amp; Heritage
                            </DataPoint>
                            :
                          </strong>
                          {song.historicalContext}
                        </div>
                      </div>

                      {/* Chords Box if enabled */}
                      {showChords && song.chords && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 dark:bg-accent-gold/10 dark:border-accent-gold/20 font-mono text-xs text-amber-800 dark:text-accent-gold flex items-center justify-between">
                          <span>
                            <DataPoint
                              as="span"
                              name="choir.songbook.chords_tab"
                              initialData={dataPoints}
                            >
                              Chords &amp; Key
                            </DataPoint>
                            : {song.chords}
                          </span>
                          <span className="text-[10px] text-amber-700 dark:text-accent-gold/90">
                            Guitar / Keyboard
                          </span>
                        </div>
                      )}

                      {/* Lyrics Box */}
                      <div className="p-5 rounded-xl bg-surface-muted border border-border font-serif text-sm sm:text-base text-foreground dark:text-slate-200 leading-relaxed whitespace-pre-line">
                        <p className="font-sans text-[10px] font-black uppercase tracking-widest text-primary-ink dark:text-accent-gold mb-2">
                          <DataPoint
                            as="span"
                            name="choir.songbook.lyrics_tab"
                            initialData={dataPoints}
                          >
                            Lyrics &amp; Call-and-Response
                          </DataPoint>
                        </p>
                        {song.lyrics}
                      </div>

                      {/* Rehearsal Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground dark:text-ink-muted-on-dark pt-2">
                        <div className="flex items-center gap-1.5">
                          <Heart
                            size={13}
                            className="text-rose-500 fill-rose-500 dark:text-rose-400 dark:fill-rose-400"
                          />
                          <span>
                            Sung by the Carmichael Resistance Choir at community demonstrations.
                          </span>
                        </div>
                        <a
                          href="mailto:contact@indivisiblefairoaks.org?subject=Sheet%20Music%20Request"
                          className="text-primary-ink hover:underline dark:text-primary-on-dark dark:hover:text-primary-on-dark/90 font-semibold"
                        >
                          Request Complete Sheet Music / SATB Scores →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
