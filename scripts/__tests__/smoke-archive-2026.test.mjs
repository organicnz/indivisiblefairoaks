// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  ARCHIVE_ITEMS,
  DOCUMENTS,
  inspectArchive,
  inspectVoterInfo,
  main,
  pathnameOf,
  sectionFor,
} from '../smoke-archive-2026.mjs';

const OWNED = (slug) =>
  `https://project.supabase.co/storage/v1/object/public/legacy-documents/documents/voter/${slug}.pdf`;
const DRIVE = (driveId) => `https://drive.google.com/file/d/${driveId}/preview`;

function archiveHtml({
  links = DOCUMENTS.map((doc) => OWNED(doc.slug)),
  items = ARCHIVE_ITEMS,
  extra = '',
} = {}) {
  return `<html><body><main><section id="voter-guides-2026" aria-labelledby="voter-guides-2026-heading">
    <h2 id="voter-guides-2026-heading">2026 Voter Guide &amp; Ballot Recommendations</h2>
    ${items.map((item) => `<h3>${item}</h3>`).join('\n')}
    ${links.map((href) => `<a href="${href}">document</a>`).join('\n')}
    ${extra}
  </section><section id="archive-intro">later</section></main></body></html>`;
}

function voterInfoHtml(extra = '') {
  return `<html><body><main><section id="guides">
    <h2>Voter Rights &amp; Educational Guides</h2>
    <h3>Who Represents You?</h3>
    ${extra}
  </section></main></body></html>`;
}

describe('sectionFor', () => {
  it('returns only the 2026 section, not the rest of the page', () => {
    const section = sectionFor(archiveHtml());
    expect(section).toContain('voter-guides-2026');
    expect(section).not.toContain('archive-intro');
  });

  it('returns null when the anchor is absent', () => {
    expect(sectionFor('<html></html>')).toBeNull();
  });
});

describe('inspectArchive', () => {
  it('accepts the section, all five items, and four owned copies', () => {
    const { failures, links } = inspectArchive(archiveHtml());
    expect(failures).toEqual([]);
    expect(links).toHaveLength(4);
    expect(links.every((link) => link.kind === 'owned')).toBe(true);
  });

  it('accepts Drive links, because the fallback is a valid state', () => {
    const { failures, links } = inspectArchive(
      archiveHtml({ links: DOCUMENTS.map((doc) => DRIVE(doc.driveId)) })
    );
    expect(failures).toEqual([]);
    expect(links.every((link) => link.kind === 'drive')).toBe(true);
  });

  it('fails when the section is missing', () => {
    const { failures } = inspectArchive('<html><body>no archive here</body></html>');
    expect(failures).toEqual(['/archive has no #voter-guides-2026 section']);
  });

  it('names a missing item', () => {
    const { failures } = inspectArchive(
      archiveHtml({ items: ARCHIVE_ITEMS.filter((item) => item !== 'Key Dates for the Election') })
    );
    expect(failures).toContain('#voter-guides-2026 is missing the item "Key Dates for the Election"');
  });

  it('fails when one of the four documents has no link', () => {
    const { failures } = inspectArchive(
      archiveHtml({ links: DOCUMENTS.slice(0, 3).map((doc) => OWNED(doc.slug)) })
    );
    expect(failures).toContain('#voter-guides-2026 has no link for Key Dates for the Election');
  });

  it('fails when a card points back at /voter-info', () => {
    const links = DOCUMENTS.map((doc) => OWNED(doc.slug));
    links[0] = '/voter-info';
    const { failures } = inspectArchive(archiveHtml({ links }));
    expect(failures.some((failure) => failure.includes('links back to /voter-info'))).toBe(true);
  });

  it('fails when an evergreen voter key is serialised on /archive', () => {
    const extra =
      '<script>self.__next_f.push([1,"{\\"voter.hotlines.headline\\":\\"Election Hotlines\\"}"])</script>';
    const { failures } = inspectArchive(archiveHtml({ extra }));
    expect(failures.some((failure) => failure.includes('voter.hotlines.'))).toBe(true);
  });

  it('accepts archived 2026 keys in the RSC payload', () => {
    const extra =
      '<script>self.__next_f.push([1,"{\\"voter.guide.sac_voter_guide.title\\":\\"Sacramento Voter Guide\\"}"])</script>';
    const { failures } = inspectArchive(archiveHtml({ extra }));
    expect(failures).toEqual([]);
  });
});

