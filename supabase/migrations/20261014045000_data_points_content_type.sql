-- Add the content_type column that the data_points seed migrations have
-- referenced since 20261014050000, but that no migration ever created.
--
-- Every seed from 20261014050000 onward writes it in the INSERT column list
-- (and several set `content_type = EXCLUDED.content_type` on conflict), while
-- the table was created in 20261014020000 without it. On a project where the
-- seeds have already been applied, the column exists only because it was added
-- out of band; on a fresh database the first such seed cannot apply at all.
--
-- Numbered BETWEEN the table's creation (20261014020000) and the first seed
-- that writes the column (20261014050000) so both a fresh `db reset` and a
-- `supabase db push` see it in the right order — the hosted project's last
-- recorded version is 20261014000000, so this is not an out-of-order insert.
--
-- IF NOT EXISTS keeps it idempotent for any project where the column already
-- exists. The default matches the value every seed passes explicitly, so the
-- four-column seeds that omit it do not leave their rows distinguishable from
-- the rest.

ALTER TABLE public.data_points
  ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text';
