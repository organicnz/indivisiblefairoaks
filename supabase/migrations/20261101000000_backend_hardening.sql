-- Backend hardening.
--
-- Audited against the live project on 2026-11-01. Each section below records the
-- finding it closes, because none of these is visible from reading a single
-- function: they are properties of the deployed ACLs and bucket config.
--
-- Every statement is idempotent — safe to re-apply.
--
-- ─── 1. SECURITY DEFINER functions with no pinned search_path ───────────────
--
-- A SECURITY DEFINER function runs with its owner's privileges. With no pinned
-- search_path, a caller can prepend a schema of their own to search_path and
-- substitute an object the function resolves unqualified. `log_audit` was the
-- sharp one: SECURITY DEFINER, executable by `anon`, and it writes audit rows.
--
-- All three are public-schema-only and call nothing that lives elsewhere.
alter function public.log_audit(uuid, text, text, text, jsonb, text, text)
  set search_path = public, pg_temp;
alter function public.get_user_org_id()
  set search_path = public, pg_temp;
alter function public.is_service_role()
  set search_path = public, pg_temp;

-- ─── 2. EXECUTE grants ──────────────────────────────────────────────────────
--
-- Postgres grants EXECUTE on a new function to PUBLIC, and Supabase's default
-- privileges add explicit grants to anon, authenticated and service_role. So a
-- revoke must name all three: revoking from `anon` alone leaves the PUBLIC grant
-- in place and the function still callable. Verified before writing this:
-- every proc below carried `{=X/postgres, postgres=X, anon=X, authenticated=X,
-- service_role=X}`.
--
-- Triggers do not consult EXECUTE grants, so the trigger functions below keep
-- firing exactly as before; only a direct RPC call is removed.

-- Audit writing: the function has no caller in this repository, and an
-- anonymous caller could forge audit rows for any actor.
revoke execute on function public.log_audit(uuid, text, text, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.log_audit(uuid, text, text, text, jsonb, text, text)
  to service_role;

-- Maintenance. Both are driven by pg_cron, which runs as the job owner
-- (`postgres`), so removing the API-facing grants changes nothing operationally.
revoke execute on function public.cleanup_old_audit_logs()
  from public, anon, authenticated;
grant execute on function public.cleanup_old_audit_logs() to service_role;

revoke execute on function public.move_to_dlq()
  from public, anon, authenticated;
grant execute on function public.move_to_dlq() to service_role;

-- Stock mutation is server-side only. Checkout is provider-agnostic and no
-- application code calls this function; leaving it anon-executable let anyone
-- zero a product's inventory by id.
revoke execute on function public.decrement_stock(integer, integer)
  from public, anon, authenticated;
grant execute on function public.decrement_stock(integer, integer) to service_role;

-- Trigger functions. Nothing should be able to invoke these directly, and none
-- is ever called that way. Triggers are unaffected by the revoke.
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.notify_contact_submission()
  from public, anon, authenticated;
revoke execute on function public.fn_sync_contact_submission_to_crm()
  from public, anon, authenticated;
revoke execute on function public.fn_sync_order_to_crm()
  from public, anon, authenticated;
revoke execute on function public.fn_sync_profile_to_crm()
  from public, anon, authenticated;
revoke execute on function public.record_content_revision()
  from public, anon, authenticated;
revoke execute on function public.block_profiles_priv_esc()
  from public, anon, authenticated;

-- Rate-limit triggers. These read a count and raise on excess; exposing them as
-- RPC let an anonymous caller burn through another address's window or probe the
-- flood thresholds directly.
revoke execute on function public.check_contact_submission_flood()
  from public, anon, authenticated;
revoke execute on function public.check_crm_email_flood()
  from public, anon, authenticated;
revoke execute on function public.check_error_report_flood()
  from public, anon, authenticated;

-- ─── 3. Avatar uploads ─────────────────────────────────────────────────────
--
-- The bucket was public and accepted an INSERT from any role with no size limit,
-- no MIME allowlist and no path constraint — an open image host tied to the
-- project's domain. Reading stays public (avatars are rendered in the app); the
-- upload policy now requires an authenticated user writing under their own
-- `auth.uid()/` prefix, which is what every other per-user bucket here does.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'avatars';

drop policy if exists "Anyone can upload an avatar." on storage.objects;

create policy "Users upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 4. Foreign keys with no supporting index ──────────────────────────────
--
-- Postgres indexes a foreign key's target, never its source. Every DELETE or
-- UPDATE on the referenced row then scans the child table. `order_items` is the
-- one that matters commercially: a product row cannot be removed or its id
-- changed without a full scan of every line item ever sold.
create index if not exists content_revisions_created_by_idx
  on public.content_revisions (created_by);

create index if not exists crm_activities_created_by_idx
  on public.crm_activities (created_by);
create index if not exists crm_broadcasts_created_by_idx
  on public.crm_broadcasts (created_by);
create index if not exists crm_broadcasts_marked_failed_by_idx
  on public.crm_broadcasts (marked_failed_by);
create index if not exists crm_tasks_created_by_idx
  on public.crm_tasks (created_by);

create index if not exists order_items_order_id_idx
  on public.order_items (order_id);
create index if not exists order_items_product_id_idx
  on public.order_items (product_id);

create index if not exists product_categories_category_id_idx
  on public.product_categories (category_id);
create index if not exists product_variations_product_id_idx
  on public.product_variations (product_id);
