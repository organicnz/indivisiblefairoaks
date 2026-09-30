-- ═══════════════════════════════════════════════════════════════════════════
-- Give `crm_broadcasts` an `updated_at`, and re-apply the touch trigger
-- ═══════════════════════════════════════════════════════════════════════════

-- Split out of 20260930120000 rather than added there, because migrations are
-- append-only: a file that has been committed and may already be applied to a
-- project cannot be edited to carry a new change. Same `touch_updated_at()`
-- function, introduced alongside the `crm_contacts` / `crm_tasks` triggers.
--
-- `crm_broadcasts` is the third table that had `DEFAULT now()` and no trigger,
-- and it matters most of the three. `saveCRMBroadcastDraft` is an upsert — the
-- same draft edited twice in a week is one row — so before this column the
-- chapter could not tell when a draft was last touched, and "Unsent drafts" has
-- nothing to order by. `created_at` would sort a draft edited this morning
-- below one composed last month and untouched since.
--
-- Ordering is deliberately `updated_at DESC`, not `created_at DESC`. The
-- resumable draft is the most recently *worked on*, not the most recently
-- started.
ALTER TABLE public.crm_broadcasts
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.crm_broadcasts.updated_at IS
    'Last write to the row. Set by the touch_updated_at() trigger. Distinguishes a draft edited this morning from one composed last month and untouched since.';

-- Backfill before the NOT NULL, from created_at, so existing rows read as "never
-- touched after creation" rather than as NULL or as now.
UPDATE public.crm_broadcasts SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE public.crm_broadcasts
    ALTER COLUMN updated_at SET DEFAULT now(),
    ALTER COLUMN updated_at SET NOT NULL;

-- Serves `getCRMBroadcastDrafts()`. Small table, but the read is on every
-- composer load and the column is now what it orders by.
CREATE INDEX IF NOT EXISTS crm_broadcasts_updated_at_idx
    ON public.crm_broadcasts (updated_at DESC);

DROP TRIGGER IF EXISTS crm_broadcasts_touch_updated_at ON public.crm_broadcasts;
CREATE TRIGGER crm_broadcasts_touch_updated_at
    BEFORE UPDATE ON public.crm_broadcasts
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
