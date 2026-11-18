// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  collectNewsletterTopics,
  countNewsletterWords,
  estimateNewsletterReadingMinutes,
  filterNewsletters,
  filterNewsPosts,
  matchesNewsText,
  mergeNewsletterRows,
  normalizeNewsText,
  parseNewsletterTopicInput,
  sortNewsletters,
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
    expect(estimateNewsletterReadingMinutes('word '.repeat(201))).toBe(2);
    expect(estimateNewsletterReadingMinutes('')).toBe(0);
  });
});
