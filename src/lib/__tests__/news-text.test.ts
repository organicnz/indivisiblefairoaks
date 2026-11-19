// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  analyzeNewsletterText,
  buildNewsSearchSnippet,
  collectNewsletterTopics,
  countNewsletterTopics,
  containsNewsPhrase,
  countNewsletterParagraphs,
  countNewsletterSentences,
  countNewsletterWords,
  displayNewsQuery,
  estimateNewsletterReadingMinutes,
  filterNewsletters,
  filterNewsPosts,
  hasNewsQuery,
  hasNewsletterTopic,
  inspectNewsText,
  isAllNewsletterTopics,
  matchesNewsText,
  mergeNewsletterRows,
  NEWSLETTER_CARD_EXCERPT_LENGTH,
  NEWSLETTER_LONG_SENTENCE_WORDS,
  normalizeNewsText,
  newsletterTopicKey,
  parseNewsQuery,
  parseNewsletterTopicInput,
  rankNewsletters,
  rankNewsPosts,
  reviewNewsText,
  resolveNewsQuery,
  scoreNewsText,
  searchNewsPosts,
  searchNewsletters,
  sortNewsletters,
  splitNewsletterSentences,
  splitNewsTextHighlights,
  tidyNewsletterText,
  tokenizeNewsQuery,
  uniqueNewsletterTopics,
} from '@/lib/news-text';

const newsletter = {
  slug: 'summer-bulletin',
  title: 'Summer Action Bulletin',
  date_label: 'July 2026',
  description: 'Election defense and choir actions across Sacramento County.',
  topics: ['Election Defense', 'Choir Actions'],
  sort_order: 10,
};

