import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BROADCAST_EYEBROW,
  BROADCAST_FOOTER,
  BROADCAST_ORG,
  BROADCAST_RECIPIENT_CEILING,
  broadcastBodyHtml,
  broadcastSubject,
  buildBroadcastEmail,
  escapeBroadcastHtml,
} from '@/lib/crm-broadcast';
import { brandShell, LOGO_URL } from '@/lib/email';

/**
 * The broadcast template exists twice: `src/lib/crm-broadcast.ts` renders the
 * preview the admin approves, and `supabase/functions/_shared/broadcast.ts`
 * renders the message that is delivered. Deno cannot import from `src/`, so the
 * duplication is structural.
 *
 * This is the same contract `commerce-parity.test.ts` holds for currency, and it
 * exists for the same reason: the edge `checkout` function once carried the
 * entire NZD bug independently of the Next app and was directly reachable. A
 * broadcast where the approved preview and the delivered email differ is the
 * same failure with a worse blast radius — every recipient sees the version
 * nobody reviewed.
 *
 * The edge copy cannot be imported here (Deno + `jsr:` specifiers), so the
 * constants and the template source are compared textually. If the two files
 * drift, this fails.
 */
const APP_SOURCE_RAW = await Bun.file(resolve(process.cwd(), 'src/lib/crm-broadcast.ts')).text();
const EDGE_SOURCE = await Bun.file(
  resolve(process.cwd(), 'supabase/functions/_shared/broadcast.ts')
).text();
const SENDER_SOURCE = await Bun.file(
  resolve(process.cwd(), 'supabase/functions/crm-broadcast-send/index.ts')
).text();
const CRM_TYPES_SOURCE = await Bun.file(resolve(process.cwd(), 'src/types/crm.ts')).text();

const FIXTURE = {
  recipientName: 'Jane Doe',
  body: 'Join us Saturday.\n\nBring ten neighbours.',
  // Same origin as `siteUrl`: both derive from the sending origin, so a staging
  // build never mixes hosts inside one message.
  unsubscribeUrl: 'https://test.indivisiblefairoaks.org/api/crm/unsubscribe?token=abc',
  logoUrl: LOGO_URL,
  siteUrl: 'https://test.indivisiblefairoaks.org',
};

describe('broadcast template parity between the app and the edge function', () => {
  it('agrees on every shared constant', () => {
    for (const [name, value] of [
      ['BROADCAST_EYEBROW', BROADCAST_EYEBROW],
      ['BROADCAST_FOOTER', BROADCAST_FOOTER],
      ['BROADCAST_ORG', BROADCAST_ORG],
      ['BROADCAST_RECIPIENT_CEILING', BROADCAST_RECIPIENT_CEILING],
    ] as const) {
      const declared = new RegExp(
        `export const ${name} =\\s*\\n?\\s*('(?:[^'\\\\]|\\\\.)*'|[\\d_]+)`
      ).exec(EDGE_SOURCE);
      expect(declared, `${name} must be declared in the edge copy`).not.toBeNull();
      const edgeValue = declared?.[1];
      if (typeof value === 'number') {
        // Compare numerically: `5_000` and `5000` are the same ceiling, and the
        // digit grouping is a formatting choice, not a behavioural difference.
        expect(
          Number(String(edgeValue).replace(/_/g, '')),
          `${name} differs between app and edge`
        ).toBe(value);
        continue;
      }
      const appValue = `'${value}'`;
      expect(edgeValue?.replace(/\s+/g, ' '), `${name} differs between app and edge`).toBe(
        appValue.replace(/\s+/g, ' ')
      );
    }
  });

  it('agrees on the template functions line for line', () => {
    // Whitespace-insensitive: Biome formats `src/` but not `supabase/functions`,
    // so the two copies are deliberately formatted differently. Every
    // non-whitespace character of each statement must match.
    const normalize = (src: string) =>
      src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\s+/g, '')
        // Biome and the Deno formatter differ on semicolons (including in type
        // members). Punctuation is not behaviour, so it is normalised away rather
        // than forcing one formatter's style onto the other file.
        .replace(/;/g, '')
        // Biome adds trailing commas when it wraps a long signature across
        // lines; the edge copy keeps the short form. A trailing comma before a
        // closer is not behaviour in a binding pattern, a call, or an array
        // literal, so it is normalised the same way.
        .replace(/,([}\])])/g, '$1');

    /** One function's body, bounded by the next top-level declaration. */
    const sliceFunction = (source: string, name: string): string | null => {
      const start = source.indexOf(`function ${name}(`);
      if (start < 0) return null;
      const rest = source.slice(start + 1);
      const next = rest.search(/\n(?:export )?(?:function \w+\(|interface \w+|type \w+[ <=])/);
      return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next);
    };

    for (const fn of [
      'escapeBroadcastHtml',
      'stripBroadcastControls',
      'broadcastSubject',
      'broadcastBodyHtml',
      'broadcastText',
      'brandShellMarkup',
      'buildBroadcastEmail',
    ]) {
      const edgeFn = sliceFunction(EDGE_SOURCE, fn);
      const appFn = sliceFunction(APP_SOURCE_RAW, fn);
      expect(appFn, `${fn} must exist in the app copy`).not.toBeNull();
      expect(edgeFn, `${fn} must exist in the edge copy`).not.toBeNull();

      // The whole body must match once whitespace and comments are removed. A
      // behavioural difference cannot hide behind formatting: every
      // non-whitespace character is compared.
      const edgeBody = normalize(edgeFn as string);
      const appBody = normalize(appFn as string);
      expect(edgeBody.length, `${fn} has no comparable body`).toBeGreaterThan(20);
      expect(appBody, `${fn} differs between the app and the edge copy`).toBe(edgeBody);
    }
  });
});

