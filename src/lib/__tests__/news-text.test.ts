// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  analyzeNewsletterText,
  buildNewsSearchSnippet,
  collectNewsletterTopics,
  countNewsletterParagraphs,
  countNewsletterSentences,
  countNewsletterWords,
  estimateNewsletterReadingMinutes,
  filterNewsletters,
  filterNewsPosts,
  matchesNewsText,
  mergeNewsletterRows,
  normalizeNewsText,
  parseNewsletterTopicInput,
  rankNewsletters,
  rankNewsPosts,
  sortNewsletters,
  splitNewsTextHighlights,
  tidyNewsletterText,
  tokenizeNewsQuery,
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

  it('filters newsletters by normalized tokens and case-insensitive topic', () => {
    expect(filterNewsletters([newsletter], { query: 'defense sacramento' })).toEqual([newsletter]);
    expect(filterNewsletters([newsletter], { query: 'defense', topic: 'choir actions' })).toEqual([
      newsletter,
    ]);
    expect(filterNewsletters([newsletter], { query: 'defense', topic: 'housing' })).toEqual([]);
  });

  it('honours a translated All Topics label', () => {
    expect(
      filterNewsletters([newsletter], { query: '', topic: 'All Topics', allTopicsLabel: 'All Topics' })
    ).toEqual([newsletter]);
    expect(
      filterNewsletters([newsletter], { query: '', topic: 'Tous les sujets', allTopicsLabel: 'Tous les sujets' })
    ).toEqual([newsletter]);
  });

  it('collects topics in first-seen order and removes case-insensitive duplicates', () => {
    expect(
      collectNewsletterTopics([
        { topics: [' Election Defense ', 'choir'] },
        { topics: ['Election defense', '', 'Choir'] },
      ])
    ).toEqual(['Election Defense', 'choir']);
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

  it('builds a snippet around the first matching word and preserves the original wording', () => {
    const text = `${'Introductory context. '.repeat(20)}Schools funding matters here.${' More context.'.repeat(20)}`;
    const snippet = buildNewsSearchSnippet(text, 'funding', 90);

    expect(snippet).toContain('Schools funding matters here.');
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(94);
    expect(buildNewsSearchSnippet('Short text', 'short', 90)).toBe('Short text');
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

  it('analyzes word, sentence and paragraph counts in one pass', () => {
    const analysis = analyzeNewsletterText('One two. Three four!\n\nFive six?');

    expect(analysis).toEqual({
      characters: 31,
      charactersNoSpaces: 25,
      words: 6,
      sentences: 3,
      paragraphs: 2,
      readingMinutes: 1,
    });
    expect(countNewsletterSentences('No punctuation here')).toBe(1);
    expect(countNewsletterParagraphs('One\n\nTwo\n\nThree')).toBe(3);
  });

  it('tidies pasted spacing without changing the words', () => {
    expect(tidyNewsletterText('  One   two \r\n\r\n\r\n three  ')).toBe('One two\n\nthree');
    expect(tidyNewsletterText('')).toBe('');
  });
});
