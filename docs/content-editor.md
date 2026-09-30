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
  commits before `notFound()` can change the status. Not editor-specific, but it
  is the first thing an editor sees after a typo'd slug.