describe('news and newsletter text processing', () => {
  it('normalizes case, accents, punctuation, apostrophes and ampersands', () => {
    expect(normalizeNewsText('  Résumé & Chapter’s — July!  ')).toBe('resume and chapters july');
    expect(tokenizeNewsQuery('Election, election DEFENSE')).toEqual(['election', 'defense']);
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
    expect(matchesNewsText(['Summer Action Bulletin', 'Election defense update'], 'bulletin defense')).toBe(
      true
    );
    expect(matchesNewsText(['Summer Action Bulletin'], 'bulletin choir')).toBe(false);
    expect(matchesNewsText(['Earth Day'], 'art')).toBe(false);
    expect(matchesNewsText(['Public Schools'], 'school')).toBe(true);
    expect(matchesNewsText(['Community Funding'], 'fund')).toBe(true);
    expect(matchesNewsText(['Summer Action Bulletin'], '   ')).toBe(true);
  });

  it('keeps quoted phrases contiguous while leaving unquoted terms forgiving', () => {
    const parsed = parseNewsQuery('"public schools" funding');
    expect(parsed.tokens).toEqual(['public', 'schools', 'funding']);
    expect(parsed.phrases).toEqual([['public', 'schools']]);
    expect(parseNewsQuery('“public schools”').phrases).toEqual([['public', 'schools']]);
    expect(containsNewsPhrase(['public', 'schools', 'funding'], ['public', 'schools'])).toBe(true);
    expect(containsNewsPhrase(['public', 'funding', 'schools'], ['public', 'schools'])).toBe(
      false
    );

    expect(matchesNewsText(['Public schools funding'], '"public schools"')).toBe(true);
    expect(matchesNewsText(['Public funding for schools'], '"public schools"')).toBe(false);
    expect(matchesNewsText(['Public', 'schools update'], '"public schools"')).toBe(false);
    expect(matchesNewsText(['Public funding for schools'], 'public schools')).toBe(true);
    expect(matchesNewsText(['Public schools funding'], '"public schools" funding')).toBe(true);
  });

  it('gives an exact quoted phrase more ranking weight than scattered terms', () => {
    expect(scoreNewsText(['Public Schools Funding'], '"public schools"', [8])).toBeGreaterThan(
      scoreNewsText(['Public Funding Update Schools'], '"public schools"', [8])
    );
  });

  it('filters newsletters by normalized tokens and case-insensitive topic', () => {
    expect(filterNewsletters([newsletter], { query: 'defense sacramento' })).toEqual([newsletter]);
    expect(filterNewsletters([newsletter], { query: 'defense', topic: 'choir actions' })).toEqual([
      newsletter,
    ]);
    expect(filterNewsletters([newsletter], { query: 'defense', topic: 'housing' })).toEqual([]);
    expect(hasNewsletterTopic(newsletter.topics, ' election defense ')).toBe(true);
    expect(hasNewsletterTopic(newsletter.topics, 'housing')).toBe(false);
  });

  it('requires a quoted phrase to stay within one bulletin field set', () => {
    expect(
      filterNewsletters(
        [{ ...newsletter, title: 'Public schools update', description: 'Funding details.' }],
        { query: '"public schools"' }
      )
    ).toHaveLength(1);
    expect(
      filterNewsletters(
        [{ ...newsletter, title: 'Public funding update', description: 'Schools details.' }],
        { query: '"public schools"' }
      )
    ).toEqual([]);
  });

  it('honours a translated All Topics label', () => {
    expect(
      filterNewsletters([newsletter], { query: '', topic: 'All Topics', allTopicsLabel: 'All Topics' })
    ).toEqual([newsletter]);
    expect(
      filterNewsletters([newsletter], { query: '', topic: 'Tous les sujets', allTopicsLabel: 'Tous les sujets' })
    ).toEqual([newsletter]);
  });

  it('recognizes the all-topic sentinel after whitespace and case folding', () => {
    expect(isAllNewsletterTopics('  all   topics ', 'All Topics')).toBe(true);
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

  it('counts topic chips under the current search query', () => {
    const bulletin = {
      ...newsletter,
      slug: 'choir-bulletin',
      title: 'Choir Night',
      description: 'Music and organizing in the park.',
      topics: ['Choir Actions'],
    };

    expect(countNewsletterTopics([newsletter, bulletin]).all).toBe(2);
    expect(countNewsletterTopics([newsletter, bulletin]).byTopic).toEqual({
      'election defense': 1,
      'choir actions': 2,
    });
    expect(countNewsletterTopics([newsletter, bulletin], 'election')).toEqual({
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
    expect(
      searchNewsletters(bulletins, { query: 'choir actions', topic: 'Choir Actions' }).map(
        (item) => item.title
      )
    ).toEqual(['Choir Actions Bulletin']);
  });

  it('filters news posts by title, excerpt and slug', () => {
    const posts = [
      { title: 'Public Schools', excerpt: 'A local funding explainer', slug: 'public-schools' },
      { title: 'Choir Night', excerpt: 'Music and organizing', slug: 'choir-night' },
    ];
    expect(filterNewsPosts(posts, 'schools funding')).toEqual([posts[0]]);
    expect(filterNewsPosts(posts, 'choir-night')).toEqual([posts[1]]);
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
    expect(parseNewsletterTopicInput('Election Defense, Choir Actions; Food Drive\nHousing')).toEqual(
      ['Election Defense', 'Choir Actions', 'Food Drive', 'Housing']
    );
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
    expect(countNewsletterWords('  One two three  ')).toBe(3);
    expect(countNewsletterWords('   ')).toBe(0);
    expect(countNewsletterWords("chapter's don't-stop")).toBe(2);
    expect(estimateNewsletterReadingMinutes('word '.repeat(201))).toBe(2);
    expect(estimateNewsletterReadingMinutes('')).toBe(0);
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

    expect(
      rankNewsPosts(filterNewsPosts(posts, 'schools funding'), 'schools funding').map(
        (post) => post.title
      )
    ).toEqual(['Public Schools Funding', 'Community Update']);
    expect(rankNewsPosts(posts, '').map((post) => post.title)).toEqual(
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

    expect(rankNewsletters(items, 'choir actions').map((item) => item.title)).toEqual([
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

  it('filters bulletins by topic even when the query is empty', () => {
    const bulletins = [
      { ...newsletter, slug: 'elections', title: 'Election Update', topics: ['Elections'] },
      { ...newsletter, slug: 'choir', title: 'Choir Night', topics: ['Choir Actions'] },
    ];

    expect(
      searchNewsletters(bulletins, { query: '', topic: 'Choir Actions' }).map(
        (item) => item.title
      )
    ).toEqual(['Choir Night']);
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

  it('splits original text into safe highlight segments', () => {
    const segments = splitNewsTextHighlights('Public Schools, funding!', 'school fund');

    expect(segments.map((segment) => segment.text).join('')).toBe('Public Schools, funding!');
    expect(segments.filter((segment) => segment.matched).map((segment) => segment.text)).toEqual([
      'Schools,',
      'funding!',
    ]);
    expect(splitNewsTextHighlights('Choir Night', '')).toEqual([
      { text: 'Choir Night', matched: false },
    ]);
  });

  it('keeps a quoted phrase in one continuous highlight run', () => {
    const segments = splitNewsTextHighlights('Our Public schools funding', '"public schools"');

    expect(segments.map((segment) => segment.text).join('')).toBe(
      'Our Public schools funding'
    );
    expect(segments.filter((segment) => segment.matched).map((segment) => segment.text)).toEqual([
      'Public schools',
    ]);
  });

  it('analyzes word, sentence and paragraph counts in one pass', () => {
    const analysis = analyzeNewsletterText('One two. Three four!\n\nFive six?');

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
    expect(countNewsletterSentences('No punctuation here')).toBe(1);
    expect(countNewsletterSentences('He said, “Go.” Then left.')).toBe(2);
    expect(countNewsletterSentences('We raised 3.5 million dollars.')).toBe(1);
    expect(countNewsletterSentences('U.S. officials met. They agreed.')).toBe(2);
    expect(countNewsletterSentences('Heading\n\nA complete sentence.')).toBe(2);
    expect(splitNewsletterSentences('Heading\n\nA complete sentence.')).toEqual([
      'Heading',
      'A complete sentence.',
    ]);
    expect(countNewsletterParagraphs('One\n\nTwo\n\nThree')).toBe(3);
    expect(countNewsletterParagraphs('One\r\n\r\nTwo')).toBe(2);
  });

  it('flags sentences that exceed the readable-length threshold', () => {
    const longWordCount = NEWSLETTER_LONG_SENTENCE_WORDS + 1;
    const longSentence = `${'word '.repeat(longWordCount).trim()}.`;
    const analysis = analyzeNewsletterText(longSentence);

    expect(analysis.longSentences).toBe(1);
    expect(analysis.averageWordsPerSentence).toBe(longWordCount);
  });

  it('reviews summaries for card fit, readability, repetition and completeness', () => {
    const clean = reviewNewsText(
      'A clear summary about the budget vote and what it means for local families.'
    );
    expect(clean).toEqual([]);

    const short = reviewNewsText('Too short.');
    expect(short.map((suggestion) => suggestion.id)).toContain('short');

    const long = reviewNewsText(
      `${'word '.repeat(NEWSLETTER_LONG_SENTENCE_WORDS + 2).trim()}.`,
      { cardLength: 80 }
    );
    const longIds = long.map((suggestion) => suggestion.id);
    expect(longIds).toContain('card-length');
    expect(longIds).toContain('long-sentence');
    expect(longIds).toContain('repeated-word');

    const unfinished = reviewNewsText(
      'Organizers gathered downtown to discuss the budget and next steps'
    );
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
    expect(tidyNewsletterText('  One   two \r\n\r\n\r\n three  ')).toBe('One two\n\nthree');
    expect(tidyNewsletterText('  One\u00A0\u00A0two \u200B ')).toBe('One two');
    expect(tidyNewsletterText('')).toBe('');
  });
});
