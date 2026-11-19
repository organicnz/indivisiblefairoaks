// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  analyzeNewsText,
  buildNewsSearchSnippet,
  collectNewsletterTopics,
  containsNewsPhrase,
  countNewsletterTopics,
  displayNewsQuery,
  hasNewsletterTopic,
  hasNewsQuery,
  inspectNewsText,
  isAllNewsletterTopics,
  mergeNewsletterRows,
  NEWSLETTER_CARD_EXCERPT_LENGTH,
  NEWSLETTER_LONG_SENTENCE_WORDS,
  newsletterTopicKey,
  normalizeNewsText,
  parseNewsletterTopicInput,
  parseNewsQuery,
  resolveNewsQuery,
  searchNewsletters,
  searchNewsPosts,
  sortNewsletters,
  splitNewsTextHighlights,
  tidyNewsText,
  uniqueNewsletterTopics,
} from '@/lib/news-text';
import {
  matchesPreparedNewsText,
  prepareNewsField,
  scorePreparedNewsText,
} from '@/lib/news-text/match';

const newsletter = {
  slug: 'summer-bulletin',
  title: 'Summer Action Bulletin',
  date_label: 'July 2026',
  description: 'Election defense and choir actions across Sacramento County.',
  topics: ['Election Defense', 'Choir Actions'],
  sort_order: 10,
};

const matchesTitle = (title: string, query: string) =>
  searchNewsPosts([{ title }], query).length > 0;

