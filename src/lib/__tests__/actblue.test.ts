// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  ACTBLUE_DONATION_URL,
  ACTBLUE_MAX_DONATION,
  ACTBLUE_MIN_DONATION,
  buildActBlueDonationUrl,
  normalizeDonationAmount,
} from '../actblue';

describe('ActBlue donation links', () => {
  it('carries the chosen amount, matching preset buttons, and website refcode', () => {
    const url = new URL(buildActBlueDonationUrl(50, false));

    expect(`${url.origin}${url.pathname}`).toBe(ACTBLUE_DONATION_URL);
    expect(url.searchParams.get('amount')).toBe('50');
    expect(url.searchParams.get('amounts')).toBe('5,10,25,50,100,250');
    expect(url.searchParams.get('refcode')).toBe('website-donate');
    expect(url.searchParams.get('recurring')).toBeNull();
  });

  it('uses unlimited recurring, not ActBlue’s fixed-duration number', () => {
    const url = new URL(buildActBlueDonationUrl(50, true));

    expect(url.searchParams.get('recurring')).toBe('true');
    expect(url.searchParams.get('recurring')).not.toBe('1');
  });

  it('keeps custom amounts whole and inside the hosted form’s contribution limit', () => {
    expect(normalizeDonationAmount(3)).toBe(ACTBLUE_MIN_DONATION);
    expect(normalizeDonationAmount(50.6)).toBe(51);
    expect(normalizeDonationAmount(ACTBLUE_MAX_DONATION + 1)).toBe(ACTBLUE_MAX_DONATION);
    expect(normalizeDonationAmount('75')).toBe(75);
    expect(normalizeDonationAmount('nonsense')).toBe(ACTBLUE_MIN_DONATION);

    const amount = new URL(buildActBlueDonationUrl(ACTBLUE_MAX_DONATION + 1, false)).searchParams;
    expect(amount.get('amount')).toBe(String(ACTBLUE_MAX_DONATION));
  });
});
