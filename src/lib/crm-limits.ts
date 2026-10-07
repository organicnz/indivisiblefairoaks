/**
 * Numeric bounds for the CRM, in one module.
 *
 * ## Why this file exists
 *
 * These were constants inside `src/lib/actions/crm.ts` — and that file is
 * `'use server'`, which **may only export async functions**. Next's build rejects
 * a `'use server'` module whose exports are not all async:
 *
 * ```
 * Error: Only async functions are allowed to be exported in a "use server" file.
 * ```
 *
 * So a constant or a helper that a client component needs cannot live beside the
 * actions it describes. Three of these did:
 *
 *   - `PROGRESS_POLL_TIMEOUT_MS` — read by `CRMBroadcastComposer` to bound its
 *     poll loop.
 *   - `BROADCAST_DISPATCH_TIMEOUT_MS` — the same window the "is this campaign
 *     genuinely stuck?" refusal uses, so the two cannot drift.
 *   - `MAX_CONTACT_NOTES_LENGTH` — the editor's `maxLength` counter has to agree
 *     with the server's cap, or a volunteer types past a limit they cannot see
 *     and is told "notes too long" by a server that disagrees with their screen.
 *
 * Two constants of one value is how those come to disagree, which is why the
 * client's copy is an import rather than a literal.
 *
 * Nothing here reads `process.env`, so it is safe in a client bundle.
 *
 * `MAX_CONTACT_NOTES_LENGTH` is the exception and lives in `crm-import.ts`
 * instead — next to the clamp that uses it. That module is a pure parser with no
 * `'use server'` directive, so it *can* export a constant, and putting the budget
 * beside the code that enforces it keeps the importer's copy and the schema's copy
 * in the same import statement.
 *
 * Both files are in `vitest.config.ts`'s `include` list and carry the global 90%
 * threshold, because every number here is a claim about what the UI will accept
 * and a silent drift turns into a server-side rejection the user cannot see.
 */

/**
 * How long a single progress poll may take before the composer stops waiting.
 *
 * Generous — a poll is one indexed read of one row — because a false timeout
 * ends the readout while the send is fine. But it must exist: without it a hung
 * request freezes the poll loop, and the loop's only exit is a `catch` that a
 * hang never reaches. Two seconds' poll interval plus this bound is what makes
 * "still sending" and "we lost the feed" distinguishable states.
 */
export const PROGRESS_POLL_TIMEOUT_MS = 15_000;

/**
 * How long to wait for the sender before treating the dispatch as failed, and
 * the window inside which a row is presumed healthy.
 *
 * Long, because the function is synchronous by design: it returns the delivery
 * outcome of the whole campaign, and the worst legitimate case is 5,000
 * recipients at ten per Resend round trip. Shorter than that and a healthy large
 * campaign is reported as a failure — which is worse than the hang, because the
 * caller marks the row `failed` and the chapter believes nothing was sent when
 * in fact the sender may still be delivering it.
 *
 * This is a *hang* detector, not a performance target.
 *
 * Shared with `markCRMBroadcastFailed`, which refuses a row dispatched more
 * recently than this. Two literals would let the refusal window and the timeout
 * disagree, and the failure mode of that is marking a working campaign dead.
 */
export const BROADCAST_DISPATCH_TIMEOUT_MS = 15 * 60_000;

/**
 * Campaign history page size, and the ceiling a caller may ask for.
 *
 * History and drafts were `.limit(50)` and `.limit(20)` with no pager, so a
 * chapter past fifty campaigns could not reach its fifty-first and a twenty-first
 * draft was unreachable *and* unremovable — the failure mode
 * `deleteCRMBroadcastDraft`'s own comment records for one row, at the scale of a
 * whole list. Both reads now share a size so one pager serves them, and the
 * ceiling stops a caller asking for the whole table through a URL parameter.
 */
export const BROADCAST_HISTORY_PAGE_SIZE = 25;

/**
 * Clamp for `pageSize` on the paged history read.
 *
 * `BROADCAST_HISTORY_PAGE_SIZE` is the default, not the maximum: a pager asks
 * for its own size, and a URL can ask for anything.
 */
export const BROADCAST_HISTORY_MAX_PAGE_SIZE = 100;

/**
 * Hard cap on a single CSV export.
 *
 * The export is the only CRM read that builds the entire result in the Next
 * server's memory as one string, so it cannot be unbounded the way the paged
 * reads are. This is a resource limit, not a product decision — no chapter is
 * expected to hit it.
 *
 * Its value matters less than the fact that exceeding it is *reported*.
 * `exportCRMContacts` returns `truncated`, `count` (rows in the file) and
 * `matchedCount` (rows the filter matched), and the composer renders the
 * difference. A cap that truncates silently produces a file indistinguishable from
 * a complete one — re-importable, plausible, and missing rows — and this is the
 * one export a chapter takes off-platform, so the failure would not surface until
 * somebody tried to restore it.
 */
export const CRM_EXPORT_LIMIT = 10_000;

/**
 * Ceiling on the full-table tag scan behind `getCRMExistingTags`.
 *
 * Postgres cannot return distinct elements of an array column, so the tag list
 * powering the filter and composer chips is built by paging the whole directory
 * on every CRM page load. Twenty round trips of a thousand rows is a lot to spend
 * on a dropdown, and this caps it.
 *
 * Like `CRM_EXPORT_LIMIT`, it is only safe because hitting it is reported:
 * `getCRMExistingTags` returns `truncated` alongside the tags, and both call
 * sites render it. A partial tag list means a tag held only by unscanned rows has
 * no chip — so a chapter cannot target those constituents at all, and concludes
 * from an empty chip that the tag does not exist.
 *
 * `.order('id')` in the scan is what makes paging coherent at all; see the
 * function's own comment.
 */
export const TAG_SCAN_LIMIT = 20_000;
