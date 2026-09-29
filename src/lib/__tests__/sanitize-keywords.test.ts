import { describe, expect, it } from 'vitest';
import { containsSpamKeyword, sanitizeWPContent } from '@/lib/sanitize';

/**
 * `SPAM_KEYWORDS` is matched on word boundaries now, with an optional
 * inflection, instead of as a bare substring.
 *
 * The substring match deleted whole paragraphs, blocks and buttons when they
 * merely *contained* a keyword's letters — "judicial" contains "judi", so a
 * paragraph about a judicial review disappeared on publish. This file pins both
 * halves of that fix, and the third case: keywords that are themselves ordinary
 * words still match, which is the pre-existing policy rather than a bug.
 */
describe('spam keyword word boundaries', () => {
  describe('no longer flags a word that merely contains a keyword', () => {
    it.each([
      ['judicial review of the ordinance', 'judi'],
      ['pragmatically speaking, no', 'pragmatic'],
      ['vulcanised rubber donations', 'vulcan'],
      ['the partp score nobody uses', 'rtp'],
    ])('%s', (text) => {
      expect(containsSpamKeyword(text)).toBe(false);
    });

    it('keeps the block instead of deleting it', () => {
      const body = '<p>We asked for a judicial review of the ordinance.</p>';
      expect(sanitizeWPContent(body)).toBe(body);
    });

    it('keeps a button block intact, label and all', () => {
      // A button is a div wrapping an anchor, and the block-preservation bug
      // this guards against deleted the whole thing on publish.
      const button =
        '<div class="cw-action"><a class="cw-button" href="/contact">Sign up</a></div>';
      expect(sanitizeWPContent(button)).toBe(button);
    });
  });

  describe('still flags real spam, including inflections', () => {
    it.each([
      'Best CASINO online',
      'hot slots action',
      'situs gacor trusted',
      'visit vavada today',
      'bonuses and free spins',
      'try sweet bonanzas here',
      'the pin-ups are ready',
      'sbobet login',
      'pragmatic slots',
    ])('%s', (text) => {
      expect(containsSpamKeyword(text)).toBe(true);
    });

    it('still deletes the containing element', () => {
      expect(sanitizeWPContent('<p>Best CASINO online</p>')).toBe('');
      expect(sanitizeWPContent('<div><a href="/x">hot slots action</a></div>')).toBe('');
      expect(sanitizeWPContent('<p>Visit vavada now</p>')).toBe('');
    });

    it('still deletes only the offending element, not its siblings', () => {
      // The tempered lookahead: the innocent block after a spam one must survive.
      const out = sanitizeWPContent('<p>Best CASINO online</p><p>Tail stays</p>');
      expect(out).toContain('Tail stays');
      expect(out).not.toContain('CASINO');
    });
  });

  describe('known residual limitation', () => {
    // Documented rather than fixed: these keywords are ordinary words or names,
    // so word boundaries cannot tell them from the spam they were added to catch.
    // Changing the list is a policy decision, and `isSpamContent('hot slots
    // action')` is pinned by a pre-existing test, so it stays aggressive.
    it.each([
      'a parking slot on Elm Street',
      'the sign-up bonus',
      'bingo night at the church',
      'RTP of the campaign held up',
      'a pragmatic approach',
    ])('%s is still treated as spam', (text) => {
      expect(containsSpamKeyword(text)).toBe(true);
    });
  });
});
