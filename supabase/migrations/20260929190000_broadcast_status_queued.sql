-- ═══════════════════════════════════════════════════════════════════════════
-- Allow 'queued', which the broadcast path has always written
--
-- `crm_broadcasts.status` is CHECK-constrained to
-- ('draft','sending','sent','failed'). The send path inserts 'queued' and the
-- Edge Function refuses to run against anything that is not 'queued', so the
-- two halves of the feature disagreed on the value that means "accepted, not yet
-- delivered".
--
-- The consequence was silent and total: the insert failed the constraint, so
-- `sendCRMBroadcast` returned "Failed to create broadcast log" and no broadcast
-- had ever gone out. It was masked because the sender was not configured on the
-- deployment, which surfaced a different error first.
--
-- A CHECK that disagrees with the code is not a constraint, it is a trap: unit
-- tests mock the client and never see it, and it only appears when a real row is
-- written. The states below are the ones the two sides actually agree on.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.crm_broadcasts
    DROP CONSTRAINT IF EXISTS crm_broadcasts_status_check;

ALTER TABLE public.crm_broadcasts
    ADD CONSTRAINT crm_broadcasts_status_check
    CHECK (status IN ('draft', 'queued', 'sending', 'sent', 'failed'));

COMMENT ON COLUMN public.crm_broadcasts.status IS
    'draft → queued (accepted, awaiting the sender) → sending → sent | failed.';
