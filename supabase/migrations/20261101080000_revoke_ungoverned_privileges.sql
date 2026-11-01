-- Migration: 20261101080000_revoke_ungoverned_privileges.sql
--
-- Row-level security governs four privileges: SELECT, INSERT, UPDATE, DELETE.
-- It does not govern these four:
--
--   TRUNCATE    empties the table without consulting a single policy
--   REFERENCES  lets a role build a foreign key onto rows it cannot read
--   TRIGGER     lets a role attach a trigger to the table
--   MAINTAIN    VACUUM / ANALYZE / CLUSTER (Postgres 17)
--
-- Supabase's default privileges in `public` grant all eight to `anon` and
-- `authenticated` on every new table, so the whole schema carried the four
-- ungoverned ones: 20 tables for `anon` and 27 for `authenticated`, measured
-- before this migration. Nothing in this application truncates, references or
-- triggers through PostgREST — which exposes none of those verbs — so the
-- grants bought nothing and left the one protection a policy count cannot
-- restore.
--
-- `search_rate_limit` was the first table where this mattered, and
-- 20261101070000 had to revoke rather than add a policy. This is that fix
-- applied to the class rather than the instance, plus the default privileges so
-- a table created next month does not reintroduce it.
--
-- What is deliberately NOT revoked: SELECT, INSERT, UPDATE, DELETE. Those are
-- the application's actual read and write surface, and RLS is what governs
-- them per row. Narrowing them here would break the site, not harden it.
--
-- A malformed row can only be checked, not prevented: a table created by
-- `supabase_admin` (for example from the dashboard) gets that role's defaults,
-- which this migration cannot alter as `postgres`. `scripts/check-schema-hygiene.mjs`
-- reports it, which is the right half of the control to have.

DO $$
DECLARE
  relation record;
BEGIN
  FOR relation IN
    SELECT c.oid::regclass AS name
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE %s FROM anon, authenticated',
      relation.name
    );
  END LOOP;
END
$$;

-- Future tables owned by `postgres`, which is what the migration flow creates.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM anon, authenticated;
