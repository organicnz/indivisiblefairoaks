export interface ChoirSongTrack {
  id: string;
  titleKey: string;
  artistKey: string;
  notesKey: string;
  defaultTitle: string;
  defaultArtist: string;
  defaultNotes: string;
  duration: string;
  audioUrl?: string;
}

export const DEFAULT_CHOIR_TRACKS: ChoirSongTrack[] = [
  {
    id: 'anthem-1',
    titleKey: 'choir.player.track1_title',
    artistKey: 'choir.player.track1_artist',
    notesKey: 'choir.player.track1_notes',
    defaultTitle: 'America the Beautiful',
    defaultArtist: 'U.S. Navy Band Sea Chanters Choral',
    defaultNotes: 'Official public domain choral arrangement of Katherine Lee Bates anthem',
    duration: '2:21',
    audioUrl: 'audio/america-the-beautiful.ogg',
  },
  {
    id: 'anthem-2',
    titleKey: 'choir.player.track2_title',
    artistKey: 'choir.player.track2_artist',
    notesKey: 'choir.player.track2_notes',
    defaultTitle: 'The Star-Spangled Banner',
    defaultArtist: "U.S. Army Field Band & Soldiers' Chorus",
    defaultNotes: "Choral anthem with band accompaniment by the Soldiers' Chorus",
    duration: '1:29',
    audioUrl: 'audio/star-spangled-banner.ogg',
  },
  {
    id: 'anthem-3',
    titleKey: 'choir.player.track3_title',
    artistKey: 'choir.player.track3_artist',
    notesKey: 'choir.player.track3_notes',
    defaultTitle: 'Battle Hymn of the Republic',
    defaultArtist: 'U.S. Air Force Band & Singing Sergeants Choral',
    defaultNotes:
      'Historical choral rallying anthem for collective resilience, justice, and solidarity',
    duration: '5:27',
    audioUrl: 'audio/battle-hymn-of-the-republic.ogg',
  },
  {
    id: 'anthem-4',
    titleKey: 'choir.player.track4_title',
    artistKey: 'choir.player.track4_artist',
    notesKey: 'choir.player.track4_notes',
    defaultTitle: 'Ode to Joy (Anthem of Peace & Europe)',
    defaultArtist: 'U.S. Navy Band Choral & Concert Orchestra',
    defaultNotes: 'Universal anthem of brotherhood, human dignity, democracy, and solidarity',
    duration: '1:56',
    audioUrl: 'audio/ode-to-joy.ogg',
  },
  {
    id: 'anthem-5',
    titleKey: 'choir.player.track5_title',
    artistKey: 'choir.player.track5_artist',
    notesKey: 'choir.player.track5_notes',
    defaultTitle: 'Ave Maria (Sacred Choral)',
    defaultArtist: 'Sea Chanters Choral Ensemble',
    defaultNotes: 'Anton Bruckner choral presentation performed by U.S. Navy Band Sea Chanters',
    duration: '3:14',
    audioUrl: 'audio/ave-maria.ogg',
  },
];
