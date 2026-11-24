-- Migration: 20261123150000_revoke_ungoverned_crm_email_grants.sql
--
-- The last of the seven schema-hygiene findings.
--
-- `20261123130000_schema_hygiene_indexes_and_grants.sql` closed six, including
-- the four ungoverned privileges on `crm_broadcast_recipients`. A second table
-- created after `20261101080000` carries the same shape:
-- `20261120120000_crm_direct_email_sends.sql` ends with
-- `GRANT ALL ON public.crm_direct_email_sends TO authenticated, service_role`,
-- so `authenticated` holds MAINTAIN, REFERENCES, TRIGGER and TRUNCATE as well.
--
-- Row-level security governs SELECT, INSERT, UPDATE and DELETE. It governs none
-- of those four: TRUNCATE empties a table while every policy still evaluates
-- true, and TRIGGER lets a caller attach behaviour the policy never sees. The
-- application reaches PostgREST, which exposes none of those verbs, so the
-- privileges are pure surface with no caller relying on them.
--
-- Revoked from `anon` as well, for the same reason and to keep the two roles
-- in step — `anon` had already been stripped of everything by the REVOKE ALL
-- in the creating migration, so this is a no-op there rather than a change.
--
-- The four RLS-governed verbs stay granted to `authenticated`, and
-- service_role is untouched: it bypasses RLS by design and the Edge sender
-- uses it. `crm_email_delivered_events` is not named here because it was
-- created without a table-level grant at all.

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE
  ON public.crm_direct_email_sends
  FROM anon, authenticated;

COMMENT ON TABLE public.crm_direct_email_sends IS
  'Per-message ledger for CRM direct email. One row per recipient per send, settled by Resend delivery events. Authenticated admins hold only the RLS-governed DML privileges.';
