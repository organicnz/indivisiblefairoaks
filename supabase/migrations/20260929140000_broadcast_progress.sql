-- ═══════════════════════════════════════════════════════════════════════════
-- Broadcast progress + attribution
--
-- Moving the broadcast send off the request path needs somewhere to record how
-- far it has got. `crm_broadcasts` previously had only a final `failed_count`
-- and a `status` that was written as 'sending' *before* delivery began and
-- never corrected on an abort, so an interrupted send sat at 'sending' forever
-- with no way to tell how much had actually gone out.
-- ═══════════════════════════════════════════════════════════════════════════

-- Messages accepted by the provider so far. Updated in batches by the sender so
-- the composer's poll has real progress to show rather than a spinner.
ALTER TABLE public.crm_broadcasts
    ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0;

-- An idempotency key. A retried dispatch for the same broadcast must not send
-- twice; the sender refuses to run against a row that already has one.
ALTER TABLE public.crm_broadcasts
    ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

-- Who sent it. `crm_broadcasts` was the only admin-writable table in the CRM
-- with no `created_by`, so a blast had no attributable author.
ALTER TABLE public.crm_broadcasts
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- A broadcast that never left 'draft' is not history, it is an abandoned
-- compose. Excluding it from the composer's history table keeps the list
-- meaningful without deleting anything.
CREATE INDEX IF NOT EXISTS crm_broadcasts_recent_idx
    ON public.crm_broadcasts (created_at DESC)
    WHERE status <> 'draft';

COMMENT ON COLUMN public.crm_broadcasts.sent_count IS
    'Messages accepted by the delivery provider. Progress, not a delivery guarantee.';
COMMENT ON COLUMN public.crm_broadcasts.dispatched_at IS
    'Set by the sender on first run; a second dispatch against the same value is refused.';