describe('inspectVoterInfo', () => {
  it('passes an evergreen-only page', () => {
    expect(inspectVoterInfo(voterInfoHtml())).toEqual([]);
  });

  it('fails when the 2026 section anchor returns', () => {
    const failures = inspectVoterInfo(voterInfoHtml('<section id="voter-guides-2026"></section>'));
    expect(failures.some((failure) => failure.includes('voter-guides-2026'))).toBe(true);
  });

  it('fails on a 2026 item, a Drive id, or an owned document link', () => {
    expect(
      inspectVoterInfo(voterInfoHtml('<h3>Hands Off Our Vote 2026 Toolkit</h3>')).length
    ).toBeGreaterThan(0);
    expect(
      inspectVoterInfo(voterInfoHtml(`<a href="${DRIVE(DOCUMENTS[0].driveId)}">x</a>`)).length
    ).toBeGreaterThan(0);
    expect(inspectVoterInfo(voterInfoHtml(`<a href="${OWNED(DOCUMENTS[0].slug)}">x</a>`)).length)
      .toBeGreaterThan(0);
  });

  it('fails when archived keys survive in the serialized payload', () => {
    // This is the regression the narrowed fetch removed: the 2026 keys used to
    // be serialised into /voter-info even though the page rendered none of them.
    const payload =
      '<script>self.__next_f.push([1,"{\\"voter.guides.headline\\":\\"2026 Voter Guide & Ballot Recommendations\\",\\"voter.spotlight.title\\":\\"Understanding the SAVE America Act\\"}"])</script>';
    const failures = inspectVoterInfo(voterInfoHtml(payload));
    expect(failures.some((failure) => failure.includes('voter.guides.'))).toBe(true);
  });

  it('passes when only evergreen keys are serialized', () => {
    // `voter.guide1.` is evergreen and must not trip the `voter.guide.` prefix.
    const payload =
      '<script>self.__next_f.push([1,"{\\"voter.hero.intro\\":\\"Your vote is your voice\\",\\"voter.guide1.title\\":\\"Who Represents You?\\"}"])</script>';
    expect(inspectVoterInfo(voterInfoHtml(payload))).toEqual([]);
  });

  it('does not pass a page that merely lacks the markers', () => {
    // A 200 error shell must not satisfy the negative check.
    expect(inspectVoterInfo('<html><body>Not found</body></html>')).not.toEqual([]);
  });
});

describe('pathnameOf', () => {
  it('resolves relative and absolute hrefs', () => {
    expect(pathnameOf('/voter-info')).toBe('/voter-info');
    expect(pathnameOf('https://indivisiblefairoaks.org/voter-info#guides')).toBe('/voter-info');
  });
});

