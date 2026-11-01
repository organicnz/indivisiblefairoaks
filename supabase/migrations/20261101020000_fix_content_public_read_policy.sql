-- Migration: 20261101020000_fix_content_public_read_policy.sql
--
-- The public read policy on `content` was broader than the project intends, in
-- two ways that the neighbouring policies make visible:
--
--   1. `OR auth.role() = 'authenticated'` admitted every DRAFT to every
--      signed-in user. The table already carries a second policy, "Admins can
--      read unpublished content" (`is_admin()`), which is dead weight while the
--      public policy answers yes for anybody with a session. Reading a draft is
--      an editor action, and the admin surface reads through the service-role
--      client anyway (`src/lib/actions/content.ts`), so nothing relied on it.
--
--   2. There was no `published_at` gate, so a row marked `status = 'publish'`
--      with a future date was readable before its embargo lifted. Every public
--      query in the app filters that itself via `buildVisibilityFilter()`
--      (`src/lib/queries/content.ts`), which is why this never showed up in the
--      product — but the database boundary disagreed with the app's own
--      definition, and `content_media`'s policy next door already enforces
--      exactly `status = 'publish' AND published_at <= now()`. This makes the
--      two agree instead of leaving one of them as the only guard.
--
-- `assertContentPublished()` in `src/lib/actions/content.ts` states the same
-- rule in code (`status = 'publish'`, `published_at <= now()`), so this is the
-- database catching up to the invariant the application had already written
-- down.
--
-- Admins are unaffected: their own policy still grants them every row,
-- including drafts, and RLS ORs policies together.
--
-- Consequence worth stating accurately: no app path had to change. Every
-- public read already applied this filter itself — `buildVisibilityFilter()` is
-- used by the page bodies, the posts list, search and the sitemap — which is why
-- the gap never surfaced in the product. The database was the one layer that
-- disagreed, and a direct PostgREST call with the publishable key could read a
-- row the site was still withholding.

DROP POLICY IF EXISTS "Public content is viewable by everyone" ON public.content;

CREATE POLICY "Public content is viewable by everyone"
  ON public.content
  FOR SELECT
  TO anon, authenticated
  USING (
    (status)::text = 'publish'::text
    AND (published_at IS NULL OR published_at <= now())
  );
