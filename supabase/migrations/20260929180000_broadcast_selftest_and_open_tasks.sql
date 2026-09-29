-- ═══════════════════════════════════════════════════════════════════════════
-- Self-test broadcasts, and follow-ups that belong to no one
--
-- Two small gaps, both about the CRM refusing to model things volunteers
-- actually do.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. A preview send, addressed to the author ──────────────────────────────
-- "Send a test" is the difference between guessing and knowing how an email
-- looks, but a test button that takes a recipient is one typo from mailing the
-- whole chapter. So the address is not an input: the server writes the signed-in
-- admin here, and the sender treats this column as the entire audience and
-- ignores `target_*`. The narrowing therefore lives where recipients are
-- resolved, and cannot be bypassed by anything written from the client.
ALTER TABLE public.crm_broadcasts
    ADD COLUMN IF NOT EXISTS test_recipient TEXT;

-- Marks the row so the history view can label it and a later reader can tell a
-- preview from a real blast. Always consistent with `test_recipient` being set.
ALTER TABLE public.crm_broadcasts
    ADD COLUMN IF NOT EXISTS test_only BOOLEAN NOT NULL DEFAULT FALSE;

-- A test send has no audience filters, so an index that excluded tests would
-- make the two histories interleave confusingly. One index, both states.
DROP INDEX IF EXISTS public.crm_broadcasts_recent_idx;
CREATE INDEX IF NOT EXISTS crm_broadcasts_recent_idx
    ON public.crm_broadcasts (created_at DESC)
    WHERE status <> 'draft';

COMMENT ON COLUMN public.crm_broadcasts.test_recipient IS
    'When set, the sole recipient. The sender ignores target_* and sends only here.';
COMMENT ON COLUMN public.crm_broadcasts.test_only IS
    'A preview to the author. Excluded from audience statistics, never a real blast.';

-- A test recipient must be a real, single address. The column is written only
-- by the server, but the constraint is what makes a malformed value impossible
-- rather than merely unlikely — and it stops a stray multi-address string from
-- becoming a mailing list.
ALTER TABLE public.crm_broadcasts
    ADD CONSTRAINT crm_broadcasts_test_recipient_email
    CHECK (test_recipient IS NULL OR test_recipient ~ '^[^@[:space:],]+@[^@[:space:],]+\.[^@[:space:],]+$');

-- ── 2. Follow-ups that do not belong to a constituent ───────────────────────
-- `crm_tasks.contact_id` was NOT NULL, so a follow-up could only exist as an
-- attribute of a contact. That excludes the work a chapter actually tracks:
-- "call the county clerk", "chase the AV rental", "confirm the venue". The
-- board showed an empty state telling the author to add one from a profile,
-- which is no route at all to the tasks that are not about a person.
ALTER TABLE public.crm_tasks
    ALTER COLUMN contact_id DROP NOT NULL;

-- The board's hot path: open tasks ordered by due date across all contacts,
-- with unattached tasks included. The old partial index was written for a
-- contact-scoped query and does not serve this.
DROP INDEX IF EXISTS public.idx_crm_tasks_open_due;
CREATE INDEX IF NOT EXISTS idx_crm_tasks_open_due
    ON public.crm_tasks (due_at ASC NULLS LAST, created_at DESC)
    WHERE status = 'open';

COMMENT ON COLUMN public.crm_tasks.contact_id IS
    'NULL for an organisational follow-up that belongs to no constituent.';
