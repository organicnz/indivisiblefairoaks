/**
 * The chapter's ActBlue contribution page.
 *
 * Indivisible's distributed-fundraising program supplies this hosted page; it
 * cannot make an embeddable ActBlue form, and the standard page sends
 * `frame-ancestors 'none'`. Donations therefore finish on ActBlue. Link
 * parameters are the supported way to carry the donor's choice into that
 * hosted flow.
 */
export const ACTBLUE_DONATION_URL =
  'https://secure.actblue.com/donate/indivisiblefoc1432155925';

/** Distinguishes the calculator hand-off from other website links in ActBlue. */
export const ACTBLUE_WEBSITE_REFCODE = 'website-donate';

export const ACTBLUE_MIN_DONATION = 5;

/**
 * The contribution limit configured on the chapter's ActBlue form
 * (`contribution_limit: 2000000` cents). Keeping the calculator inside it
 * prevents a link that ActBlue will reject after the donor has already left.
 */
export const ACTBLUE_MAX_DONATION = 20_000;

/** Match the hosted form's amount buttons to the calculator's choices. */
export const ACTBLUE_PRESET_DONATION_AMOUNTS = [5, 10, 25, 50, 100, 250] as const;

/**
 * ActBlue accepts whole-dollar amounts. Clamp instead of emitting an invalid
 * link when somebody types a decimal, a negative number, or an out-of-range
 * value into the custom-amount field.
 */
export function normalizeDonationAmount(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(numeric)) return ACTBLUE_MIN_DONATION;
  return Math.min(ACTBLUE_MAX_DONATION, Math.max(ACTBLUE_MIN_DONATION, Math.round(numeric)));
}

/**
 * Build the documented ActBlue deep link.
 *
 * `amount` pre-selects an amount (or fills the other-amount box), `amounts`
 * exposes the same preset buttons on the hosted form, and `recurring=true`
 * selects the unlimited recurring option. `recurring=1` is not used because
 * ActBlue reads a number as a fixed duration, not as “repeat indefinitely”.
 */
export function buildActBlueDonationUrl(
  amount: number,
  monthly: boolean,
  base = ACTBLUE_DONATION_URL
): string {
  const params = new URLSearchParams();
  params.set('amount', String(normalizeDonationAmount(amount)));
  params.set('amounts', ACTBLUE_PRESET_DONATION_AMOUNTS.join(','));
  params.set('refcode', ACTBLUE_WEBSITE_REFCODE);
  if (monthly) params.set('recurring', 'true');

  return `${base}?${params.toString()}`;
}