describe('main', () => {
  const siteUrl = 'https://example.test';
  const SHA = 'a'.repeat(40);
  /** No real waiting in unit tests; retry decisions are still exercised. */
  const FAST = { sleep: async () => {}, retryDelays: [0, 0, 0] };

  function fakeFetch({
    archive = archiveHtml(),
    voter = voterInfoHtml(),
    linkStatus = 200,
    healthSha = SHA,
    healthStatus = 200,
  } = {}) {
    return async (url) => {
      if (url.endsWith('/api/health')) {
        return new Response(JSON.stringify({ status: 'ok', deployment: { commit: healthSha } }), {
          status: healthStatus,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/archive')) return new Response(archive, { status: 200 });
      if (url.endsWith('/voter-info')) return new Response(voter, { status: 200 });
      if (url.includes('/legacy-documents/')) {
        return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
          status: linkStatus,
          headers: { 'content-type': 'application/pdf' },
        });
      }
      return new Response('<html></html>', { status: linkStatus });
    };
  }

  it('passes when the archive and all four links are good', async () => {
    const code = await main([`--site-url=${siteUrl}`], {
      ...FAST,
      fetch: fakeFetch(),
      log: () => {},
    });
    expect(code).toBe(0);
  });

  it('fails when a document link 404s', async () => {
    const code = await main([`--site-url=${siteUrl}`], {
      ...FAST,
      fetch: fakeFetch({ linkStatus: 404 }),
      log: () => {},
    });
    expect(code).toBe(1);
  });

  it('fails when /voter-info still names 2026 material', async () => {
    const code = await main([`--site-url=${siteUrl}`], {
      ...FAST,
      fetch: fakeFetch({ voter: voterInfoHtml('<h3>Key Dates for the Election</h3>') }),
      log: () => {},
    });
    expect(code).toBe(1);
  });

  it('fails when an evergreen key leaks into the archive payload', async () => {
    const extra =
      '<script>self.__next_f.push([1,"{\\"voter.hero.intro\\":\\"Your vote is your voice\\"}"])</script>';
    const code = await main([`--site-url=${siteUrl}`], {
      ...FAST,
      fetch: fakeFetch({ archive: archiveHtml({ extra }) }),
      log: () => {},
    });
    expect(code).toBe(1);
  });

  it('passes only when the host reports the expected commit', async () => {
    const code = await main(
      [`--site-url=${siteUrl}`, `--expect-sha=${SHA}`, '--health-budget-ms=0'],
      { ...FAST, fetch: fakeFetch({ healthSha: SHA }), log: () => {} }
    );
    expect(code).toBe(0);
  });

  it('refuses to smoke a host serving a different commit', async () => {
    const code = await main(
      [`--site-url=${siteUrl}`, `--expect-sha=${SHA}`, '--health-budget-ms=0'],
      { ...FAST, fetch: fakeFetch({ healthSha: 'b'.repeat(40) }), log: () => {} }
    );
    expect(code).toBe(1);
  });

  it('polls health until the deployment for this commit is live', async () => {
    let healthCalls = 0;
    const base = fakeFetch({ healthSha: SHA });
    const fetchImpl = async (url, init) => {
      if (url.endsWith('/api/health')) {
        healthCalls += 1;
        if (healthCalls === 1) {
          return new Response(JSON.stringify({ deployment: { commit: 'b'.repeat(40) } }), {
            status: 200,
          });
        }
      }
      return base(url, init);
    };
    const code = await main(
      [`--site-url=${siteUrl}`, `--expect-sha=${SHA}`, '--health-budget-ms=50'],
      { ...FAST, fetch: fetchImpl, log: () => {} }
    );
    expect(healthCalls).toBe(2);
    expect(code).toBe(0);
  });

  it('retries a transient 404 while the deployment settles', async () => {
    let archiveAttempts = 0;
    const base = fakeFetch();
    const fetchImpl = async (url, init) => {
      if (url.endsWith('/archive')) {
        archiveAttempts += 1;
        if (archiveAttempts < 3) return new Response('not ready', { status: 404 });
      }
      return base(url, init);
    };
    const code = await main([`--site-url=${siteUrl}`], { ...FAST, fetch: fetchImpl, log: () => {} });
    expect(archiveAttempts).toBe(3);
    expect(code).toBe(0);
  });

  it('fails loudly when the archive never stops returning 500', async () => {
    const base = fakeFetch();
    const fetchImpl = async (url, init) =>
      url.endsWith('/archive') ? new Response('boom', { status: 500 }) : base(url, init);
    const code = await main([`--site-url=${siteUrl}`], { ...FAST, fetch: fetchImpl, log: () => {} });
    expect(code).toBe(1);
  });

  it('fails fast on a non-retryable 403', async () => {
    let archiveAttempts = 0;
    const base = fakeFetch();
    const fetchImpl = async (url, init) => {
      if (url.endsWith('/archive')) {
        archiveAttempts += 1;
        return new Response('forbidden', { status: 403 });
      }
      return base(url, init);
    };
    const code = await main([`--site-url=${siteUrl}`], { ...FAST, fetch: fetchImpl, log: () => {} });
    expect(archiveAttempts).toBe(1);
    expect(code).toBe(1);
  });

  it('refuses to run without an explicit site url', async () => {
    expect(await main([], { ...FAST, fetch: fakeFetch(), log: () => {} })).toBe(1);
  });
});
