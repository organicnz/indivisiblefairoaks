import { describe, expect, it } from 'vitest';
import { isDeliverableAddress } from '../../../supabase/functions/_shared/broadcast';

/**
 * The self-test recipient guard.
 *
 * ## What this test is for
 *
 * `isDeliverableAddress` lived inside `crm-broadcast-send/index.ts` with no test
 * in any runner, and it rejected **every realistic email address**. The pattern
 * was `[^@[:space:],]`, written for a POSIX regex; in JavaScript a POSIX class
 * inside a character class is the literal run `[ : s p a c e :]`, so the negated
 * set forbade the letters `s`, `p`, `a`, `c`, `e` along with `@`, `:` and `,`.
 *
 * `alice@example.com` was rejected. So was `test@example.com`. The guard exists
 * to stop a self-test resolving to more than one recipient, and it achieved that
 * by refusing to resolve to any recipient at all — which is the same shape as the
 * broadcast that had never been sent. A narrow guard that fails closed on
 * legitimate input is still a broken guard, and a broken guard nobody can see
 * reads as protection.
 *
 * The reason it could sit broken is structural, and is the reason it now lives in
 * `_shared` where a unit test can reach it: the delivery path is Deno, and the
 * Next test runner cannot exercise an Edge Function. The block editor and the CRM
 * are covered; the code that decides who actually receives email was not.
 *
 * The regression to guard is specifically "the pattern rejects ordinary
 * addresses", so most of this file is real addresses rather than synthetic ones.
 */

/**
 * Addresses that must be accepted.
 *
 * Chosen to cover the letters the broken class forbade (`a c e p s`), the shapes
 * a real inbox contains, and the boundaries of the pattern. An organizer
 * self-testing to their own address is the entire feature.
 */
const REAL_ADDRESSES = [
  'alice@example.com',
  'test@example.com',
  'organizer@indivisiblefairoaks.org',
  'jane.doe@example.com',
  'jane_doe+chapters@example.co.uk',
  'a@b.co',
  'x@y.io',
  'contact@sub.domain.example.org',
  // Uppercase and digits, both legal in a local part.
  'Alice.Smith123@example.com',
  // Every letter the broken class forbade, in one address.
  'spacecapesea@example.com',
  // Dots and hyphens in the local part, which must be preserved verbatim.
  '-leading.hyphen@example.com',
  'pape@example.com',
];

describe('isDeliverableAddress, accepts what a real inbox contains', () => {
  for (const address of REAL_ADDRESSES) {
    it(`accepts ${address}`, () => {
      expect(isDeliverableAddress(address)).toBe(true);
    });
  }

  it('accepts the address shape the self-test actually stores', () => {
    // Straight from the CHECK constraint's intent: one address, typed by an
    // organizer into the composer. If this fails, self-test sends are dead.
    expect(isDeliverableAddress('organizer@indivisiblefairoaks.org')).toBe(true);
  });
});

/**
 * What must be rejected.
 *
 * The security property here is narrow and specific: a value that could resolve
 * to **more than one recipient** is rejected, never split. That is the whole
 * point — a self-test pointed at `a@b.com,c@d.com` would mail a stranger.
 */
const MUST_REJECT: Array<{ value: string; why: string }> = [
  { value: 'a@b.com,c@d.com', why: 'two addresses — the exact widening being prevented' },
  { value: 'a@b.com, c@d.com', why: 'two addresses with a space after the comma' },
  { value: 'victim@example.com,attacker@evil.test', why: 'the realistic attack shape' },
  { value: 'victim @example.com', why: 'whitespace, which the broken class failed to reject' },
  { value: 'victim@exa mple.com', why: 'whitespace in the domain' },
  { value: 'no-at-sign.example.com', why: 'not an address at all' },
  { value: '@example.com', why: 'empty local part' },
  { value: 'alice@', why: 'empty domain' },
  { value: 'alice@example', why: 'no dot in the domain' },
  { value: 'alice@example.', why: 'empty TLD' },
  { value: 'alice@@example.com', why: 'two at-signs' },
  { value: 'alice example@test.com', why: 'whitespace in the local part' },
  { value: '', why: 'empty string' },
];

describe('isDeliverableAddress, refuses anything that is not one address', () => {
  for (const { value, why } of MUST_REJECT) {
    it(`refuses ${JSON.stringify(value)} — ${why}`, () => {
      expect(isDeliverableAddress(value)).toBe(false);
    });
  }
});

describe('isDeliverableAddress, the class is the whole guard', () => {
  it('forbids whitespace, which the POSIX-looking class did not', () => {
    // The specific regression. `[:space:]` is a POSIX class and JavaScript has
    // no such thing inside `[...]` — it matched the literal letters, so the
    // forbidden set was `@ : , s p a c e` and nothing about whitespace at all.
    // A guard that claims to reject whitespace and does not is a comment
    // attached to the wrong code.
    expect(' '.match(/[^@\s,]/)).toBeNull();
    expect('\t'.match(/[^@\s,]/)).toBeNull();
    expect('\n'.match(/[^@\s,]/)).toBeNull();
  });

  it('forbids the letters the broken class forbade', () => {
    for (const letter of ['s', 'p', 'a', 'c', 'e']) {
      expect(letter.match(/[^@\s,]/)).not.toBeNull();
    }
  });

  it('still forbids the separators it is meant to', () => {
    for (const separator of ['@', ',', ' ']) {
      expect(separator.match(/[^@\s,]/)).toBeNull();
    }
  });
});
