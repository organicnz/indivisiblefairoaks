'use client';

import { ChevronDown, ChevronUp, Heart, Music, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedSongId, setExpandedSongId] = useState<string | null>('singing-for-our-lives');
  const [showChords, setShowChords] = useState(false);

  const categories = ['All', 'Civil Rights', 'Labor & Freedom', 'Chants & Street Anthems'];

  const filteredSongs = SONGBOOK.filter((song) => {
    const matchesCat = selectedCategory === 'All' || song.category === selectedCategory;
    const matchesSearch =
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.lyrics.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 md:p-10 shadow-2xl backdrop-blur-xl space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-3">
          <Music size={14} className="text-amber-400" />
          <span>Carmichael Resistance Choir Songbook</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
          Anthems, Chants & Freedom Songs
        </h2>
        <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
          Browse our repertoire of four-part harmony arrangements and call-and-response rally
          chants. Click any song to view lyrics, chord charts, and historical background.
        </p>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search lyrics, song titles, or composers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowChords((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all border ${
              showChords
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {showChords ? 'Chords: Visible' : 'Show Chords'}
          </button>
        </div>
      </div>

      {/* Song List */}
      <div className="space-y-4">
        {filteredSongs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No songs found matching your search.
          </div>
        ) : (
          filteredSongs.map((song) => {
            const isExpanded = expandedSongId === song.id;
            return (
              <div
                key={song.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isExpanded
                    ? 'bg-slate-950/80 border-blue-500/50 shadow-xl'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Header Row / Toggle */}
                <button
                  type="button"
                  onClick={() => setExpandedSongId(isExpanded ? null : song.id)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-800 text-blue-400'
                      }`}
                    >
                      <Music size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                          {song.title}
                        </h3>
                        <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-300">
                          {song.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{song.author}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-3 text-xs font-mono text-slate-400">
                      <span>Key: {song.key}</span>
                      <span>•</span>
                      <span>{song.tempo}</span>
                    </div>
                    <div className="p-1 rounded-lg text-slate-400">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-slate-800/80 space-y-6">
                    {/* Historical Context */}
                    <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs sm:text-sm text-blue-200/90 leading-relaxed flex items-start gap-3">
                      <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block mb-0.5">Historical Context:</strong>
                        {song.historicalContext}
                      </div>
                    </div>

                    {/* Chords Box if enabled */}
                    {showChords && song.chords && (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 font-mono text-xs text-amber-300 flex items-center justify-between">
                        <span>Chords: {song.chords}</span>
                        <span className="text-[10px] text-amber-400/80">Guitar / Keyboard</span>
                      </div>
                    )}

                    {/* Lyrics Box */}
                    <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 font-serif text-sm sm:text-base text-slate-200 leading-relaxed whitespace-pre-line">
                      {song.lyrics}
                    </div>

                    {/* Rehearsal Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-2">
                      <div className="flex items-center gap-1.5">
                        <Heart size={13} className="text-rose-400 fill-rose-400" />
                        <span>
                          Sung by the Carmichael Resistance Choir at community demonstrations.
                        </span>
                      </div>
                      <a
                        href="mailto:contact@indivisiblefairoaks.org?subject=Sheet%20Music%20Request"
                        className="text-blue-400 hover:text-blue-300 font-semibold"
                      >
                        Request Complete Sheet Music / SATB Scores →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
