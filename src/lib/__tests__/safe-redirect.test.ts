import { describe, expect, it } from 'vitest';
import { getSafeNextPath } from '@/lib/safe-redirect';

/**
 * The open-redirect guard, on its own.
 *
 * `login-auth.test.ts` exercised it through a re-implementation of the login
 * page's own logic — it called `getSafeNextPath` directly but rebuilt the error
 * mapper and the callback URL locally, so nothing pinned the component's actual
 * behaviour. This file tests the one function every redirect in the app funnels
 * through: the login page, `middleware.ts`, the OAuth callback route, the MFA
 * challenge's `?next=`, and `UserSettings`' step-up link.
 *
 * That last group is why the query-string cases matter. `middleware.ts` now
 * remembers `pathname + search`, so a volunteer bounced from
 * `/account?tab=settings` comes back to Settings. That only works because this
 * function preserves the query string — and preserving it is also the case most
 * likely to smuggle something past a naive implementation.
 */
describe('getSafeNextPath', () => {
  describe('accepts internal paths', () => {
    it('keeps a plain path', () => {
      expect(getSafeNextPath('/account')).toBe('/account');
      expect(getSafeNextPath('/admin/crm')).toBe('/admin/crm');
    });

    /**
     * Load-bearing for `middleware.ts`'s return path and for the MFA
     * challenge's `?next=`. A guard that dropped the query string would send
     * every volunteer who was bounced from `/account?tab=settings` back to
     * `/account` — the Orders tab — which is where the bug was.
     */
    it('preserves the query string and hash', () => {
      expect(getSafeNextPath('/account?tab=settings')).toBe('/account?tab=settings');
      expect(getSafeNextPath('/admin/crm?consent=opted_out&status=donor')).toBe(
        '/admin/crm?consent=opted_out&status=donor'
      );
      expect(getSafeNextPath('/account?tab=settings#panel')).toBe('/account?tab=settings#panel');
    });

    it('handles a doubly-encoded next, as a redirect hop produces', () => {
      // `/login?next=%2Faccount%3Ftab%3Dsettings` arrives here already decoded
      // once by `searchParams.get`, so the value reaching this function is
      // `/account?tab=settings`. A second decode must not corrupt it — and must
      // not be allowed to *reveal* something the first decode hid.
      expect(getSafeNextPath('/account%3Ftab%3Dsettings')).toBe('/account%3Ftab%3Dsettings');
      expect(getSafeNextPath('%2Faccount')).toBeNull();
    });
  });

  describe('rejects anything that leaves the origin', () => {
    it('rejects an absolute URL to another host', () => {
      expect(getSafeNextPath('https://evil.example/steal')).toBeNull();
      expect(getSafeNextPath('http://evil.example')).toBeNull();
    });

    it('rejects a protocol-relative URL', () => {
      // `//evil.example` is a valid *relative* URL with an authority component,
      // which is why the `startsWith('/')` check alone does not exclude it.
      expect(getSafeNextPath('//evil.example')).toBeNull();
      expect(getSafeNextPath('//evil.example/path')).toBeNull();
      // Encoded forms of the same thing. `searchParams.get` decodes once, so a
      // value a third party hands a user arrives here already decoded — but a
      // caller that re-encodes (a redirect hop writing `?next=`) does not, and
      // these were the two assertions an earlier revision of this file deleted
      // while adding the query-string cases. Both still pass, so nothing about
      // the guard changed; they are here because their absence is what let the
      // dot-segment hole below go unnoticed.
      expect(getSafeNextPath('/%2F%2Fevil.example')).toBeNull();
      expect(getSafeNextPath('/%5C%5Cevil.example')).toBeNull();
    });

    it('rejects a backslash, which some browsers normalise to a slash', () => {
      // `/\evil.example` and `\/evil.example` both become `//evil.example` in
      // several browsers, so a path containing a backslash is refused outright
      // rather than escaped.
      expect(getSafeNextPath('/\\evil.example')).toBeNull();
      expect(getSafeNextPath('\\\\evil.example')).toBeNull();
      expect(getSafeNextPath('/%5C%5Cevil.example')).toBeNull();
    });

    /**
     * The one that reached production code, and the reason the return value is
     * validated rather than assumed.
     *
     * `new URL()` applies WHATWG dot-segment normalisation and reads `%2e%2e` as
     * `..`, so each of these clears every *input* check — they start with `/.`
     * rather than `//`, contain no backslash, and their decoded copies are
     * byte-identical — and the parser then collapses them to `//evil.example`.
     * The `origin` comparison passes, because by the time the parser reports an
     * origin the `//` has already been demoted to a path.
     *
     * The assertion is on the resolved URL rather than on the returned string, so
     * it fails if this regresses to any other off-origin form too.
     */
    it('rejects a dot segment that normalises into an authority', () => {
      const cases = ['/..//evil.example', '/%2e%2e//evil.example', '/account/%2e%2e//evil.example'];
      for (const value of cases) {
        expect(getSafeNextPath(value)).toBeNull();
        expect(getSafeNextPath(value, '/account')).toBe('/account');
      }
    });

    it('rejects a traversal that stays on-origin rather than escaping it', () => {
      // These do not reach an external host, so a guard that only checked the
      // origin would pass them — and the result is still a path nobody asked
      // for. `?next=/../../admin` bouncing a volunteer from their account page
      // is the mild version; refusing the segment is the honest behaviour.
      expect(getSafeNextPath('/account/../admin')).toBeNull();
      expect(getSafeNextPath('/account/..')).toBeNull();
    });

    it('accepts a path whose segments merely start with dots', () => {
      // The check is for a `..` *segment*, not for a substring. `/.well-known`
      // and a trailing `..foo` are legitimate paths, and a substring match would
      // reject them.
      expect(getSafeNextPath('/.well-known/acme-challenge')).toBe('/.well-known/acme-challenge');
      expect(getSafeNextPath('/account/..foo')).toBe('/account/..foo');
      expect(getSafeNextPath('/...')).toBe('/...');
    });

    it('rejects a non-http scheme', () => {
      expect(getSafeNextPath('javascript:alert(1)')).toBeNull();
      expect(getSafeNextPath('data:text/html,alert(1)')).toBeNull();
      expect(getSafeNextPath('mailto:someone@example.com')).toBeNull();
    });

    it('rejects a value with no leading slash', () => {
      expect(getSafeNextPath('account')).toBeNull();
      expect(getSafeNextPath('admin/crm')).toBeNull();
    });
  });

  describe('rejects control characters', () => {
    // Written as escapes rather than literals: a raw NUL or DEL in a source file
    // makes it binary to every reader, including this one.
    const CONTROL_CASES: [label: string, value: string][] = [
      ['CRLF', '/account\r\nSet-Cookie: x=1'],
      ['LF', '/account\nLocation: https://evil.example'],
      ['CR', '/account\rSet-Cookie: x=1'],
      ['NUL', '/account\0'],
      ['DEL', '/account\x7f'],
      ['tab', '/account\t'],
      ['vertical tab', '/account\v'],
      ['form feed', '/account\f'],
    ];

    it.each(CONTROL_CASES)('rejects a path containing %s', (_label, value) => {
      // A CR or LF in a redirect target is a header-injection vector: enough to
      // append a second response line to a Location header.
      expect(getSafeNextPath(value)).toBeNull();
    });

    it('rejects an encoded control character after decoding', () => {
      // `%0d%0a` decodes to CRLF only after `decodeURIComponent`, so checking the
      // raw string is not enough.
      expect(getSafeNextPath('/account%0d%0aLocation:%20https://evil.example')).toBeNull();
    });

    it('rejects a malformed percent-encoding rather than throwing', () => {
      // `%zz` is not valid encoding. `decodeURIComponent` throws, and an
      // exception here is a 500 on every login attempt rather than a rejected
      // redirect.
      expect(getSafeNextPath('/account%zz')).toBeNull();
    });
  });

  describe('fallback', () => {
    it('returns null when nothing is supplied and no fallback is given', () => {
      expect(getSafeNextPath(null)).toBeNull();
      expect(getSafeNextPath(undefined as unknown as string | null)).toBeNull();
      expect(getSafeNextPath('')).toBeNull();
    });

    it('returns the fallback for a rejected value', () => {
      expect(getSafeNextPath('https://evil.example', '/account')).toBe('/account');
      expect(getSafeNextPath('//evil.example', '/account')).toBe('/account');
    });

    it('returns the fallback for a missing value', () => {
      expect(getSafeNextPath(null, '/admin')).toBe('/admin');
      expect(getSafeNextPath('', '/admin')).toBe('/admin');
    });

    /**
     * `middleware.ts` passes `pathname` as the fallback, so a rejected value
     * there still produces a usable same-origin destination rather than a
     * redirect to nowhere.
     */
    it('uses the fallback as given, without re-validating it', () => {
      expect(getSafeNextPath('https://evil.example', '/account?tab=settings')).toBe(
        '/account?tab=settings'
      );
    });
  });

  describe('the internal origin constant does not leak into behaviour', () => {
    /**
     * `INTERNAL_ORIGIN` inside the module is the apex, used only to parse a
     * relative path into an absolute one so the origin can be compared. It is
     * deliberately not the site's identity: the app is correct on every host by
     * construction, and a staging build must accept `/account` exactly as the apex
     * does.
     */
    it('accepts the same paths regardless of host', () => {
      for (const host of [
        'https://indivisiblefairoaks.org',
        'https://test.indivisiblefairoaks.org',
        'http://localhost:3000',
      ]) {
        const parsed = new URL(getSafeNextPath('/admin/crm?tag=choir') as string, host);
        expect(`${parsed.pathname}${parsed.search}`).toBe('/admin/crm?tag=choir');
      }
    });

    it('never returns an absolute URL', () => {
      expect(getSafeNextPath('/account')).not.toMatch(/^https?:/);
      expect(getSafeNextPath('/account?next=/admin')).not.toMatch(/^https?:/);
    });
  });
});
