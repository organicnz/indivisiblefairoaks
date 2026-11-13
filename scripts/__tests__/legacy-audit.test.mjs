// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  assetKey,
  blockedReasonFor,
  classifyPageStatus,
  classifyRights,
  classifyUrl,
  cleanPageLinks,
  dedupeAssets,
  displayFilename,
  driveDownloadUrl,
  driveIdFromUrl,
  filenameFromDisposition,
  filenameFromUrl,
  isEmptyLegacyPage,
  normalizeUrl,
  safeArchiveFilename,
  stripLegacyChrome,
  youtubeIdFromUrl,
} from '../legacy-audit-lib.mjs';

describe('legacy audit URL helpers', () => {
  it('extracts Drive IDs from file, open, uc and Docs URLs', () => {
    const id = '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy';
    expect(driveIdFromUrl(`https://drive.google.com/file/d/${id}/view`)).toBe(id);
    expect(driveIdFromUrl(`https://drive.google.com/open?id=${id}`)).toBe(id);
    expect(driveIdFromUrl(`https://drive.google.com/uc?id=${id}&export=download`)).toBe(id);
    expect(driveIdFromUrl(`https://docs.google.com/document/d/${id}/edit`)).toBe(id);
    expect(driveIdFromUrl('https://example.com/file.pdf')).toBeNull();
  });

  it('turns a Drive file into a download URL and a Google Doc into a PDF export', () => {
    const id = '1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U';
    expect(driveDownloadUrl(`https://drive.google.com/file/d/${id}/view`)).toBe(
      `https://drive.google.com/uc?export=download&id=${id}`
    );
    expect(driveDownloadUrl(`https://docs.google.com/document/d/${id}/edit`)).toBe(
      `https://docs.google.com/document/d/${id}/export?format=pdf`
    );
  });

  it('normalises URLs without changing the file identity', () => {
    expect(normalizeUrl('http://ardems.org/')).toBe('https://www.ardems.org/');
    expect(normalizeUrl('https://www. ardems.org/events')).toBe(
      'https://www.ardems.org/events'
    );
    const normalized = normalizeUrl(
      'https://drive.google.com/file/d/abc123/view?utm_source=test&usp=sharing#fragment'
    );
    expect(normalized).toBe('https://drive.google.com/file/d/abc123/view');
  });

  it('unwraps Google redirect links before classification', () => {
    expect(
      normalizeUrl(
        'https://www.google.com/url?q=https%3A%2F%2Fsecure.actblue.com%2Fdonate%2Findivisiblefoc&sa=D&sntz=1&usg=AOvVaw123'
      )
    ).toBe('https://secure.actblue.com/donate/indivisiblefoc');
    expect(
      classifyUrl(
        normalizeUrl(
          'https://www.google.com/url?q=https%3A%2F%2Fwww.mobilize.us%2Findivisible%2Fevent%2F1011420%2F&sa=D&sntz=1&usg=AOvVaw123'
        )
      ).kind
    ).toBe('link');
  });

  it('removes legacy navigation, chrome contact links and duplicate wrapped links', () => {
    const links = cleanPageLinks(
      [
        { href: 'https://sites.google.com/indivisiblefairoaks.org/indivisiblefairoaks/', text: '' },
        { href: 'mailto:contact@indivisiblefairoaks.org', text: 'contact@indivisiblefairoaks.org' },
        {
          href: 'https://www.google.com/url?q=https%3A%2F%2Fwww.mobilize.us%2Findivisible%2Fevent%2F1011420%2F&sa=D&sntz=1&usg=AOvVaw123',
          text: 'Singing Protest with Indivisible Fair Oaks-Carmichael · IndivisibleThis a local event',
        },
        {
          href: 'https://www.mobilize.us/indivisible/event/1011420/',
          text: 'Singing Protest with Indivisible Fair Oaks-Carmichael · Indivisible',
        },
        { href: 'mailto:subscribe@indivisiblefairoaks.org', text: 'subscribe@indivisiblefairoaks.org' },
      ],
      'https://sites.google.com/indivisiblefairoaks.org/indivisiblefairoaks/'
    );
    expect(links).toHaveLength(2);
    expect(links[0].href).toBe('https://www.mobilize.us/indivisible/event/1011420/');
    expect(links[0].text).toBe('Singing Protest with Indivisible Fair Oaks-Carmichael');
    expect(links[1].href).toBe('mailto:subscribe@indivisiblefairoaks.org');
  });

  it('extracts YouTube IDs from all supported URL shapes', () => {
    expect(youtubeIdFromUrl('https://www.youtube.com/watch?v=0a9zLvWVqgQ')).toBe(
      '0a9zLvWVqgQ'
    );
    expect(youtubeIdFromUrl('https://www.youtube.com/embed/BhdjDlRUMUw')).toBe('BhdjDlRUMUw');
    expect(youtubeIdFromUrl('https://youtu.be/M631H68kLCE')).toBe('M631H68kLCE');
    expect(youtubeIdFromUrl('https://example.com/watch?v=abc')).toBeNull();
  });

  it('reads filenames from Content-Disposition and URLs', () => {
    expect(filenameFromDisposition('attachment; filename="EVG-Nov26-Sp.pdf"')).toBe(
      'EVG-Nov26-Sp.pdf'
    );
    expect(
      filenameFromDisposition("attachment; filename*=UTF-8''CalMatters%202026%20Guide.pdf")
    ).toBe('CalMatters 2026 Guide.pdf');
    expect(filenameFromUrl('https://example.com/files/Voter%20Guide.pdf?x=1')).toBe(
      'Voter Guide.pdf'
    );
    expect(filenameFromUrl('https://example.com/download/abc')).toBeNull();
  });
});

