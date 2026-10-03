// Pure CSV parsing + row validation for CRM constituent import.
// Kept out of the 'use server' actions module so it stays sync and unit-testable.

export interface CRMImportRow {
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  district: string;
  status: string;
  tags: string[];
  notes: string | null;
  do_not_email: boolean;
}

export interface CRMImportError {
  line: number;
  message: string;
}

export interface CRMImportParseResult {
  rows: CRMImportRow[];
  errors: CRMImportError[];
}

const VALID_STATUSES = new Set([
  'active_volunteer',
  'supporter',
  'donor',
  'choir',
  'organizer',
  'inactive',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Single source of truth for tag shape, shared by the CSV importer and the
 * hand-edit action schema. A comma is banned outright: tags round-trip through
 * comma-joined URL params (`?tag=a,b`), so a comma inside a tag is unrepresentable
 * and silently splits into two on the next read.
 */
export const MAX_TAGS_PER_CONTACT = 20;
export const MAX_TAG_LENGTH = 40;
export const TAG_PATTERN = /^[\w][\w .'&/+-]*$/u;

export function normalizeTags(raw: string[]): string[] {
  return [...new Set(raw.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(
    0,
    MAX_TAGS_PER_CONTACT
  );
}

/** RFC 4180-ish CSV parser: handles quoted fields, escaped quotes, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const input = text.replace(/^﻿/, '');

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function splitTags(raw: string): string[] {
  return normalizeTags(raw.split(/[;|]/).filter((t) => TAG_PATTERN.test(t.trim())));
}

function cell(row: string[], index: number): string {
  return (row[index] ?? '').trim();
}

/**
 * Parse a CRM import CSV. Requires an `email` header column (order-insensitive).
 * Optional: first_name, last_name, phone, address, city, zip_code, district,
 * status, tags, notes, do_not_email.
 *
 * `do_not_email` accepts the exporter's 'yes'/'no'; absent column means
 * everyone is treated as opted in, matching the column's DEFAULT.
 */
export function parseCRMImportCsv(csvText: string): CRMImportParseResult {
  const parsed = parseCsv(csvText);
  if (parsed.length < 2) {
    return {
      rows: [],
      errors: [{ line: 0, message: 'CSV must include a header row and at least one data row' }],
    };
  }

  const header = parsed[0].map(normHeader);
  const emailIdx = header.indexOf('email');
  if (emailIdx === -1) {
    return {
      rows: [],
      errors: [{ line: 1, message: 'CSV header must include an "email" column' }],
    };
  }

  const idx = (name: string) => header.indexOf(name);
  const firstNameIdx = idx('first_name');
  const lastNameIdx = idx('last_name');
  const phoneIdx = idx('phone');
  const addressIdx = idx('address');
  const cityIdx = idx('city');
  const zipIdx = idx('zip_code');
  const districtIdx = idx('district');
  const statusIdx = idx('status');
  const tagsIdx = idx('tags');
  const notesIdx = idx('notes');
  // The exporter has written this column since the round-trip was made
  // survivable without it — and the importer has never read it. Restoring the
  // chapter's only off-platform backup therefore reset every opted-out contact
  // to opted-IN, and the next broadcast mailed everyone who had asked to stop
  // hearing from the chapter.
  const doNotEmailIdx = idx('do_not_email');

  /** Accept the export's 'yes'/'no' and the obvious coercions a hand-written
   *  backup CSV might use. Anything unrecognised reads as opted-in, which
   *  matches the column's DEFAULT and the previous importer's behaviour. */
  const parseDoNotEmail = (raw: string): boolean => /^(yes|y|true|t|1|x)$/i.test(raw.trim());

  const rows: CRMImportRow[] = [];
  const errors: CRMImportError[] = [];
  const seen = new Set<string>();

  for (let r = 1; r < parsed.length; r++) {
    const line = r + 1;
    const raw = parsed[r];
    const email = cell(raw, emailIdx).toLowerCase();

    if (!email) {
      errors.push({ line, message: 'Missing email address' });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ line, message: `Invalid email address: ${email}` });
      continue;
    }
    if (seen.has(email)) {
      errors.push({ line, message: `Duplicate email in file: ${email}` });
      continue;
    }
    seen.add(email);

    let status = statusIdx >= 0 ? cell(raw, statusIdx).toLowerCase().replace(/\s+/g, '_') : '';
    if (status && !VALID_STATUSES.has(status)) {
      errors.push({
        line,
        message: `Unknown status "${status}" for ${email} — defaulting to supporter`,
      });
      status = 'supporter';
    }
    if (!status) status = 'supporter';

    const district = (districtIdx >= 0 && cell(raw, districtIdx)) || 'CA-06';

    rows.push({
      email,
      first_name: firstNameIdx >= 0 ? cell(raw, firstNameIdx) || null : null,
      last_name: lastNameIdx >= 0 ? cell(raw, lastNameIdx) || null : null,
      phone: phoneIdx >= 0 ? cell(raw, phoneIdx) || null : null,
      // `address` is in the column set so that an export round-trips. The
      // exporter writes it, the column exists, and the editor modal edits it —
      // but the importer ignored it, so a restored backup silently lost every
      // street address in the chapter.
      address: addressIdx >= 0 ? cell(raw, addressIdx) || null : null,
      city: cityIdx >= 0 ? cell(raw, cityIdx) || null : null,
      zip_code: zipIdx >= 0 ? cell(raw, zipIdx) || null : null,
      district,
      status,
      tags: tagsIdx >= 0 ? splitTags(cell(raw, tagsIdx)) : [],
      notes: notesIdx >= 0 ? cell(raw, notesIdx) || null : null,
      do_not_email: doNotEmailIdx >= 0 ? parseDoNotEmail(cell(raw, doNotEmailIdx)) : false,
    });
  }

  return { rows, errors };
}

/** Serialize a row array to CSV with quoted fields (RFC 4180). */
export function toCsvRow(fields: (string | number | null | undefined)[]): string {
  return fields
    .map((f) => {
      const s = f === null || f === undefined ? '' : String(f);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');
}
