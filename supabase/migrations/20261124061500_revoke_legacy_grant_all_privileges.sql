-- Migration: 20261124061500_revoke_legacy_grant_all_privileges.sql
--
-- Brings the migration text back in line with the hosted database.
--
-- ## What drifted
--
-- Thirteen tables were created with
-- `GRANT ALL ON public.<table> TO authenticated, service_role` before
-- 20261101080000_schema_hygiene_indexes_and_grants.sql revoked the four
-- privileges row-level security cannot govern. The hosted project does not
-- carry them — `information_schema.role_table_grants` shows `authenticated`
-- holding only SELECT, INSERT, UPDATE and DELETE — but the migrations still
-- grant them, so `scripts/check-migration-schema-invariants.mjs` sees a
-- thirteen-finding violation on an empty base and any environment rebuilt
-- from these files would be born with privileges production does not have.
--
-- The list is exactly what the guard reports against the final migration
-- state, which is why it is written out rather than derived: this is a
-- point-in-time repair of tables created over two months, and a query here
-- would be a second source of truth that could drift again.
--
-- ## Why these four
--
-- RLS filters rows for SELECT, INSERT, UPDATE and DELETE. It filters none of
-- these: TRUNCATE empties a table while every policy still evaluates true,
-- TRIGGER lets a caller attach behaviour the policy never sees, REFERENCES
-- permits foreign keys onto a table the role cannot read, and MAINTAIN is
-- VACUUM/ANALYZE/REINDEX/CLUSTER. The application reaches PostgREST, which
-- exposes none of them, so no caller depends on any of the four.
--
-- ## Why now and why it is safe
--
-- Every statement is a no-op on the hosted database today: the privileges are
-- already absent there, so this records a decision rather than changing one.
-- It is safe on a fresh environment for the same reason — the objects exist
-- by the time this runs, and `REVOKE` of an unheld privilege succeeds.
--
-- `service_role` is deliberately not named. It bypasses RLS by design and the
-- Edge functions use it; the invariant is about roles that RLS is supposed to
-- govern, and `service_role` is not one of them.
--
-- The four DML verbs stay granted to `authenticated`, and each table's policy
-- still decides which rows those verbs reach.

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.crm_contacts FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.crm_activities FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.crm_broadcasts FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.crm_tasks FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.crm_segments FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.content_revisions FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.crm_email_events FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.events FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.newsletters FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.faqs FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.data_points FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.partners FROM anon, authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.coalition_links FROM anon, authenticated;
