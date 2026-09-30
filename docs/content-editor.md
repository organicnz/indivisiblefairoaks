# The content editor

> How `/admin/content` works, and the invariants that are easy to break.
> Full context in [`../AGENTS.md`](../AGENTS.md); the skills index is [`../SKILLS.md`](../SKILLS.md).

A block editor for pages and posts, replacing the textarea. Zero new
dependencies — everything is `src/lib/blocks` plus React.

## Shape

| Piece | File | Job |
|---|---|---|
| Model + parser | `src/lib/blocks/` | `Block[]` ↔ HTML. The only source of truth. |
| Editor shell | `src/components/admin/content/ContentEditor.tsx` | Autosave, save state, revisions, settings. |
| Block UI | `.../BlockEditor.tsx` | One row per block: toolbar, slash menu, drag handle. |
| Media | `.../ContentImageInput.tsx` | Picker, drop, paste, alt text. |
| Links | `.../LinkPopover.tsx` | Toolbar link editing + `isLinkableHref`. |
| Server actions | `src/lib/actions/content.ts` | CRUD, revisions, upload, delete. |

The serialized body is `useMemo`-derived from the block model, never tracked
separately. That is what stops the save path and the preview from drifting apart.

## Invariants

### Autosave never changes a page's publish state

Autosave calls `persist(status)` — the document's *current* status.

An earlier version passed `'draft'` unconditionally, so editing a live page and
pausing for 2.5 seconds quietly unpublished it. The one failure mode a feature
whose entire purpose is to be uneventful must not have.

Taking a page down stays deliberate, via the Save button. Pinned by
`ContentEditor.autosave.test.tsx`.

### Autosave backs off, and stops on failure

2.5s debounced, existing pages only, never creates a row from a half-typed
title. A failed write is recorded against the *snapshot* that produced it, so the
next keystroke clears it — no clearing effect, and a stale error can never be
showing against text that has since changed.

`Cmd/Ctrl+S` reaches the same guarded path as the button.

### Images: public `media` bucket, raster only

`uploadContentImage` accepts JPEG/PNG/WebP/GIF, ≤5 MB. **SVG is stored XSS** —
once it is served from the bucket it executes in the site's origin. Paths are
`content/<slug>-<8 hex>.<ext>`: random rather than timestamped, so two organizers
uploading `rally.jpg` in the same second cannot collide.

### Deleting an image checks every reference first

`deleteContentImage` was an unconditional `storage.remove()`, which made a
careless click a data-loss event. The same upload is routinely used twice — two
blocks on a page, a hero reused across pages, a revision that would then
restore an image that no longer exists.

It now refuses when `content.body`, `content.featured_image` **or
`content_revisions.body`** still references it, and the UI says which. The
failure direction is deliberate: declining leaves an orphan (garbage), while
deleting a referenced file is broken content on a live page.

### The block editor must produce markup the sanitizer preserves

`sanitize(serialize(blocks)) === serialize(blocks)` is asserted as a property
test. It is the only thing between a new block type and silently vanishing on
publish.

The exemption is content that genuinely contains a spam keyword — deleting that
is the filter working, so those cases are skipped rather than asserted. See
`AGENTS.md` § Sanitization layer.

### Undo/redo is snapshot-based, and grouped by intent

`src/lib/editor-history.ts`. The stack holds only `past` and `future`; the live
fields stay the present, so there is no second copy of the document to drift from
what the author sees.

Snapshots are the *same string* that decides whether the page is dirty. Two
things comparing snapshots differently is how "undo restored a document" and
"the page is clean" end up meaning different things.

Inverse operations are not used because the editor's operations are not
invertible in any useful sense — "merge these paragraphs" and "convert this
heading to a quote" have no inverse that restores what the author had. Storing
the state *before* each change sidesteps that, and every entry is a document that
really existed.

**Grouping is why undo feels like undo.** A block editor emits a model change per
character. Every handler therefore declares an intent: `type:<field>` for typing,
`null` for a discrete change like deleting a block. Undoing one letter at a time
is not undo, it is a way to make an editor feel broken.

Two bugs in this wiring are worth knowing about, because both present as "undo
silently does nothing":