describe('news and newsletter text processing', () => {
  it('normalizes case, accents, punctuation, apostrophes and ampersands', () => {
    expect(normalizeNewsText('  Résumé & Chapter’s — July!  ')).toBe('resume and chapters july');
    expect(parseNewsQuery('Election, election DEFENSE').tokens).toEqual(['election', 'defense']);
  });

  it('keeps non-Latin names and folds invisible paste characters', () => {
    expect(normalizeNewsText('  Café\u00A0東京\u200B  ')).toBe('cafe 東京');
    expect(normalizeNewsText('Søren Straße')).toBe('soren strasse');
    expect(normalizeNewsText('naïve')).toBe('naive');
    expect(hasNewsQuery('  \u200B ')).toBe(false);
    expect(hasNewsQuery('school')).toBe(true);
    expect(displayNewsQuery('  choir   actions \u200B ')).toBe('choir actions');
    expect(resolveNewsQuery('  \u200B ')).toBe('');
    expect(resolveNewsQuery('  choir   actions ')).toBe('choir actions');
  });

  it('matches every token across fields instead of requiring one exact phrase', () => {
    expect(
      searchNewsPosts(
        [{ title: 'Summer Action Bulletin', excerpt: 'Election defense update' }],
        'bulletin defense'
      )
    ).toHaveLength(1);
    expect(matchesTitle('Summer Action Bulletin', 'bulletin choir')).toBe(false);
    expect(matchesTitle('Earth Day', 'art')).toBe(false);
    expect(matchesTitle('Public Schools', 'school')).toBe(true);
    expect(matchesTitle('Community Funding', 'fund')).toBe(true);
    expect(matchesTitle('Summer Action Bulletin', '   ')).toBe(true);
  });

  it('keeps quoted phrases contiguous while leaving unquoted terms forgiving', () => {
    const parsed = parseNewsQuery('"public schools" funding');
    expect(parsed.tokens).toEqual(['public', 'schools', 'funding']);
    expect(parsed.phrases).toEqual([['public', 'schools']]);
    expect(parseNewsQuery('“public schools”').phrases).toEqual([['public', 'schools']]);
    expect(containsNewsPhrase(['public', 'schools', 'funding'], ['public', 'schools'])).toBe(true);
    expect(containsNewsPhrase(['public', 'funding', 'schools'], ['public', 'schools'])).toBe(false);

    expect(matchesTitle('Public schools funding', '"public schools"')).toBe(true);
    expect(matchesTitle('Public funding for schools', '"public schools"')).toBe(false);
    expect(
      searchNewsPosts([{ title: 'Public', excerpt: 'schools update' }], '"public schools"')
    ).toHaveLength(0);
    expect(matchesTitle('Public funding for schools', 'public schools')).toBe(true);
    expect(matchesTitle('Public schools funding', '"public schools" funding')).toBe(true);
  });

  it('ranks a title phrase ahead of the same phrase in a summary', () => {
    const ranked = searchNewsPosts(
      [
        { title: 'Budget notes', excerpt: 'Public schools funding' },
        { title: 'Public schools funding', excerpt: 'Budget notes' },
      ],
      '"public schools"'
    );

    expect(ranked.map((post) => post.title)).toEqual(['Public schools funding', 'Budget notes']);
  });

  it('searches newsletters by normalized tokens', () => {
    expect(searchNewsletters([newsletter], 'defense sacramento')).toEqual([newsletter]);
    expect(searchNewsletters([newsletter], 'defense')).toEqual([newsletter]);
    expect(searchNewsletters([newsletter], 'housing')).toEqual([]);
    expect(hasNewsletterTopic(newsletter.topics, ' election defense ')).toBe(true);
    expect(hasNewsletterTopic(newsletter.topics, 'housing')).toBe(false);
  });

  it('requires a quoted phrase to stay within one bulletin field', () => {
    expect(
      searchNewsletters(
        [{ ...newsletter, title: 'Public schools update', description: 'Funding details.' }],
        '"public schools"'
      )
    ).toHaveLength(1);
    expect(
      searchNewsletters(
        [{ ...newsletter, title: 'Public funding update', description: 'Schools details.' }],
        '"public schools"'
      )
    ).toEqual([]);
  });

  it('honours a translated All Topics label', () => {
    expect(isAllNewsletterTopics('  all   topics ', 'All Topics')).toBe(true);
    expect(isAllNewsletterTopics('All Topics', 'Tous les sujets')).toBe(true);
    expect(isAllNewsletterTopics('Tous les sujets', 'Tous les sujets')).toBe(true);
    expect(isAllNewsletterTopics('Housing', 'All Topics')).toBe(false);
    expect(isAllNewsletterTopics('', '')).toBe(false);
  });

  it('shares one topic identity across filtering, counting and card chips', () => {
    expect(newsletterTopicKey('  Élection Defense! ')).toBe('election defense');
    expect(newsletterTopicKey('Arts & Culture')).toBe('arts and culture');
    expect(
      uniqueNewsletterTopics(
        [' Election Defense ', 'election defense!', 'All Topics', 'Tous les sujets', 'Choir'],
        'Tous les sujets'
      )
    ).toEqual(['Election Defense', 'Choir']);
    expect(uniqueNewsletterTopics(['', '  ', '!!!'])).toEqual([]);
  });

  it('collects topics in first-seen order and removes case-insensitive duplicates', () => {
    expect(
      collectNewsletterTopics([
        { topics: [' Election Defense ', 'choir'] },
        { topics: ['Election defense', '', 'Choir'] },
      ])
    ).toEqual(['Election Defense', 'choir']);
    expect(collectNewsletterTopics([{ topics: ['All Topics', 'Choir'] }])).toEqual(['Choir']);
  });

  it('counts topics from the rows already matched by the query', () => {
    const bulletin = {
      ...newsletter,
      slug: 'choir-bulletin',
      title: 'Choir Night',
      description: 'Music and organizing in the park.',
      topics: ['Choir Actions'],
    };

    expect(countNewsletterTopics([newsletter, bulletin])).toEqual({
      all: 2,
      byTopic: {
        'election defense': 1,
        'choir actions': 2,
      },
    });
    expect(countNewsletterTopics(searchNewsletters([newsletter, bulletin], 'election'))).toEqual({
      all: 1,
      byTopic: { 'election defense': 1, 'choir actions': 1 },
    });
  });

  it('searches news posts and bulletins through one filtered-and-ranked API', () => {
    const posts = [
      { title: 'Community Update', excerpt: 'Schools and funding across the county.' },
      { title: 'Public Schools Funding', excerpt: 'A deep look at the budget.' },
      { title: 'Choir Night', excerpt: 'Music and organizing.' },
    ];
    expect(searchNewsPosts(posts, 'schools funding').map((post) => post.title)).toEqual([
      'Public Schools Funding',
      'Community Update',
    ]);

    const bulletins = [
      {
        title: 'September Roundup',
        description: 'Election defense and choir actions.',
        topics: ['Local Action'],
      },
      {
        title: 'Choir Actions Bulletin',
        description: 'Music and organizing.',
        topics: ['Choir Actions'],
      },
    ];
    expect(searchNewsletters(bulletins, 'choir actions').map((item) => item.title)).toEqual([
      'Choir Actions Bulletin',
      'September Roundup',
    ]);
  });

  it('filters news posts by title, excerpt and slug', () => {
    const posts = [
      { title: 'Public Schools', excerpt: 'A local funding explainer', slug: 'public-schools' },
      { title: 'Choir Night', excerpt: 'Music and organizing', slug: 'choir-night' },
    ];
    expect(searchNewsPosts(posts, 'schools funding')).toEqual([posts[0]]);
    expect(searchNewsPosts(posts, 'choir-night')).toEqual([posts[1]]);
  });

  it('handles empty prepared fields, phrase boundaries and scoring fallbacks', () => {
    expect(prepareNewsField(null)).toBeNull();
    expect(prepareNewsField(undefined)).toBeNull();
    expect(prepareNewsField('')).toBeNull();
    expect(prepareNewsField('  !!!  ')).toBeNull();
    expect(prepareNewsField('  Public   Schools ')).toEqual({ words: ['public', 'schools'] });

    const parsed = parseNewsQuery('public schools');
    const phrase = parseNewsQuery('"public schools"');
    expect(matchesPreparedNewsText([], { tokens: [], phrases: [] })).toBe(true);
    expect(
      matchesPreparedNewsText([prepareNewsField('public'), prepareNewsField('schools')], parsed)
    ).toBe(true);
    expect(matchesPreparedNewsText([null, prepareNewsField('public')], parsed)).toBe(false);
    expect(
      matchesPreparedNewsText([prepareNewsField('public'), prepareNewsField('schools')], phrase)
    ).toBe(false);
    expect(matchesPreparedNewsText([prepareNewsField('public schools')], phrase)).toBe(true);

    expect(scorePreparedNewsText([], { tokens: [], phrases: [] })).toBe(0);
    expect(
      scorePreparedNewsText([null, { words: [] }, prepareNewsField('public schools')], phrase)
    ).toBeGreaterThan(0);
    expect(scorePreparedNewsText([prepareNewsField('other')], parsed)).toBe(0);
    expect(scorePreparedNewsText([prepareNewsField('public')], parsed, [])).toBeGreaterThan(0);
  });

  it('keeps caller order for equal scores and accepts bulletins without topics', () => {
    expect(
      searchNewsPosts([{ title: 'Same one' }, { title: 'Same two' }], 'same').map(
        (post) => post.title
      )
    ).toEqual(['Same one', 'Same two']);
    expect(collectNewsletterTopics([{ topics: null }])).toEqual([]);
    expect(collectNewsletterTopics([{}])).toEqual([]);
    expect(searchNewsletters([{ title: 'No topics', topics: null }], 'no')).toHaveLength(1);
  });

  it('sorts by explicit order and then title without mutating the input', () => {
    const input = [
      { title: 'Zebra', sort_order: 10 },
      { title: 'alpha', sort_order: 10 },
      { title: 'Pinned', sort_order: 1 },
    ];
    expect(sortNewsletters(input).map((item) => item.title)).toEqual(['Pinned', 'alpha', 'Zebra']);
    expect(input.map((item) => item.title)).toEqual(['Zebra', 'alpha', 'Pinned']);
  });

  it('replaces a renamed row instead of leaving the old slug behind', () => {
    const renamed = { ...newsletter, slug: 'july-bulletin', title: 'July Bulletin' };
    expect(
      mergeNewsletterRows([newsletter], renamed, newsletter.slug).map((item) => item.slug)
    ).toEqual(['july-bulletin']);
  });

  it('parses pasted comma, semicolon and newline separated topics', () => {
    expect(
      parseNewsletterTopicInput('Election Defense, Choir Actions; Food Drive\nHousing')
    ).toEqual(['Election Defense', 'Choir Actions', 'Food Drive', 'Housing']);
    expect(
      parseNewsletterTopicInput(
        '  Election   Defense,\r\nchoir  actions; election defense | Housing '
      )
    ).toEqual(['Election Defense', 'choir actions', 'Housing']);
    expect(
      parseNewsletterTopicInput('• Election Defense\n2. Choir Actions\n#Housing\tFood Drive')
    ).toEqual(['Election Defense', 'Choir Actions', 'Housing', 'Food Drive']);
    expect(parseNewsletterTopicInput('Election Defense • Choir Actions · Housing')).toEqual([
      'Election Defense',
      'Choir Actions',
      'Housing',
    ]);
  });

  it('counts words and gives a minimum one-minute reading estimate', () => {
    expect(analyzeNewsText('  One two three  ').words).toBe(3);
    expect(analyzeNewsText('   ').words).toBe(0);
    expect(analyzeNewsText("chapter's don't-stop").words).toBe(2);
    expect(analyzeNewsText('word '.repeat(201)).readingMinutes).toBe(2);
    expect(analyzeNewsText('').readingMinutes).toBe(0);
  });

  it('ranks title matches ahead of summary matches without losing ties', () => {
    const posts = [
      {
        title: 'Community Update',
        excerpt: 'Schools and funding across the county.',
        slug: 'community-update',
      },
      {
        title: 'Public Schools Funding',
        excerpt: 'A deep look at the budget.',
        slug: 'public-schools-funding',
      },
      {
        title: 'Choir Night',
        excerpt: 'Music and organizing.',
        slug: 'choir-night',
      },
    ];

    expect(searchNewsPosts(posts, 'schools funding').map((post) => post.title)).toEqual([
      'Public Schools Funding',
      'Community Update',
    ]);
    expect(searchNewsPosts(posts, '').map((post) => post.title)).toEqual(
      posts.map((post) => post.title)
    );
  });

  it('ranks bulletin title and topic matches ahead of summary matches', () => {
    const items = [
      {
        title: 'September Roundup',
        description: 'Election defense and choir actions.',
        topics: ['Local Action'],
      },
      {
        title: 'Choir Actions Bulletin',
        description: 'Music and organizing.',
        topics: ['Choir Actions'],
      },
    ];

    expect(searchNewsletters(items, 'choir actions').map((item) => item.title)).toEqual([
      'Choir Actions Bulletin',
      'September Roundup',
    ]);
  });

  it('ranks whole-word matches ahead of longer-word prefixes', () => {
    const posts = [
      { title: 'Schooling Update', excerpt: '', slug: 'schooling-update' },
      { title: 'School Update', excerpt: '', slug: 'school-update' },
    ];

    expect(searchNewsPosts(posts, 'school').map((post) => post.title)).toEqual([
      'School Update',
      'Schooling Update',
    ]);
  });

  it('filters bulletins by topic through the shared topic identity', () => {
    const bulletins = [
      { ...newsletter, slug: 'elections', title: 'Election Update', topics: ['Elections'] },
      { ...newsletter, slug: 'choir', title: 'Choir Night', topics: ['Choir Actions'] },
    ];

    expect(
      bulletins.filter((item) => hasNewsletterTopic(item.topics ?? [], 'choir actions'))
    ).toEqual([bulletins[1]]);
  });

  it('builds a snippet around the first matching word and preserves the original wording', () => {
    const text = `${'Introductory context. '.repeat(20)}Schools funding matters here.${' More context.'.repeat(20)}`;
    const snippet = buildNewsSearchSnippet(text, 'funding', 90);

    expect(snippet).toContain('Schools funding matters here.');
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(94);
    expect(buildNewsSearchSnippet('Short text', 'short', 90)).toBe('Short text');
  });

  it('does not crop an excerpt when the query only matched another field', () => {
    const text = 'A long excerpt that should remain readable in full. '.repeat(8).trim();
    expect(buildNewsSearchSnippet(text, 'title-only-match', 80)).toBe(text);

    const scatteredPhrase =
      `${'A public funding update. '.repeat(8)}Schools remain important.`.trim();
    expect(buildNewsSearchSnippet(scatteredPhrase, '"public schools"', 80)).toBe(scatteredPhrase);
  });

  it('does not crop an excerpt when the query has no searchable characters', () => {
    const text = 'A long chapter update that should stay intact. '.repeat(10).trim();
    expect(buildNewsSearchSnippet(text, '   \u200B ', 80)).toBe(text);
  });

  it('centers a quoted-phrase snippet on the phrase, not an earlier loose token', () => {
    const text = `${'Public notice. '.repeat(12)}Our public schools matter here. ${'More context. '.repeat(20)}`;
    const snippet = buildNewsSearchSnippet(text, '"public schools"', 80);

    expect(snippet).toContain('public schools matter here.');
    expect(snippet.length).toBeLessThanOrEqual(84);
  });

  it('splits original text into safe word-level highlight segments', () => {
    const segments = splitNewsTextHighlights('Public Schools, funding!', 'school fund');

    expect(segments.map((segment) => segment.text).join('')).toBe('Public Schools, funding!');
    expect(segments.filter((segment) => segment.matched).map((segment) => segment.text)).toEqual([
      'Schools',
      'funding',
    ]);
    expect(splitNewsTextHighlights('Choir Night', '')).toEqual([
      { text: 'Choir Night', matched: false },
    ]);
    expect(splitNewsTextHighlights('', 'school')).toEqual([]);
    expect(splitNewsTextHighlights('Choir', '"public schools"')).toEqual([
      { text: 'Choir', matched: false },
    ]);
    expect(
      splitNewsTextHighlights('School-funding update', 'school')
        .filter((segment) => segment.matched)
        .map((segment) => segment.text)
    ).toEqual(['School']);
  });

  it('keeps a quoted phrase in one continuous highlight run', () => {
    const segments = splitNewsTextHighlights('Our Public schools funding', '"public schools"');

    expect(segments.map((segment) => segment.text).join('')).toBe('Our Public schools funding');
    expect(segments.filter((segment) => segment.matched).map((segment) => segment.text)).toEqual([
      'Public schools',
    ]);

    const ampersandPhrase = splitNewsTextHighlights('Arts & Culture', '"arts and culture"');
    expect(
      ampersandPhrase.filter((segment) => segment.matched).map((segment) => segment.text)
    ).toEqual(['Arts & Culture']);
  });

  it('analyzes word, sentence and paragraph counts in one pass', () => {
    const analysis = analyzeNewsText('One two. Three four!\n\nFive six?');

    expect(analysis).toEqual({
      characters: 31,
      charactersNoSpaces: 25,
      words: 6,
      sentences: 3,
      paragraphs: 2,
      readingMinutes: 1,
      averageWordsPerSentence: 2,
      longSentences: 0,
    });
    expect(analyzeNewsText('No punctuation here').sentences).toBe(1);
    expect(analyzeNewsText('He said, “Go.” Then left.').sentences).toBe(2);
    expect(analyzeNewsText('We raised 3.5 million dollars.').sentences).toBe(1);
    expect(analyzeNewsText('U.S. officials met. They agreed.').sentences).toBe(2);
    expect(analyzeNewsText('Heading\n\nA complete sentence.').sentences).toBe(2);
    expect(analyzeNewsText('One.\n\n \n\nTwo.').sentences).toBe(2);
    expect(analyzeNewsText('One\n\nTwo\n\nThree').paragraphs).toBe(3);
    expect(analyzeNewsText('One\r\n\r\nTwo').paragraphs).toBe(2);
  });

  it('flags sentences that exceed the readable-length threshold', () => {
    const longWordCount = NEWSLETTER_LONG_SENTENCE_WORDS + 1;
    const longSentence = `${'word '.repeat(longWordCount).trim()}.`;
    const analysis = analyzeNewsText(longSentence);

    expect(analysis.longSentences).toBe(1);
    expect(analysis.averageWordsPerSentence).toBe(longWordCount);
  });

  it('reviews summaries for card fit, readability, repetition and completeness', () => {
    const clean = inspectNewsText(
      'A clear summary about the budget vote and what it means for local families.'
    ).suggestions;
    expect(clean).toEqual([]);

    const short = inspectNewsText('Too short.').suggestions;
    expect(short.map((suggestion) => suggestion.id)).toContain('short');

    const long = inspectNewsText(`${'word '.repeat(NEWSLETTER_LONG_SENTENCE_WORDS + 2).trim()}.`, {
      cardLength: 80,
    }).suggestions;
    const longIds = long.map((suggestion) => suggestion.id);
    expect(longIds).toContain('card-length');
    expect(longIds).toContain('long-sentence');
    expect(longIds).toContain('repeated-word');

    const unfinished = inspectNewsText(
      'Organizers gathered downtown to discuss the budget and next steps'
    ).suggestions;
    expect(unfinished.map((suggestion) => suggestion.id)).toContain('ending-punctuation');
    expect(NEWSLETTER_CARD_EXCERPT_LENGTH).toBe(220);
  });

  it('inspects text once and exposes the prepared review and tidy action', () => {
    const inspection = inspectNewsText('  One two  ', { cardLength: 5 });

    expect(inspection.analysis.words).toBe(2);
    expect(inspection.tidied).toBe('One two');
    expect(inspection.canTidy).toBe(true);
    expect(inspection.suggestions.map((suggestion) => suggestion.id)).toContain('card-length');

    const empty = inspectNewsText('   ');
    expect(empty.analysis.words).toBe(0);
    expect(empty.suggestions).toEqual([]);
    expect(empty.tidied).toBe('');
    expect(empty.canTidy).toBe(false);
  });

  it('tidies pasted spacing without changing the words', () => {
    expect(tidyNewsText('  One   two \r\n\r\n\r\n three  ')).toBe('One two\n\nthree');
    expect(tidyNewsText('  One\u00A0\u00A0two \u200B ')).toBe('One two');
    expect(tidyNewsText('')).toBe('');
  });
});
