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

Every pointer affordance has a keyboard equivalent, and every one of them is
tested. A control that only looks like it works is worse than a visible button —
the drag handle used to be a decorative `<span>`.

## Testing

- `__tests__/BlockEditor.reorder.test.tsx` — drag, keyboard reorder, link entry
- `__tests__/ContentEditor.autosave.test.tsx` — the autosave contract
- `src/lib/__tests__/content-media.test.ts` — upload rules, reference-safe delete
- `src/lib/__tests__/content-links.test.ts` — `isLinkableHref`
- `src/lib/__tests__/blocks.test.ts` — the sanitizer-parity property

## Known limitations

- **No embed block.** `sanitizeWPContent` strips iframes and oEmbed markup, so
  offering one would be a control that does nothing. Add the sanitizer support
  and the block together, or not at all.
- **No undo across sessions.** `content_revisions` keeps the last N states per
  row (BEFORE UPDATE, so the pre-image), which covers a bad publish. There is no
  per-session undo stack.
- **A missing `[slug]` returns HTTP 200 with `noindex`.** Under PPR the response
  commits before `notFound()` can change the status. Not editor-specific, but it
  is the first thing an editor sees after a typo'd slug.
