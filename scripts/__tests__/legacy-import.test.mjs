// @vitest-environment node
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  cleanLegacyBodyText,
  documentCategoryForPage,
  documentDisplayTitle,
  documentSlug,
  documentTitle,
  effectiveRights,
  extensionForAsset,
  imageDhash,
  dhashDistance,
  isDocumentPreviewAsset,
  isUtilityImage,
  publishedDateFromFilename,
  publicMimeType,
} from '../legacy-import.mjs';

const asset = {
  sourceUrl: 'https://drive.google.com/file/d/1rQbBKQomLL3PgGy46IukFkxVE2GMkhHd/preview',
  driveId: '1rQbBKQomLL3PgGy46IukFkxVE2GMkhHd',
  kind: 'drive-embed',
  filename: 'Newsletter - 2026-04-27.pdf',
  rights: 'chapter_owned',
  pagePath: '/newsletters',
  pageKind: 'newsletters',
};

describe('legacy import plan', () => {
  it('makes a stable, readable document slug from the asset key', () => {
    const first = documentSlug(asset);
    expect(first).toBe(documentSlug({ ...asset }));
    expect(first).toMatch(/^newsletter-2026-04-27-[a-z0-9]+$/);
    expect(first.length).toBeLessThanOrEqual(100);
  });

  it('keeps document titles readable', () => {
    expect(documentTitle(asset)).toBe('Newsletter 2026 04 27');
    expect(documentTitle({ ...asset, filename: null })).toContain('Legacy Drive document');
    expect(
      documentTitle({
        ...asset,
        filename: 'untitled',
        caption: 'Document, General Overview of your rights in a set of scenarios',
      })
    ).toBe('General Overview of your rights in a set of scenarios');
  });

  it('uses reviewed public titles without changing the stable document slug', () => {
    const spanishGuide = { ...asset, driveId: '16PoEMeUfNlrrTW7j6hwFuKJW0aDuHfTi' };
    expect(documentTitle(spanishGuide)).toBe('Newsletter 2026 04 27');
    expect(documentDisplayTitle(spanishGuide)).toBe('Easy Voter Guide — November 2026 (Spanish)');
    expect(documentDisplayTitle({ ...asset, driveId: 'not-in-the-override-map' })).toBe(
      documentTitle(asset)
    );
    expect(documentSlug(spanishGuide)).toMatch(/^newsletter-2026-04-27-[a-z0-9]+$/);
  });

  it('removes duplicate page headings and document filenames from preserved body text', () => {
    const body = [
      'Voter Information',
      'EVG-Nov26-Sp.pdf',
      'Voting Right formerly incarderated pg 207072026.pdf',
      'Voter Information',
      'Read the guides and check your registration.',
    ].join('\n');
    expect(cleanLegacyBodyText(body, 'Voter Information')).toBe(
      'Read the guides and check your registration.'
    );
    expect(cleanLegacyBodyText('Upcoming Events\nARC.VOTES.pdf\nJoin us.', 'Upcoming Events')).toBe(
      'Join us.'
    );
    expect(
      cleanLegacyBodyText(
        'American River Democrats https://www. ardems.org Community organization',
        'Links'
      )
    ).toBe('American River Democrats https://www.ardems.org Community organization');
  });

  it('repairs mojibake and known source-filename typos in public titles', () => {
    expect(
      documentTitle({
        ...asset,
        filename: 'Supreme Court Ruling Summary \u00e2\u0080\u0094 Louisiana v. Callais.pdf',
      })
    ).toBe('Supreme Court Ruling Summary — Louisiana v. Callais');
    expect(
      documentTitle({
        ...asset,
        filename: 'Voting Right formerly incarderated pg 107072026.pdf',
      })
    ).toBe('Voting Right formerly incarcerated pg 107072026');
    expect(
      documentTitle({ ...asset, filename: 'Sacramentp List Elected Officials 202507072026.pdf' })
    ).toBe('Sacramento List Elected Officials 202507072026');
    expect(documentTitle({ ...asset, filename: 'KEY DATES FOR THE ELECTION.docx\u0000' })).toBe(
      'KEY DATES FOR THE ELECTION'
    );
    expect(
      documentTitle({ ...asset, filename: 'KEY DATES FOR THE ELECTION.docx\u200b' })
    ).toBe('KEY DATES FOR THE ELECTION');
    expect(
      documentTitle({ ...asset, filename: 'KEY DATES FOR THE ELECTION.docx.pdf' })
    ).toBe('KEY DATES FOR THE ELECTION');
  });

  it('keeps QR/blank utility captures private', () => {
    expect(isUtilityImage({ width: 432, height: 450, byteSize: 5_831 })).toBe(true);
    expect(isUtilityImage({ width: 1289, height: 508, byteSize: 4_023 })).toBe(true);
    expect(isUtilityImage({ width: 1280, height: 293, byteSize: 34_413 })).toBe(false);
    expect(isUtilityImage({ width: 512, height: 268, byteSize: 153_116 })).toBe(false);
  });

  it('matches images by content hash rather than the rotating source URL', async () => {
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: '#d9d9d9' },
    })
      .png()
      .toBuffer();
    const first = await imageDhash(png);
    const second = await imageDhash(png);
    expect(first).toHaveLength(64);
    expect(dhashDistance(first, second)).toBe(0);
    expect(dhashDistance(first, `${first.slice(0, -1)}${first.endsWith('0') ? '1' : '0'}`)).toBe(1);
  });

  it('does not publish Google Docs generated preview images', () => {
    expect(
      isDocumentPreviewAsset({
        sourceUrl: 'https://lh7-us.googleusercontent.com/docs/AHkbwyKfuwKp1OYm=w1200-h630-p',
      })
    ).toBe(true);
    expect(
      isDocumentPreviewAsset({ sourceUrl: 'https://sites.google.com/sitesv-images-rt/APXy=w1280' })
    ).toBe(false);
  });

  it('routes page kinds to document categories', () => {
    expect(documentCategoryForPage('voter')).toBe('voter');
    expect(documentCategoryForPage('newsletters')).toBe('newsletter');
    expect(documentCategoryForPage('choir')).toBe('choir');
    expect(documentCategoryForPage('events')).toBe('event');
    expect(documentCategoryForPage('home')).toBe('general');
  });

  it('promotes only chapter-owned or public-domain images from the old site', () => {
    expect(
      effectiveRights({
        kind: 'image',
        sourceUrl: 'https://sites.google.com/sitesv-images-rt/abc=w1280',
        rights: 'unknown',
      })
    ).toBe('chapter_owned');
    expect(
      effectiveRights({
        kind: 'image',
        sourceUrl: 'https://example.com/third-party.jpg',
        rights: 'unknown',
      })
    ).toBe('unknown');
    expect(effectiveRights({ ...asset, rights: 'third_party' })).toBe('third_party');
  });

  it('extracts publication dates without inventing one', () => {
    expect(publishedDateFromFilename('Newsletter - 2026-04-27.pdf')).toBe(
      '2026-04-27T00:00:00.000Z'
    );
    expect(publishedDateFromFilename('flyer.pdf')).toBeNull();
  });

  it('only permits safe public MIME types', () => {
    expect(publicMimeType(asset, 'file.pdf', 'application/pdf')).toBe('application/pdf');
    expect(publicMimeType(asset, 'file.docx', 'application/octet-stream')).toBeNull();
    expect(extensionForAsset(asset, 'file.pdf', 'application/pdf')).toBe('pdf');
    expect(extensionForAsset(asset, null, 'application/pdf')).toBe('pdf');
  });
});