- **A functional `setState` updater must not read a ref the same effect mutates.**
  The updater runs later, during the re-render, by which point the effect has
  already advanced the ref — so it compares the new snapshot with itself, sees no
  change, and records nothing. Read both refs into locals first.
- **A snapshot that does not round-trip to an identical string is recorded as an
  edit.** A draft written by an older version of the code is a real case, so
  restores, undos and redos set an `appliedByUs` flag and the recording effect
  skips them. Without it, one restore appears as two undo steps.

Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (plus Cmd+Y) are intercepted rather than left to
the browser. Inside a `contenteditable` the native version walks the DOM's own
edit history, which knows nothing about the block model: it would undo a
character the model no longer has. Undo and redo are also buttons, because a
keyboard-only feature is a feature nobody discovers.

### A local draft survives the gap before autosave

`src/lib/draft-recovery.ts`, keyed per content id in `localStorage`.

Autosave is 2.5 seconds from durable storage, and a crash, a closed laptop or a
mis-click in another tab all land inside that window. `content_revisions` cannot
help — it records persisted states, so anything never written is gone.

**It is offered, never applied.** A local copy silently replacing the page someone
came back to is how an editor loses an author's trust permanently. The author
chooses "Restore" or "Discard", and an accepted restore is itself undoable.

It is also conservative about freshness: a draft identical to what the server sent
is not offered (the author typed and undid their way back), and one older than a
week is discarded rather than offered as archaeology. The local copy is cleared
once the work is saved, so it cannot offer a recovery for text already durable.

Storage failures are swallowed. A full quota must not break editing; the draft is
a nicety and the editor is the product.

### Revisions preserve the featured image

`content_revisions` has a `featured_image` column, and the trigger stores
`OLD.featured_image`. `restoreContentRevision` writes that value back instead
of `null`.

The trigger already treated a hero change as revision-worthy, but the table had
nowhere to store it — so a restore silently cleared the hero. Rows written
before the migration still have `NULL` and restore as before; only newer
revisions carry the image. `content_revisions` is allowlisted in
`scripts/gen-types.mjs` so regeneration keeps it; regenerate after the
migration lands and never hand-edit `src/types/supabase.ts`.

### A restore is never blind

Each history row shows its status and type, a field-level diff against the
document on screen (title, slug, status, type, excerpt, hero, body size), and
an inline confirm step. The native `confirm()` is gone from the restore path:
it asks a second, blinder question on top of an informed one, and it cannot be
automated — so the restore path would go untested. The diff reads from the same
`fields` object the dirty check compares, so "what would change" and "unsaved
changes" can never disagree about what "current" means.

### SEO meta fields win over derived values

The editor exposes meta title and meta description, stored in
`content.metadata` as `meta_title` / `meta_description`. `generateMetadata`
uses them when present and falls back to the derived title / body excerpt when
not — so pages authored before SEO existed still get a sensible snippet.

The character counts are Google's SERP budgets: a title past ~60 is truncated
in the results, a description past ~155 is cut mid-sentence. The search preview
shows the meta fields when set, because that is what Google will actually use.

- `__tests__/ContentEditor.seo.test.tsx` — inputs render, preview shows them, save persists them

### A preview is honest, or it is not a preview

`ContentPreview` (`src/components/admin/content/ContentPreview.tsx`) renders the
current document through the same `sanitizeWPContent` and the same `cw` + prose
classes as `src/app/[slug]/page.tsx`. A preview that styled itself differently
would be a lie the author ships on.

It is a modal, not a route: the document may be unsaved, and a URL that renders
unsaved work is a URL that can be shared by accident. Escape closes it, focus
moves to the close button on open, and a "Draft preview — not published" banner
keeps it from being mistaken for the live page.

- `__tests__/ContentEditor.preview.test.tsx` — modal opens with sanitized body, close button works

### Destructive actions confirm inline, never natively

`ConfirmAction` (`src/components/admin/ConfirmAction.tsx`) is the one shape for
"delete this", "merge these", "opt this person out". The idle control says what
it is; clicking it replaces it with the consequence and a Confirm/Cancel pair.

