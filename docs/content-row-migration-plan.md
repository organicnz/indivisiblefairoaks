# Content row migration plan

> Status: badge and filter shipped. Read-only audit complete on 2026-11-08;
> **no rows were changed**. Archiving or deleting still needs a content-owner
> decision.

`content` holds 15 rows. Fourteen cannot be reached at their own slug:

- **10 are legacy Google Sites paths** with a permanent redirect in
  `src/config/legacy-redirects.ts`.
- **4 are shadowed by coded App Router pages** in `src/lib/content.ts`
  (`RESERVED_SLUGS`).

Only `copy-home-hero` is live — it renders inside `/`, not at its own path.

The save bug is fixed independently: `saveContent` now reads the stored slug
before `assertSlugAvailable`, so these rows can be edited without renaming
them. That makes them **saveable again, not reachable**. Renaming one would
publish a second copy of old copy at a new URL, which is the opposite of the
fix.

## Reachability and overlap

Overlap is the share of 5-word shingles from the row's visible text that also
appear in the destination page's visible text, measured against production on
2026-11-08. Low overlap means the destination was rewritten rather than copied
from the row.

| Row | Type | Chars | Destination | Overlap | Notes |
|---|---|---:|---|---:|---|
| `home` | page | 2,233 | `/` | 8% | Old Google Sites chrome; the row's mission statement is not on `/`. |
| `about-us` | page | 182 | `/about` | 0% | Only 22 shingles — too short to read much into 0%. |
| `upcoming-events` | event | 5,233 | `/events` | 0% | Old event listings; the live page has its own programme. |
| `good-trouble` | event | 795 | `/news` | 0% | Old campaign page. |
| `weekend-of-protest-song` | event | 756 | `/choir` | 0% | Old event page. |
| `upcoming-fall-events` | event | 2,607 | `/events` | 3% | Duplicate of the old events import. |
| `resistance-choir` | page | 1,484 | `/choir` | 1% | Old choir page. |
| `voter-information` | page | 1,119 | `/voter-info` | 0% | Old counterpart of the coded voter page. |
| `newsletters` | post | 781 | `/news` | 0% | Old newsletter index. |
| `coalition-links` | page | 1,518 | `/links` | 7% | Shared organisation names only. |
| `privacy-policy` | page | 1,160 | `/privacy-policy` | 9% | Generic legal phrasing; the coded policy was rewritten. |
| `terms-and-conditions` | page | 1,019 | `/terms-and-conditions` | 0% | Coded terms were rewritten. |
| `shipping-returns` | page | 780 | `/shipping-returns` → `/` | 0% | **No route and no redirect target of its own**; the slug is reserved but the page sends visitors home. |
| `faqs` | page | 990 | `/faqs` | 3% | Coded FAQ page; old answers are not used. |

All 14 bodies still contain the old Google Sites navigation text
("Search this site", "Embedded Files", "Skip to main content"), which is
evidence they are imports rather than authored CMS copy.

## What this means

- **No coded page depends on these rows.** The live copy is in the route
  components, not in `content`.
- **The legacy rows are doing their job as redirects' leftovers.** The 301s in
  `next.config.ts` preserve old links; the rows themselves are not what those
  links land on.
- **Three places may still hold unique content a person should read before
  archiving**: the mission statement in `home`, the shipping/returns policy in
  `shipping-returns` (the only copy of it), and the old FAQ/legal answers. Do
  not assume "0% overlap" means "nothing worth keeping" — it means "not on the
  current page".

## Recommended sequence

1. **Content-owner review.** Read the five rows above (`home`, `faqs`,
   `privacy-policy`, `shipping-returns`, `terms-and-conditions`) and mark any
   sentence that must survive.
2. **Move wanted copy into a live surface.** Use a **copy region** on the
   coded page (`copy-events-trainings` is the existing example) or a new CMS
   page with a free slug. Do not reuse the shadowed slug.
3. **Archive the rest in the admin UI.** The list now marks every unreachable
   row with an **Unreachable** badge and a banner, and offers a server-side
   **Hide unreachable** filter so the page count and pager stay correct; while
   active it reports how many matching rows are hidden. Both use the existing
   `describeSlugConflict` / `isLegacySlug` helpers; no schema or data change is
   needed, and the list stops presenting dead rows as ordinary pages.
4. **If durable state is preferred**, `content.metadata.archived = true` is
   available without a migration; public reads already cannot resolve these
   slugs. Do **not** use `status = 'draft'` as an archive: it changes publish
   semantics and drafts remain in the list.
5. **Delete only with explicit approval.** Export the row **and its
   `content_revisions`** first, and check the foreign key's delete behaviour —
   revisions are the only history of the old import.

## Reproduction

The row list is a plain read:

```sql
select id, slug, type, status, length(body) as chars, updated_at
from public.content
order by id;
```

Reachability is derived, not stored: `describeSlugConflict(slug)` returns a
message for reserved routes, and `isLegacySlug(slug)` covers the ten 301s.
The overlap figures came from a one-off read-only fetch of each destination and
the row's visible text; no writes were made.

## Non-goals

- Re-importing Google Sites content.
- Renaming a shadowed row to make it reachable.
- Deleting rows or revisions without the chapter's approval.
