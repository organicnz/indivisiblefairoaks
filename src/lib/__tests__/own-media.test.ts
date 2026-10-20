// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { isOwnImageHost, isOwnImageUrl, ownImageRemotePatterns } from '@/lib/own-media';

const env = (await import('@/lib/env')).env as unknown as Record<string, string | undefined>;

/**
 * Which hosts may serve an image the CMS puts on a public page.
 *
 * The rule this replaces rejected every `*.supabase.co` URL in production — and
 * the editor's own uploader writes to the `media` bucket, which is on exactly
 * that host. So the CMS produced a hero URL and then refused to save it, and the
 * field had no working value at all. The fix has to accept our own storage
 * without becoming a hole, and the boundary it must not cross is a host that
 * merely *contains* a trusted name.
 */
const SITE = 'https://indivisiblefairoaks.org';
/** The real configured origin, so the test exercises a genuine project host. */
const SUPABASE = (env.NEXT_PUBLIC_SUPABASE_URL as string) ?? '';

describe('own media hosts', () => {
  beforeEach(() => {
    env.NEXT_PUBLIC_SITE_URL = SITE;
    // Read from the environment rather than written out: a test that pins the
    // project ref is a test that goes stale the day the project is re-provisioned,
    // and lefthook's `no-new-hardcoded-ref` gate exists for the same reason.
    env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE;
  });

  describe('isOwnImageHost', () => {
    it('accepts the configured site origin and its subdomains', () => {
      expect(isOwnImageHost('indivisiblefairoaks.org')).toBe(true);
      expect(isOwnImageHost('www.indivisiblefairoaks.org')).toBe(true);
      expect(isOwnImageHost('staging.indivisiblefairoaks.org')).toBe(true);
    });

    it('accepts the Supabase project host, which is where the editor uploads', () => {
      expect(isOwnImageHost(new URL(SUPABASE).hostname)).toBe(true);
      // The public object URL is served from the storage subdomain, and
      // NEXT_PUBLIC_SUPABASE_URL is the API origin, so both forms have to work.
      expect(isOwnImageHost('supabase.co')).toBe(true);
      expect(isOwnImageHost('project-ref.supabase.co')).toBe(true);
    });

    it('is case-insensitive and tolerates a trailing root dot', () => {
      expect(isOwnImageHost('IndivisibleFairOaks.ORG')).toBe(true);
      expect(isOwnImageHost('indivisiblefairoaks.org.')).toBe(true);
      expect(isOwnImageHost('  indivisiblefairoaks.org  ')).toBe(true);
    });

    it('rejects a host that merely contains a trusted name', () => {
      // The suffix match has to be on a dot boundary. Without it,
      // `notindivisiblefairoaks.org` is an attacker's domain that happens to
      // end in the string we trust — and an image on it is an image we proxy.
      for (const host of [
        'notindivisiblefairoaks.org',
        'evil-indivisiblefairoaks.org',
        'indivisiblefairoaks.org.attacker.example',
        'xsupabase.co',
        'evil.example.com',
      ]) {
        expect({ host, ok: isOwnImageHost(host) }).toEqual({ host, ok: false });
      }
    });

    it('rejects an empty host rather than treating it as a wildcard', () => {
      expect(isOwnImageHost('')).toBe(false);
      expect(isOwnImageHost('   ')).toBe(false);
    });
  });

  describe('isOwnImageUrl', () => {
    it('accepts an https URL on our own host', () => {
      expect(
        isOwnImageUrl(`${SUPABASE}/storage/v1/object/public/media/content/rally-a1b2c3d4.png`)
      ).toBe(true);
      expect(isOwnImageUrl(`${SITE}/public/hero.jpg`)).toBe(true);
    });

    it('rejects a non-http scheme', () => {
      // A `data:` URL in an OG tag breaks the crawler that reads it, and a
      // `javascript:` one would be an authored script on a public page.
      expect(isOwnImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(false);
      expect(isOwnImageUrl('javascript:alert(1)')).toBe(false);
      expect(isOwnImageUrl('file:///etc/passwd')).toBe(false);
    });

    it('rejects a relative or unparseable value', () => {
      // A relative URL would resolve against whatever host rendered it, which
      // is not something the save path can reason about.
      expect(isOwnImageUrl('/media/hero.jpg')).toBe(false);
      expect(isOwnImageUrl('hero.jpg')).toBe(false);
      expect(isOwnImageUrl('')).toBe(false);
    });

    it('rejects a trusted host reached through credentials or a port', () => {
      // `new URL` keeps these as the host, so the check is on the parsed value
      // rather than on a regex over the string.
      expect(isOwnImageUrl('https://indivisiblefairoaks.org:8443@evil.example.com/x.png')).toBe(
        false
      );
    });

    it('rejects a URL on someone else’s host', () => {
      expect(isOwnImageUrl('https://images.example.com/hero.png')).toBe(false);
    });
  });

  describe('with an unconfigured environment', () => {
    it('still rejects rather than throwing or defaulting open', () => {
      // `env` is parsed at module load with a `.default()`, so a malformed value
      // is reachable in a build that skipped validation. Defaulting open would
      // turn a config error into an open proxy; the fail-closed direction is the
      // only safe one.
      env.NEXT_PUBLIC_SITE_URL = 'not a url';
      env.NEXT_PUBLIC_SUPABASE_URL = 'also not a url';
      expect(isOwnImageHost('indivisiblefairoaks.org')).toBe(false);
      expect(isOwnImageUrl('https://indivisiblefairoaks.org/x.png')).toBe(false);
    });

    it('emits no remote patterns rather than a wildcard', () => {
      env.NEXT_PUBLIC_SITE_URL = 'not a url';
      env.NEXT_PUBLIC_SUPABASE_URL = 'also not a url';
      expect(ownImageRemotePatterns()).toEqual([]);
    });
  });

  describe('ownImageRemotePatterns', () => {
    it('lists the configured hosts for next/image', () => {
      expect(ownImageRemotePatterns()).toEqual([
        { protocol: 'https', hostname: 'indivisiblefairoaks.org' },
        { protocol: 'https', hostname: new URL(SUPABASE).hostname },
      ]);
    });

    it('follows the site origin across the apex cutover', () => {
      // The whole point of deriving this from configuration is that the cutover
      // is an env change and not a code sweep. See docs/apex-cutover-runbook.md.
      env.NEXT_PUBLIC_SITE_URL = 'https://staging.indivisiblefairoaks.org';
      expect(ownImageRemotePatterns()).toContainEqual({
        protocol: 'https',
        hostname: 'staging.indivisiblefairoaks.org',
      });
    });
  });
});