describe('the delivered email is the previewed email', () => {
  it('renders the body exactly once, through the same builder', () => {
    const { html, text } = buildBroadcastEmail(FIXTURE);
    // The greeting, the message and the unsubscribe link all appear.
    expect(html).toContain('Hello Jane Doe,');
    expect(html).toContain('Bring ten neighbours.');
    expect(html).toContain(FIXTURE.unsubscribeUrl);
    expect(text).toContain('Hello Jane Doe,');
    expect(text).toContain(FIXTURE.unsubscribeUrl);
  });

  it('uses the real brand shell, so the logo and footer are present', () => {
    // The old preview omitted both. A preview without the logo is not the
    // message; it is a sketch of it.
    const { html } = buildBroadcastEmail(FIXTURE);
    expect(html).toBe(
      brandShell({
        eyebrow: BROADCAST_EYEBROW,
        body: broadcastBodyHtml(FIXTURE),
        footer: BROADCAST_FOOTER,
        siteUrl: FIXTURE.siteUrl,
      })
    );
    expect(html).toContain(LOGO_URL);
    expect(html).toContain(BROADCAST_FOOTER);
  });

  it('links the brand to the sending origin, never a hardcoded apex', () => {
    // The template used to carry BROADCAST_SITE_URL, so a staging build mailed
    // links to a host that 302s to Google Sites until the cutover. The origin
    // is now a parameter: what the caller passes is what every link carries.
    const { html, text } = buildBroadcastEmail(FIXTURE);
    expect(html).toContain(FIXTURE.siteUrl);
    expect(text).toContain(FIXTURE.siteUrl);
    expect(html).not.toContain('https://indivisiblefairoaks.org');
    expect(text).not.toContain('https://indivisiblefairoaks.org');
  });

  it('carries no hardcoded site origin in either copy of the template', () => {
    for (const [label, source] of [
      ['app', APP_SOURCE_RAW],
      ['edge', EDGE_SOURCE],
    ] as const) {
      expect(source, `${label} copy hardcodes a site origin`).not.toContain(
        'https://indivisiblefairoaks.org'
      );
      expect(source, `${label} copy hardcodes a staging origin`).not.toContain(
        'https://test.indivisiblefairoaks.org'
      );
    }
  });
});

describe('broadcast body is plain text, not markup', () => {
  it('escapes markup the admin typed rather than delivering it', () => {
    const { html } = buildBroadcastEmail({
      ...FIXTURE,
      body: '<script>alert(1)</script> <b>bold</b> <a href="https://x">link</a>',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).not.toContain('href="https://x"');
    expect(html).toContain('&lt;script&gt;');
  });

  it('converts newlines to line breaks, matching what the preview shows', () => {
    const { html } = buildBroadcastEmail(FIXTURE);
    expect(html).toContain('Bring ten neighbours.');
    expect(html).toContain('<br />');
  });

  it('escapes the recipient name into the greeting', () => {
    const { html } = buildBroadcastEmail({ ...FIXTURE, recipientName: '<img onerror=x>' });
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;img onerror=x&gt;');
  });
});

describe('broadcastSubject', () => {
  it('collapses newlines so a subject cannot inject headers', () => {
    expect(broadcastSubject('Urgent\r\nBcc: victim@example.com')).toBe(
      'Urgent Bcc: victim@example.com'
    );
    expect(broadcastSubject('  spaced  ')).toBe('spaced');
  });

  it('strips control characters', () => {
    expect(escapeBroadcastHtml(broadcastSubject('a\u0000b\u0007c'))).toBe('abc');
  });
});

describe('broadcast recipient shape parity between the app and the edge sender', () => {
  it('declares the same recipient fields on both sides', () => {
    // `BroadcastRecipient` in `src/types/crm.ts` is the single source; the
    // sender keeps a local `interface Recipient` because Deno cannot import
    // from `src/`. A field added on one side and not the other is how an
    // unsubscribe token silently stops reaching the sender while every unit
    // test stays green — the mocks never cross that boundary.
    const sliceInterface = (source: string, name: string): string | null => {
      const start = source.indexOf(`interface ${name} `);
      if (start < 0) return null;
      const end = source.indexOf('}', start);
      return end < 0 ? null : source.slice(start, end + 1);
    };
    const app = sliceInterface(CRM_TYPES_SOURCE, 'BroadcastRecipient');
    const edge = sliceInterface(SENDER_SOURCE, 'Recipient');
    expect(app, 'BroadcastRecipient must exist in src/types/crm.ts').not.toBeNull();
    expect(edge, 'Recipient must exist in the edge sender').not.toBeNull();
    for (const field of ['id', 'email', 'first_name', 'last_name', 'unsubscribe_token']) {
      const member = new RegExp(`\\b${field}\\b`);
      expect(app, `app BroadcastRecipient is missing ${field}`).toMatch(member);
      expect(edge, `edge Recipient is missing ${field}`).toMatch(member);
    }
  });
});
