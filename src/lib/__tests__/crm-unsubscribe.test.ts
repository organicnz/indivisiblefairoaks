// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderUnsubscribeGreeting } from '@/lib/crm-unsubscribe';

describe('renderUnsubscribeGreeting', () => {
  it('returns empty string for null/undefined/blank names', () => {
    expect(renderUnsubscribeGreeting(null)).toBe('');
    expect(renderUnsubscribeGreeting(undefined)).toBe('');
    expect(renderUnsubscribeGreeting('')).toBe('');
    expect(renderUnsubscribeGreeting('   ')).toBe('');
    expect(renderUnsubscribeGreeting('\x00\x01')).toBe('');
  });

  it('escapes HTML so stored first_name cannot inject markup', () => {
    const out = renderUnsubscribeGreeting('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(out).toMatch(/^Hi /);
  });

  it('escapes script tags and quotes', () => {
    const out = renderUnsubscribeGreeting('"><script>alert("x")</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&quot;');
  });

  it('strips control characters (CRLF / NUL)', () => {
    const out = renderUnsubscribeGreeting('Ada\r\nBcc: evil@x.com\x00');
    expect(out).not.toContain('\r');
    expect(out).not.toContain('\n');
    expect(out).not.toContain('\x00');
    expect(out).toContain('AdaBcc: evil@x.com');
  });

  it('caps greeting names at 80 characters', () => {
    const out = renderUnsubscribeGreeting('A'.repeat(200));
    // "Hi " + 80 A's + ", "
    expect(out).toBe(`Hi ${'A'.repeat(80)}, `);
  });

  it('keeps a normal name intact', () => {
    expect(renderUnsubscribeGreeting('Jordan')).toBe('Hi Jordan, ');
  });
});
