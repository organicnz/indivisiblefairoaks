import { describe, expect, it } from 'vitest';
import { isInAudience as isInAudienceApp } from '@/lib/crm-filters';
import { isInAudience as isInAudienceEdge } from '../../../supabase/functions/_shared/broadcast';

/**
 * The audience rule, in both places it is expressed.
 *
 * Broadcasts reach exactly the contacts who were asked and agreed:
 * `do_not_email === false`. `true` was asked and declined; `null` was never
 * asked. The Next resolver (`resolveBroadcastRecipients`) and the Edge
 * delivery loop (`crm-broadcast-send`) each carry the SQL predicate
 * `.eq('do_not_email', false)` plus a row-level re-filter, so loosening one
 * query cannot silently re-add opted-out or never-asked contacts. This test
 * pins the row-level half on both sides — and that the two copies agree, since
 * Deno cannot import from `src/` and the duplication is structural.
 */
describe('isInAudience agrees between the app and the edge copy', () => {
  it.each([
    { value: false, expected: true, label: 'asked and agreed' },
    { value: true, expected: false, label: 'asked and declined' },
    { value: null, expected: false, label: 'never asked' },
  ])('$label ($value) -> $expected', ({ value, expected }) => {
    expect(isInAudienceApp(value)).toBe(expected);
    expect(isInAudienceEdge(value)).toBe(expected);
  });
});