describe('legacy audit classification', () => {
  it('classifies Drive, Docs, YouTube and direct file links', () => {
    expect(classifyUrl('https://drive.google.com/file/d/10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy/view').kind).toBe(
      'drive'
    );
    expect(classifyUrl('https://docs.google.com/document/d/1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U/edit').kind).toBe(
      'google-doc'
    );
    expect(classifyUrl('https://www.youtube.com/embed/BhdjDlRUMUw').kind).toBe('youtube');
    expect(classifyUrl('https://example.com/ARC.VOTES.pdf', 'ARC.VOTES.pdf').kind).toBe('pdf');
    expect(
      classifyUrl('https://sites.google.com/sitesv-images-rt/APXyLQabc=w1280', '').kind
    ).toBe('image');
  });

  it('marks known blocked IDs and keeps third-party docs out of public rehosting', () => {
    expect(
      blockedReasonFor({ driveId: '1Uv07FQ3td48f2bS1fouCo69L_t7UgWZG' })
    ).toContain('sign-in');
    expect(classifyRights('https://calmatters.org/guide.pdf', 'CalMatters Guide.pdf')).toBe(
      'third_party'
    );
    expect(classifyRights('https://drive.google.com/file/d/abc/view', 'Chapter Newsletter.pdf')).toBe(
      'chapter_owned'
    );
    expect(classifyRights('https://drive.google.com/file/d/abc/view', 'unknown.pdf')).toBe(
      'unknown'
    );
  });

  it('uses known filenames for Drive IDs when the link text is bare', () => {
    expect(
      displayFilename({
        driveId: '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy',
        filename: null,
        sourceUrl: 'https://drive.google.com/file/d/10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy/view',
      })
    ).toBe('CalMatters 2026 Voter Guide non-partisan 2026.pdf');
  });

  it('dedupes the same Drive file found in viewer and download shapes', () => {
    const assets = dedupeAssets([
      {
        sourceUrl: 'https://drive.google.com/file/d/10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy/view',
        driveId: '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy',
        kind: 'drive',
        pagePaths: ['/voter-information'],
      },
      {
        sourceUrl: 'https://drive.google.com/uc?id=10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy&export=download',
        driveId: '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy',
        kind: 'drive',
        pagePaths: ['/voter-information', '/current-events'],
      },
    ]);
    expect(assets).toHaveLength(1);
    expect(assets[0].pagePaths).toEqual(['/voter-information', '/current-events']);
    expect(assetKey(assets[0])).toBe(
      'drive:10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy:drive'
    );
  });

  it('removes Google Sites chrome but keeps real copy', () => {
    const text = stripLegacyChrome(`
      Search this site
      Skip to main content
      Embedded Files
      Voter Information
      Voter Information
      The chapter publishes nonpartisan voting guides.
      Get in touch with our chapter at
      contact@indivisiblefairoaks.org
      Report abuse
      Page details
    `);
    expect(text).toBe(
      'Voter Information\nThe chapter publishes nonpartisan voting guides.'
    );
    expect(
      stripLegacyChrome(`
        Donate to Indivisible →
        Subscribe to our mailing list at subscribe@indivisiblefairoaks.org
        · Indivisible
        Fair Oaks-Carmichael
        Donate to Indivisible Fair Oaks/Carmichael
        ← Visit Us On Instagram
        Our Mission Statement:
        Build a nonviolent grassroots movement.
      `)
    ).toBe('Our Mission Statement:\nBuild a nonviolent grassroots movement.');
  });

  it('classifies page statuses against the current routes and redirects', () => {
    expect(
      classifyPageStatus(
        { path: '/voter-information', destination: '/voter-info' },
        { routes: ['/voter-info'], legacyRedirects: [] }
      )
    ).toBe('represented');
    expect(
      classifyPageStatus(
        { path: '/current-events', destination: '/archive#current-events' },
        { routes: ['/archive'], legacyRedirects: [] }
      )
    ).toBe('archive');
    expect(
      classifyPageStatus(
        { path: '/current-events', destination: '/current-events' },
        { routes: [], legacyRedirects: [] }
      )
    ).toBe('missing');
  });

  it('detects an empty page without treating chrome as content', () => {
    expect(isEmptyLegacyPage({ text: 'Search this site\nSkip to main content\n', assets: [] })).toBe(
      true
    );
    expect(
      isEmptyLegacyPage({
        text: 'This page has a real paragraph about the chapter and its upcoming work, with enough words that the empty-page heuristic does not mistake it for navigation chrome.',
        assets: [],
      })
    ).toBe(false);
  });

  it('sanitises archive filenames without leaving path traversal', () => {
    const safe = safeArchiveFilename('../../My File.pdf');
    expect(safe).not.toContain('/');
    expect(safe).not.toMatch(/^\./);
    expect(safe).toContain('My File.pdf');
    expect(safeArchiveFilename('', 'legacy-asset')).toBe('legacy-asset');
  });
});