`window.confirm()` is gone from every destructive path. It asks a blind
question — "are you sure?" about something the dialog never names — and it
cannot be automated, so every path behind one went untested. The component is
unmount-safe (state lives in the button, not a portal), keyboard accessible
(`fieldset`/`legend`, not `role="group"`), and `busy` disables the whole step
while an async action is in flight.

- `__tests__/ConfirmAction.test.tsx` — idle label, confirm-only fire, cancel backs out, busy disables

### A control must name the state it will actually reach

The directory's row action is **View** for a published page and **Preview** for
a draft. A draft has no public page — `getPublishedContent` filters to published
rows — so a View link on a draft landed on an HTTP 200 "Page Not Found" that the
author could not tell apart from a typo'd slug.

That is the AGENTS.md "no fake controls" failure, and it is worth restating
because the live example is so mild: nothing crashed, no console error, the page
rendered. The only symptom was an author unable to tell a typo from an
unpublished draft, which is precisely the question the editor exists to answer.

The fix is not a better error page. It is a control that says what it does.
`Publish` stays on both states — the fix must not hide the way out of the
situation it reports.

- `__tests__/ContentList.publish-state.test.tsx` — View only when live, no draft URL, Preview says why, Publish still reachable

### Links are validated against the same rule the sanitizer enforces

`isLinkableHref` is the editor's copy of the trusted-domain rule. If the two
disagree the author finds out on publish: the link looks fine in the editor and
is then stripped. The predicate rejects lookalike hosts
(`evil-indivisiblefairoaks.org`), protocol-relative `//evil.com`, and
non-http schemes. `mailto:`, `tel:` and `#anchor` are allowed.

## Shortcuts

| Key | Action |
|---|---|
| `/` on an empty line | Insert block |
| `Cmd/Ctrl+K` | Add a link to the focused block |
| `Cmd/Ctrl+S` | Save now |
| `Alt+↑` / `Alt+↓` on a handle | Move a block |
| `Cmd/Ctrl+Z` | Undo |
| `Cmd/Ctrl+Shift+Z` or `Cmd+Y` | Redo |

Every pointer affordance has a keyboard equivalent, and every one of them is
tested. A control that only looks like it works is worse than a visible button —
the drag handle used to be a decorative `<span>`.

## Testing

- `__tests__/BlockEditor.reorder.test.tsx` — drag, keyboard reorder, link entry
- `__tests__/ContentEditor.autosave.test.tsx` — the autosave contract
- `__tests__/ContentEditor.undo.test.tsx` — undo grouping, whole-document restore
- `__tests__/ContentEditor.draft.test.tsx` — recovery offered, not applied
- `src/lib/__tests__/editor-history.test.ts`, `draft-recovery.test.ts` — the two modules
- `src/lib/__tests__/content-media.test.ts` — upload rules, reference-safe delete
- `src/lib/__tests__/content-revisions.test.ts` — restore writes the revision hero back
- `__tests__/ContentEditor.revisions.test.tsx` — row labels, the diff, confirm-only restore, cancel backs out
- `__tests__/ConfirmAction.test.tsx` — the shared destructive-action contract
- `__tests__/ContentEditor.preview.test.tsx` — modal opens with sanitized body, close button works
- `__tests__/ContentEditor.seo.test.tsx` — inputs render, preview shows them, save persists them
- `__tests__/ContentList.publish-state.test.tsx` — View only when live, no draft URL, Preview says why
- `src/lib/__tests__/content-links.test.ts` — `isLinkableHref`
- `src/lib/__tests__/blocks.test.ts` — the sanitizer-parity property

## Known limitations

- **No embed block.** `sanitizeWPContent` strips iframes and oEmbed markup, so
  offering one would be a control that does nothing. Add the sanitizer support
  and the block together, or not at all.
- **Undo does not survive a reload.** The stack is in memory. `content_revisions`
  covers a bad publish (BEFORE UPDATE, so the pre-image) and the local draft
  covers an unsaved crash, but there is no per-session undo across a page load.
- **A missing `[slug]` returns HTTP 200 with `noindex`.** Under PPR the response
  commits before `notFound()` can change the status. The status code is still
  wrong for crawlers, but the editor-facing consequence is fixed: a draft row no
  longer links to a URL that cannot resolve, so an author is told which state
  they are in rather than discovering it by clicking.
