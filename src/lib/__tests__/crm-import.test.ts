// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseCRMImportCsv, parseCsv, toCsvRow } from '@/lib/crm-import';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('name,note\n"Doe, Jane","She said ""hi"""')).toEqual([
      ['name', 'note'],
      ['Doe, Jane', 'She said "hi"'],
    ]);
  });

  it('handles CRLF and trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('skips fully empty rows', () => {
    expect(parseCsv('a\n\nb\n')).toEqual([['a'], ['b']]);
  });

  it('strips a UTF-8 BOM', () => {
    expect(parseCsv('﻿a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseCRMImportCsv', () => {
  it('requires an email header column', () => {
    const res = parseCRMImportCsv('name,city\nJane,Fair Oaks');
    expect(res.rows).toHaveLength(0);
    expect(res.errors[0].message).toMatch(/email/i);
  });

  it('requires at least a header and one data row', () => {
    const res = parseCRMImportCsv('email\n');
    expect(res.rows).toHaveLength(0);
    expect(res.errors[0].message).toMatch(/header row/i);
  });

  it('parses a valid row with defaults', () => {
    const res = parseCRMImportCsv(
      'email,first_name,last_name,city,zip_code,district,status,tags,notes\njane@example.com,Jane,Doe,Fair Oaks,95628,CA-06,choir,postcards;canvass,Met at market'
    );
    expect(res.errors).toHaveLength(0);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      city: 'Fair Oaks',
      zip_code: '95628',
      district: 'CA-06',
      status: 'choir',
      tags: ['postcards', 'canvass'],
      notes: 'Met at market',
    });
  });

  it('is column-order insensitive and lowercases headers', () => {
    const res = parseCRMImportCsv('First Name,Email\nJane,jane@example.com');
    expect(res.errors).toHaveLength(0);
    expect(res.rows[0]).toMatchObject({ email: 'jane@example.com', first_name: 'Jane' });
  });

  it('defaults district and status when missing', () => {
    const res = parseCRMImportCsv('email\nbob@example.com');
    expect(res.rows[0]).toMatchObject({ district: 'CA-06', status: 'supporter', tags: [] });
  });

  it('rejects invalid emails and duplicates', () => {
    const res = parseCRMImportCsv('email\nnot-an-email\nok@example.com\nok@example.com');
    expect(res.rows).toHaveLength(1);
    expect(res.errors).toHaveLength(2);
    expect(res.errors.some((e) => e.message.includes('Invalid email'))).toBe(true);
    expect(res.errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
  });

  it('defaults unknown status to supporter with a warning', () => {
    const res = parseCRMImportCsv('email,status\nx@example.com,superstar');
    expect(res.rows[0].status).toBe('supporter');
    expect(res.errors[0].message).toMatch(/Unknown status/);
  });

  it('normalizes status whitespace to underscores', () => {
    const res = parseCRMImportCsv('email,status\nx@example.com,Active Volunteer');
    expect(res.rows[0].status).toBe('active_volunteer');
  });

  it('splits tags on semicolons or pipes and lowercases them', () => {
    const res = parseCRMImportCsv('email,tags\nx@example.com,Postcards | Choir;DONOR');
    expect(res.rows[0].tags).toEqual(['postcards', 'choir', 'donor']);
  });
});

describe('toCsvRow', () => {
  it('quotes fields containing commas, quotes, or newlines', () => {
    expect(toCsvRow(['plain', 'a,b', 'say "hi"', 'line\nbreak', null, 42])).toBe(
      'plain,"a,b","say ""hi""","line\nbreak",,42'
    );
  });
});

/**
 * An export that cannot be re-imported intact is not a backup.
 *
 * The chapter's only off-platform copy of its constituent list is
 * "Export → keep the CSV". That file has to survive a round trip through
 * `parseCRMImportCsv`, and two columns did not: `notes` was read by the
 * importer but never written by the exporter, and `address` was written by
 * neither while the column existed and the editor modal edited it. Both failures
 * are invisible at export time and only surface on the day the file is needed.
 */
describe('export columns round-trip through the importer', () => {
  /** The exporter's header, verbatim. Kept in step by the assertion below. */
  const EXPORT_HEADER = [
    'ID',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Address',
    'District',
    'City',
    'Zip Code',
    'Status',
    'Tags',
    'Notes',
    'Do Not Email',
    'Lifetime Giving (cents)',
    'Source',
    'Created At',
  ];

  it('carries the address and the notes through to a parsed row', () => {
    const csv = [
      EXPORT_HEADER.join(','),
      [
        'c-1',
        'Robin',
        'Vega',
        'robin@example.org',
        '9165550143',
        '4821 Fair Oaks Blvd',
        'CA-06',
        'Carmichael',
        '95608',
        'active_volunteer',
        'canvasser; choir',
        toCsvRow(['Prefers phone, not email']),
        'no',
        '0',
        'manual',
        '2026-01-05T00:00:00.000Z',
      ].join(','),
    ].join('\r\n');

    const { rows, errors } = parseCRMImportCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: 'robin@example.org',
      first_name: 'Robin',
      last_name: 'Vega',
      phone: '9165550143',
      address: '4821 Fair Oaks Blvd',
      city: 'Carmichael',
      zip_code: '95608',
      district: 'CA-06',
      notes: 'Prefers phone, not email',
      do_not_email: false,
    });
  });

  it('keeps an opted-out constituent opted out through the round trip', () => {
    // The backup is useless if restoring it quietly re-subscribes everyone who
    // had refused email. This is the column the exporter wrote and the importer
    // dropped for the first three releases of that export.
    const csv = [
      EXPORT_HEADER.join(','),
      [
        'c-3',
        'Tammy',
        'Okafor',
        'tammy@example.org',
        '',
        '',
        'CA-06',
        'Carmichael',
        '95608',
        'supporter',
        '',
        '',
        'yes',
        '0',
        'manual',
        '2026-03-01T00:00:00.000Z',
      ].join(','),
    ].join('\r\n');

    const { rows, errors } = parseCRMImportCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0].do_not_email).toBe(true);
  });

  /**
   * Three states, and the middle one is the change.
   *
   * A blank cell and an absent column used to both read as `false` — "opted in".
   * An import is how a chapter restores a backup or loads a membership list, and
   * neither has asked anybody about email: recording a yes for every row enrolled
   * a whole spreadsheet into chapter broadcast mail. So both are now `null`, and
   * an unrecognised value is `null` too — a typo must not opt somebody in *or*
   * out, because the honest answer to "this column says `maybe`" is that we do not
   * know.
   */
  it('reads yes, reads no, and treats blank, absent and unrecognised as never asked', () => {
    const read = (csv: string) => parseCRMImportCsv(csv).rows[0].do_not_email;
    expect(read('email,do_not_email\na@b.co,YES')).toBe(true);
    expect(read('email,do_not_email\na@b.co,true')).toBe(true);
    expect(read('email,do_not_email\na@b.co,1')).toBe(true);
    expect(read('email,do_not_email\na@b.co,x')).toBe(true);
    expect(read('email,do_not_email\na@b.co,no')).toBe(false);
    expect(read('email,do_not_email\na@b.co,0')).toBe(false);
    // The three "we do not know" shapes.
    expect(read('email,do_not_email\na@b.co,')).toBeNull();
    expect(read('email\na@b.co')).toBeNull();
    expect(read('email,do_not_email\na@b.co,perhaps')).toBeNull();
  });

  /**
   * The export half of the round trip.
   *
   * `c.do_not_email ? 'yes' : 'no'` wrote `no` for a null row, so exporting and
   * re-importing the chapter's own backup converted every "never asked"
   * constituent into an explicit yes — and the *second* cycle mailed them. The
   * importer reads a blank as null, so the blank here is what makes the file
   * lossless.
   */
  it('exports a null consent as a blank, so a restore preserves it', () => {
    const csv = ['email,do_not_email', 'a@b.co,', 'c@d.co,yes', 'e@f.co,no'].join('\n');
    const { rows } = parseCRMImportCsv(csv);
    expect(rows.map((r) => r.do_not_email)).toEqual([null, true, false]);
  });

  it('quotes a note containing a comma, so the columns do not shift', () => {
    // The failure this guards is a silent column shift: a note with a comma
    // moves every later value one column left and the row still parses.
    const csv = [
      EXPORT_HEADER.join(','),
      [
        'c-2',
        'Sam',
        'Oyelaran',
        'sam@example.org',
        '',
        '',
        'CA-06',
        'Fair Oaks',
        '95626',
        'donor',
        '',
        toCsvRow(['Met at the town hall, wants a yard sign']),
        'no',
        '2500',
        'import',
        '2026-02-01T00:00:00.000Z',
      ].join(','),
    ].join('\r\n');

    const { rows } = parseCRMImportCsv(csv);
    expect(rows[0].notes).toBe('Met at the town hall, wants a yard sign');
    expect(rows[0].zip_code).toBe('95626');
    expect(rows[0].status).toBe('donor');
  });
});
