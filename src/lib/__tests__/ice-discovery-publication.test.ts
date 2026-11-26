// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  discoveryPublicationStatus,
  iceSourceReportPublicationState,
  iceSourceReportPublicationStateLabel,
  parseIceDiscoveryAutoPublish,
} from '@/lib/ice-discovery-publication';

const NOW = Date.parse('2026-11-26T12:00:00.000Z');

describe('discovery publication switch', () => {
  it('is off for an absent, empty, or non-true value', () => {
    expect(parseIceDiscoveryAutoPublish(undefined)).toBe(false);
    expect(parseIceDiscoveryAutoPublish('')).toBe(false);
    expect(parseIceDiscoveryAutoPublish('false')).toBe(false);
    expect(parseIceDiscoveryAutoPublish('1')).toBe(false);
  });

  it('is on only for an explicit true value, case and whitespace tolerant', () => {
    expect(parseIceDiscoveryAutoPublish('true')).toBe(true);
    expect(parseIceDiscoveryAutoPublish(' TRUE ')).toBe(true);
  });

  it('maps the switch to a draft by default and a publication submission when on', () => {
    expect(discoveryPublicationStatus(false)).toBe('draft');
    expect(discoveryPublicationStatus(true)).toBe('published');
  });
});

describe('source report publication state', () => {
  it('requires rights confirmation before considering publication status', () => {
    expect(
      iceSourceReportPublicationState(
        {
          rights_status: 'unconfirmed',
          publication_status: 'draft',
          published_at: '2026-11-01T00:00:00.000Z',
        },
        NOW
      )
    ).toBe('draft-rights');
  });

  it('keeps a rights-confirmed draft private', () => {
    expect(
      iceSourceReportPublicationState(
        {
          rights_status: 'confirmed',
          publication_status: 'draft',
          published_at: '2026-11-01T00:00:00.000Z',
        },
        NOW
      )
    ).toBe('draft-unpublished');
  });

  it('treats a future publication time as scheduled, not public', () => {
    expect(
      iceSourceReportPublicationState(
        {
          rights_status: 'confirmed',
          publication_status: 'published',
          published_at: '2026-12-01T00:00:00.000Z',
        },
        NOW
      )
    ).toBe('scheduled');
  });

  it('is public only when submitted, confirmed, and due', () => {
    expect(
      iceSourceReportPublicationState(
        {
          rights_status: 'confirmed',
          publication_status: 'published',
          published_at: '2026-11-01T00:00:00.000Z',
        },
        NOW
      )
    ).toBe('public');
  });

  it('labels every state unambiguously', () => {
    expect(iceSourceReportPublicationStateLabel('public')).toBe('Public now');
    expect(iceSourceReportPublicationStateLabel('scheduled')).toBe('Scheduled');
    expect(iceSourceReportPublicationStateLabel('draft-rights')).toContain('rights pending');
    expect(iceSourceReportPublicationStateLabel('draft-unpublished')).toContain('publication held');
  });
});
