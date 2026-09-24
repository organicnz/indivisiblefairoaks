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
