// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  detectReunificationImage,
  isReunificationUuid,
  makeReferenceCode,
  referenceCodeFromBytes,
  reunificationStatusDescription,
  reunificationStatusLabel,
} from '@/lib/ice-reunification';

describe('detectReunificationImage()', () => {
  it('accepts JPEG, PNG, and WebP magic bytes', () => {
    expect(detectReunificationImage(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe(
      'image/jpeg'
    );
    expect(
      detectReunificationImage(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe('image/png');
    expect(
      detectReunificationImage(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
        ])
      )
    ).toBe('image/webp');
  });

  it('rejects a renamed or truncated file', () => {
    expect(detectReunificationImage(new TextEncoder().encode('not an image'))).toBeNull();
    expect(detectReunificationImage(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe('reference codes', () => {
  it('formats a readable, fixed-length code', () => {
    expect(referenceCodeFromBytes(new Uint8Array(7))).toBe('R-AAAAAAA');
    expect(makeReferenceCode()).toMatch(/^R-[A-HJ-NP-Z2-9]{7}$/);
  });

  it('validates only canonical UUIDs', () => {
    expect(isReunificationUuid('9f1c2d3e-4a5b-4c6d-8e7f-901234567890')).toBe(true);
    expect(isReunificationUuid('not-a-token')).toBe(false);
    expect(isReunificationUuid(null)).toBe(false);
  });
});

describe('reunification status copy', () => {
  it('does not imply release or a guaranteed outcome', () => {
    expect(reunificationStatusLabel('received')).toContain('waiting for review');
    expect(reunificationStatusLabel('verified')).toContain('follow-up');
    expect(reunificationStatusDescription('verified')).toMatch(/cannot guarantee/i);
    expect(reunificationStatusDescription('closed')).toMatch(/contact the chapter/i);
  });
});
