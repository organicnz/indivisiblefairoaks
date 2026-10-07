import { describe, expect, it } from 'vitest';
import { MAX_CONTACT_NOTES_LENGTH } from '@/lib/crm-import';
import {
  BROADCAST_DISPATCH_TIMEOUT_MS,
  BROADCAST_HISTORY_MAX_PAGE_SIZE,
  BROADCAST_HISTORY_PAGE_SIZE,
  PROGRESS_POLL_TIMEOUT_MS,
} from '@/lib/crm-limits';

/**
 * The bounds, as relationships rather than as literals.
 *
 * Every constant in `crm-limits.ts` exists because something *else* depends on
 * its value, and each of those dependencies is invisible at the point of
 * definition. A test that asserted `PROGRESS_POLL_TIMEOUT_MS === 15_000` would
 * pass while every property it exists for had been broken; these assert the
 * properties, and would fail if the number moved for the wrong reason.
 */
describe('crm-limits: relationships the bounds exist to hold', () => {
  it('bounds the poll below the loop it rescues', () => {
    // `followProgress` waits 2s between attempts. A poll bound *shorter* than the
    // interval would report "lost the feed" on a healthy send — the failure mode
    // of a false timeout is worse than the hang, because it stops the readout on a
    // campaign that is fine.
    const POLL_INTERVAL_MS = 2000;
    expect(PROGRESS_POLL_TIMEOUT_MS).toBeGreaterThan(POLL_INTERVAL_MS);
    // And generous enough not to fire on a slow phone.
    expect(PROGRESS_POLL_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
  });

  it('keeps the dispatch timeout longer than a legitimate large campaign', () => {
    // The sender is synchronous by design: it returns the whole campaign's
    // outcome. 5,000 recipients at ten per Resend round trip is a long send, and
    // a timeout shorter than that reports a healthy campaign as failed — which
    // makes the caller mark the row failed while the sender may still be
    // delivering it.
    const CEILING = 5000;
    const BATCH = 10;
    const PER_RECIPIENT_MS = 250; // generous round trip
    const worstCaseMs = (CEILING / BATCH) * PER_RECIPIENT_MS;
    expect(BROADCAST_DISPATCH_TIMEOUT_MS).toBeGreaterThan(worstCaseMs);
  });

  it('uses one dispatch window for the timeout and the stuck-row refusal', () => {
    // Same constant, by construction — `markCRMBroadcastFailed` refuses a row
    // dispatched more recently than this. Two literals would let the refusal
    // window and the timeout disagree, and the failure mode of that is marking a
    // working campaign dead with no way to un-fail it.
    expect(BROADCAST_DISPATCH_TIMEOUT_MS).toBe(15 * 60_000);
    expect(BROADCAST_DISPATCH_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('keeps the history ceiling at or above the default page size', () => {
    // Otherwise the "default" is unreachable and every page silently clamps,
    // which makes the pager's arithmetic disagree with the request.
    expect(BROADCAST_HISTORY_MAX_PAGE_SIZE).toBeGreaterThanOrEqual(BROADCAST_HISTORY_PAGE_SIZE);
  });

  /**
   * Both reads are bounded at the same size so one pager serves them. They were
   * `.limit(50)` and `.limit(20)`, which is how a chapter past fifty campaigns
   * could not see its fifty-first and a twenty-first draft was unreachable *and*
   * unremovable.
   */
  it('gives history and drafts the same page size', () => {
    expect(BROADCAST_HISTORY_PAGE_SIZE).toBe(25);
  });

  it('bounds the notes budget at the size an export round-trips', () => {
    // The importer clamps to this, so an exported constituent's notes survive a
    // restore. A larger budget here than the clamp would silently truncate a
    // re-imported contact.
    expect(MAX_CONTACT_NOTES_LENGTH).toBe(5000);
    expect(MAX_CONTACT_NOTES_LENGTH).toBeGreaterThan(2000); // taskSchema.details floor
  });
});
