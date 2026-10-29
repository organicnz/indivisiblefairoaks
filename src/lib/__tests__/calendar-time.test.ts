// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  instantToPacificBasic,
  instantToPacificInput,
  PACIFIC_TZ,
  pacificWallToInstant,
} from '@/lib/calendar-time';

// Reference values are resolved by hand against the zone rules, not derived
// with the same helpers: 2026-11-10 18:30 is PST — DST ended 2026-11-01 — so
// the instant is 2026-11-11T02:30Z; 2026-07-14 19:30 is PDT, instant
// 2026-07-15T02:30Z. Those are issue #149's own meeting and a summer control.

describe('instantToPacificBasic', () => {
  it('renders a UTC instant as Pacific wall time in PST', () => {
    expect(instantToPacificBasic('2026-11-11T02:30:00Z')).toBe('20261110T183000');
  });

  it('accepts the `+00:00` shape PostgREST returns', () => {
    expect(instantToPacificBasic('2026-11-11T02:30:00+00:00')).toBe('20261110T183000');
  });

  it('renders Pacific wall time in PDT in the summer', () => {
    expect(instantToPacificBasic('2026-07-15T02:30:00Z')).toBe('20260714T193000');
  });

  it('does not depend on the process timezone (UTC-midnight edge)', () => {
    expect(instantToPacificBasic('2026-12-25T12:00:00Z')).toBe('20261225T040000');
  });

  it('returns empty for missing or unparseable input', () => {
    expect(instantToPacificBasic(undefined)).toBe('');
    expect(instantToPacificBasic(null)).toBe('');
    expect(instantToPacificBasic('')).toBe('');
    expect(instantToPacificBasic('not-a-date')).toBe('');
  });

  it('exports the zone the links name', () => {
    expect(PACIFIC_TZ).toBe('America/Los_Angeles');
  });
});

describe('pacificWallToInstant', () => {
  it('reads a wall time as PST after the November changeover', () => {
    expect(pacificWallToInstant('2026-11-10T18:30')).toBe('2026-11-11T02:30:00.000Z');
  });

  it('reads a wall time as PDT before it', () => {
    expect(pacificWallToInstant('2026-07-14T19:30')).toBe('2026-07-15T02:30:00.000Z');
  });

  it('accepts an optional seconds field and a space separator', () => {
    expect(pacificWallToInstant('2026-11-10T18:30:00')).toBe('2026-11-11T02:30:00.000Z');
    expect(pacificWallToInstant('2026-11-10 18:30')).toBe('2026-11-11T02:30:00.000Z');
  });

  it('round-trips through instantToPacificBasic', () => {
    expect(instantToPacificBasic(pacificWallToInstant('2026-09-01T15:45'))).toBe('20260901T154500');
  });

  it('resolves an ambiguous fall-back wall time to the post-transition instant', () => {
    // 01:30 occurs twice on 2026-11-01 (PDT then PST); the documented choice
    // is the second occurrence — a deterministic answer is what matters.
    expect(pacificWallToInstant('2026-11-01T01:30')).toBe('2026-11-01T09:30:00.000Z');
  });

  it('shifts a nonexistent spring-forward wall time to the next instant', () => {
    // 02:30 does not exist on 2027-03-14; the code lands on 03:30 PDT.
    expect(pacificWallToInstant('2027-03-14T02:30')).toBe('2027-03-14T10:30:00.000Z');
  });

  it('returns empty for missing or non-datetime-local input', () => {
    expect(pacificWallToInstant('')).toBe('');
    expect(pacificWallToInstant('garbage')).toBe('');
    expect(pacificWallToInstant('2026-11-10')).toBe('');
  });
});

describe('instantToPacificInput', () => {
  it('produces the datetime-local value the editor inputs display', () => {
    expect(instantToPacificInput('2026-11-11T02:30:00+00:00')).toBe('2026-11-10T18:30');
  });

  it('keeps minutes only, dropping seconds the input cannot express', () => {
    expect(instantToPacificInput('2026-07-15T02:30:11Z')).toBe('2026-07-14T19:30');
  });

  it('returns empty for missing or unparseable input', () => {
    expect(instantToPacificInput(null)).toBe('');
    expect(instantToPacificInput('')).toBe('');
    expect(instantToPacificInput('not-a-date')).toBe('');
  });
});
