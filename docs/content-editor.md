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
| Block inventory | `.../block-definitions.tsx` | The 11 insertable block types: labels, hints, search keywords. |
| Links — the UI | `.../LinkPopover.tsx` | Toolbar link editing. `isLinkableHref` is a wrapper, not a rule. |
| Links — **the rule** | `src/lib/trusted-links.ts` | `TRUSTED_DOMAINS`, `isTrustedHost`, `isTrustedLinkHref`, `untrustedLinkReason`. One source of truth. |
| Media — **the rule** | `src/lib/own-media.ts` | `isOwnImageHost`, `isOwnImageUrl`, `ownImageRemotePatterns`. Which hosts may serve an authored image. |
| Server actions | `src/lib/actions/content.ts` | CRUD, revisions, upload, delete. |

The serialized body is `useMemo`-derived from the block model, never tracked
separately. That is what stops the save path and the preview from drifting apart.

## Invariants

### Autosave never changes a page's publish state

Autosave calls `persist(status)` — the document's *current* status.

An earlier version passed `'draft'` unconditionally, so editing a live page and
pausing for 2.5 seconds quietly unpublished it. The one failure mode a feature
whose entire purpose is to be uneventful must not have.

Taking a page down stays deliberate, named through `handleSetStatus` — the
Publish button or the Status dropdown. Pinned by
`ContentEditor.autosave.test.tsx`.

**And neither may the Publish button.** The same bug in a worse place.
`setContentStatus` writes `status` and `published_at` and nothing else, so
toggling it with unsaved edits on screen published the *last saved* version and
dropped the rest — and then set the saved snapshot over the whole field set, which
marked the editor clean. That short-circuited the autosave effect, stopped the
`beforeunload` warning, and left the indicator reading **"All changes saved"**. A
publish that discards an afternoon of writing and reports success, on the button
most likely to be pressed at the end of a writing session, is the worst failure
this editor can produce.

When anything is unsaved, `handleSetStatus` now calls `handleSave(next)` — the
same guarded path as the button and Cmd+S, so the title and body rules apply there
too. Pinned by `__tests__/ContentEditor.publish.test.tsx`: the whole document goes
out at the new status; a body edit is flushed, not just a title; a clean document
still takes the narrow status-only path; and a failed publish leaves the unsaved
indicator up.

**And neither may the Status dropdown.** It is the same state change behind a
second control, and for a long time it did not go through the guard at all. It
called `setStatus`, which is local state — but `status` is part of the document
snapshot, so `dirty` flipped and the autosave effect above fired
`persist(status)` 2.5 seconds later. Choosing "Draft" on a live page took it off
the site with no confirmation, no toast, and nothing on screen saying it had
happened.

It could not call the guarded function because the guarded function was a
no-argument *toggle*, and a toggle cannot express "the author picked Draft". It is
now `handleSetStatus(next)`, which takes the target state, and both controls call
it. **The rule for the next control that names a publish state: it goes through
`handleSetStatus`, and the write must be observable.** A snapshot write with no
immediate feedback reads as a broken control even when it is merely late.

Pinned by `__tests__/ContentEditor.safety.test.tsx`.

### A rejected save must not strand the editor

`saveContent` returning `{ success: false }` is a handled branch, and every call
site reports it. A **rejected** promise is a different animal: the request never
produced an answer — a dropped connection, an expired session (`requireAdmin`
redirects), a proxy that closed the socket.

Neither `handleSave` nor the autosave effect handled that. `handleSave` awaited
`persist` and set `saving = false` on the next line, which is not a guaranteed
statement — a rejection skips it — and `saving` is what disables the Save button.
One unreachable save left the editor permanently unable to save itself, and the
only recovery was a reload, which discards the document. The autosave path was
`void persist(...).then(...)` with no `.catch()` at all, so its indicator sat on
"Saving…" for the rest of the session while nothing was written, and
`activeSaveFailure` was never set, so the banner explaining why stayed hidden too.

Both are caught now, and both report through the same `setSaveFailure` + toast
path as a returned failure. The wording does the work a status code cannot: it
says the change is **not saved**, that the text is **still on screen**, and to
**copy it before reloading** — because the reflex on seeing a failed save is to
reload, and reload is what loses the work. Pinned by
`__tests__/ContentEditor.safety.test.tsx`.

### A failed save names its source; a stale version offers only reload

The same banner serves manual saves and autosave, but a failed Cmd+S is not an
autosave failure. `saveFailure` therefore records whether the write came `via:
'manual'` or `via: 'autosave'`, and both the status indicator and the banner use
that source in their wording.

A stale optimistic-concurrency refusal is a different failure from a validation
or connectivity failure. It is recognised by `STALE_SAVE_CONFLICT_PREFIX`, and
its banner:

- explains that another editor saved first;
- tells the author to copy unsaved text before reloading;
- offers **Reload onto their version**, not **Try again**;
- has no dismiss control that would simply re-arm the same failed write.

Another edit naturally changes the document snapshot and can trigger another
save attempt, but the UI never invites an immediate retry against a version it
already knows is outdated. Pinned by `ContentEditor.autosave.test.tsx` and
`ContentEditor.safety.test.tsx`.

### A successful save records what it wrote, not what was on screen

`persist` snapshots the document *as written*, including the status it just set.
It used to snapshot `fields`, whose `status` is the value from *before* the write,
so `dirty` stayed true after a successful publish. In order: the toast said
"Published", the indicator immediately contradicted it in red, `beforeunload`
started warning about work that was already stored, and 2.5s later the autosave
effect wrote the identical document again — a second `content_revisions` row for
a revision that changed nothing, on every publish. `handleSetStatus` got this
right at its own `setSavedSnapshot`; `persist` did not.

The general rule: the snapshot a save adopts must be the same one the write
produced. Two snapshots of one document that disagree is a whole class of bug.

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

### An image is measured, or the frame is fixed — never neither

A content image is emitted as `<img src alt width height loading>` and the block
model has carried `width` / `height` since the editor was written. **Nothing
populated them**, so every content image on the site shipped with no intrinsic
size — a guaranteed layout shift as the bytes arrive, and a direct violation of
`AGENTS.md` coding rule 5.

The dimensions come from the bytes, never from the author and never from the
browser's own report at render time. An author-supplied width is a number nobody
verifies. `measureImageSize` in `src/lib/image-size.ts` reads the header each
format already stores its size in — PNG's IHDR, GIF's logical screen, WebP's
first chunk, JPEG's SOFn — from the bytes just written to the bucket, and returns
`null` for anything it does not recognise rather than guessing. **A wrong
dimension is worse than no dimension**: the browser reserves the wrong box, so
the shift is still there and the image is now distorted too.

Every route that carries a `File` is measured, because they all reach the same
`upload()`: the picker, the drop target, and the clipboard paste. A hand-typed
or pasted *URL* has no bytes, so `ContentImageInput` probes it with a detached
`window.Image` after a 600 ms settle and re-emits the URL with the measurement
attached. Three properties of that probe are load-bearing:

- **It re-emits the same `src` rather than setting the size alone.** The consumer
  replaces the whole image block, so a dimensions-only update would be a second,
  separate change to the same field — and the intent key is unchanged from the
  keystrokes, so the whole thing coalesces into the single edit the author was
  already making.
- **It skips our own hosts** (`isOwnImageUrl`), which the server already measured
  from the bytes. Re-probing would spend a request to re-learn what we know.
- **It never resolves twice, and never blocks the URL.** A 404 still commits the
  URL — the author may be mid-fix — and writes no dimensions, because the block
  already holds `null` and re-emitting `null` is a no-op the author would have to
  undo. The single settlement is guaranteed by the promise, not by detaching the
  handlers; detaching them releases two closures and nothing more.

Where no measurement is possible, the fallback is a **fixed frame**, never an
unreserved box. That is what the hero does (§ below), and it is why an
unmeasured hero is acceptable while an unmeasured content image was not.

The serializer omits `width` / `height` entirely when they are `null`, rather
than emitting `width="0"` — a zero reserves nothing and renders nothing. The
sanitizer's `img` allowlist (`src, alt, width, height, loading`) is what carries
them to the reader, so it is load-bearing: narrowing it fails the round-trip
property test at the boundary rather than as a slow, invisible regression.

**Not done: backfilling existing content.** The CMS was migrated from Google
Sites, so legacy `content.body` images sit on external hosts that are largely
dead. A backfill would rewrite every content row — and mint a revision per row —
for what would mostly be no-op measurements, and it is a production data change
that belongs to the chapter rather than to a deploy. New and edited images are
all measured; the pre-existing ones keep their shift until an author touches
them. Deliberate, not overlooked.

### The hero is an image, and it is on the page

`featured_image` is a hero, not an attachment. It renders at the top of
`src/app/[slug]/page.tsx` in an `aspect-[16/9]` frame via `next/image` with
`fill` — a fixed frame rather than `width`/`height` because the CMS accepts an
arbitrary upload and the hero is deliberately cropped to 16/9, so an intrinsic
size would describe a shape the page does not render. The frame is what prevents
layout shift here, and it holds whether or not the upload was measured. It is
also the `og:image` (through `pageMetadata`'s `images`) and the Article JSON-LD
`image`.

Three things used to be true at once, and each one is a control that did not do
what it said:

1. **The field was rendered by no public route.** Stored, revision-tracked,
   reference-checked on delete, and shown in the editor's preview — and invisible
   to readers. So the preview was showing an image the published page would not
   have, which is the opposite of what a preview is for.
2. **It was a bare URL field, and its only acceptable values were the site's own
   hosts.** The CMS's own uploader writes to the `media` bucket on the Supabase
   project and returns a `*.supabase.co` URL, so a hero could not be set from the
   CMS at all in production. A control the author could fill in and watch come
   back as an error.
3. **`saveContent` compared that host against `NEXT_PUBLIC_SITE_URL` alone**,
   which is the same exclusion.

So the hero now uses the same `ContentImageInput` uploader as an image block, and
host validation is `isOwnImageUrl` from `src/lib/own-media.ts` — the site origin,
the Supabase project host, or any `*.supabase.co`, **derived from configuration**
so it follows the apex cutover without a code sweep. It is absolute http(s)
only: a `data:` URL would break the crawler that reads the OG tag, and a relative
one would resolve against whatever host rendered it.

Next *replaces* rather than merges `openGraph`, so a page that declares its own
`images` discards the `opengraph-image` file convention's output entirely. That
is why the hero is passed through `pageMetadata` rather than left to the
convention.

### The block inventory, and the two rules the sanitizer imposes on it

Twelve types exist; **eleven are insertable** from the slash menu.
`BLOCK_DEFINITIONS` in `.../block-definitions.tsx` is the single inventory —
labels, hints, search keywords, heading levels, callout tones. `unsupported` is
the twelfth and is deliberately *not* insertable: it is markup the model has no
editor for (a definition list, something the migration left behind), preserved
verbatim and rendered read-only, so that opening a page in the editor and saving
it does not delete content it cannot represent.

Two sanitizer constraints shape every type, and both are silent when violated:

- **`data-*` is not in the allowlist**, so block identity and variant travel in
  `class` under the `cw-` prefix. That also dodges every prefix the sanitizer
  strips (`wp-`, `elementor-`, `freshio-`, `woocommerce`, `yith-`). Renaming a
  class orphans every stored block.
- **Three or more directly adjacent anchors are deleted as link spam**, which is
  why every `button` block carries a `BUTTON_WRAPPER_CLASS` wrapper. A row of
  calls to action written without knowing this is eaten on publish, and looks
  fine in the editor.

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

### Between a keystroke and the model there are two documents

A keystroke reaches the DOM instantly and the model on a 120 ms debounce. **In
that window there are two candidate documents**, and only one of them is the
model: `committed` is what `content.blocks` holds, `pendingHtml` is every
keystroke not yet folded into it.

The old code shared one `setTimeout` across all blocks and closed over the
`blocks` array captured when the keystroke was *rendered*. It failed three ways
at once, and all three are silent:

- **Two blocks in one window lost the first block's text.** The shared timer
  flushed only the block that scheduled it last, so the first block's pending
  characters never reached the model.
- **Enter inside the window deleted the paragraph it had just created.** The
  insert fired, and the pending flush then wrote the pre-Enter array back through
  `onChange` — so the caret moved into a block that the next render removed.
- **Convert, duplicate, split and move read the stale `html`** and carried across
  the words last *saved* rather than the words on screen. Converting is what makes
  that loss permanent.

Type-then-Enter is the single most common action in a block editor, so this was
the most common way to lose a sentence.

The rule that prevents all four: **every structural operation reads
`liveBlocks()`, never the `blocks` prop.** `liveBlocks()` is
`committed + pendingHtml`; `structural()` folds the pending edits into the base
*without* a second `onChange`, because they are not a separate render — React
batches the whole event, so from the model's point of view it is one atomic
transition. Emitting them separately would produce two `onChange` calls whose
second argument is a single ref, and the last writer would silently relabel the
other's undo entry.

Two consequences worth knowing:

- **One shared timer is correct; flushing only the last block was the bug.** The
  flush commits *every* pending block in a single `onChange`, so a burst spanning
  two blocks is one transition and one undo step.
- **The undo intent is field-scoped and sorted.** `burstIntent` builds
  `type:<sorted, comma-joined ids>`, so a run of typing in one block still yields
  the byte-identical key `type:<id>` it always did, two bursts over the same pair
  of blocks coalesce regardless of the order they were clicked in, and two
  different blocks never merge into one step. An insertion-ordered key would split
  one run of typing into two undo steps purely because of click order.

A pending flush is cancelled on unmount rather than committed: calling `onChange`
on a parent that has already dropped the document could resurrect a block the
author deleted on the way out.

`BlockEditor.debounce.test.tsx` is the regression suite. **It needs two blocks
inside one window to fail** — with one block, one timer and one flush, the stale
closure is correct by accident, which is why this shipped.

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

The claim is only as good as its enforcement, and it had none. Four typing paths —
the image `src`, table headers, table cells and list items — omitted the argument
entirely, so undo recorded one step per character in exactly those blocks while
every other field behaved. Nothing caught it, because the grouping is invisible
from the DOM.

Two rules make the declaration mean something. **Every `onUpdate` / `setBlocks`
call passes an intent or an explicit `null`** — omitting the argument is the bug,
and it reads as tidier code, not riskier. And **the key must be field- and
position-scoped**: `type:cell:${block.id}:${rowIndex}:${colIndex}`, not
`type:cell:${block.id}`. Coalescing on the block alone merges edits to two
different cells into one undo step, which is a quieter failure than
one-undo-per-character and harder to notice.

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

### A save carries the version it was based on

`saveContent` takes an optional `expectedUpdatedAt` and turns it into a
precondition on the UPDATE. Two organizers on one page is the normal case for a
volunteer group, and the editor was **last-write-wins with no signal** — the
second save discarded the first one's afternoon, on the one surface whose entire
purpose is to look after written work. `content_revisions` made it *recoverable*,
which is a poor consolation for an author who never learns they overwrote anyone.

The rule is the optimistic-concurrency one, and four details decide whether it
works. Each is silent when wrong, so each has its own test.

**The precondition rides on the same UPDATE, not a SELECT-then-UPDATE.** Checking
the version first leaves a window between the two statements in which a
colleague's save lands and is then overwritten — the guard passes and still loses
their work. And the write must ask for the row back with `.select(...)`: an
UPDATE that matches nothing returns `error: null` and `data: null`, which is
indistinguishable from success. That is the whole reason
`.update().eq().select().maybeSingle()` is the correct call and a bare
`.update().eq()` is not.

**The version returned is the one the trigger wrote.** `content` has a
`BEFORE UPDATE` trigger (`touch_content_updated_at`) that sets
`updated_at = now()`. `saveContent` returns that value rather than generating a
timestamp in JavaScript: a second clock disagrees with the database's, and the
author's very next autosave — 2.5s later — would conflict with the author's own
work. A guard that made the second save fail would be worse than no guard,
because it would block the person who is *not* in conflict.

**A null claim uses `.is()`, never `.eq()`.** `content.updated_at` is nullable, so
a row that predates the trigger has none. `.eq('updated_at', null)` is
`updated_at=eq.null` in PostgREST and matches **nothing**, so the guard would
report a conflict for a page nobody had touched. Omitted, `null` and a string are
three distinct states, and conflating the first two silently disables the check
for exactly the pages with the least history.

**Only a write updates the version.** The editor holds it in a ref — a ref, not
state, because it changes on every autosave and must not re-render the editor. A
revision restore adopts the version it re-reads, because it wrote the row. Undo,
redo and draft recovery deliberately do **not**: they only rearrange a document
already in hand. And it is re-seeded from props only when `initial.id` changes —
adopting it every render would defeat the whole mechanism, because
`router.refresh()` runs after each save, so a colleague's newer timestamp would be
picked up and then overwritten having first agreed it was fine.

A conflict is reported as a failure, which is already the path that stops
autosave (`activeSaveFailure`) and offers the author their snapshot back. The
message names the cause and the action; it does not say which of the two things
happened, because distinguishing "a colleague saved" from "the page was deleted"
costs a round trip on a path that fires once per conflict and both are answered by
the same instruction: reload, look, decide what to keep.

`src/lib/__tests__/content-concurrency.test.ts` covers all of it.

### A revision preserves the hero *and* the publish date

`content_revisions` has a `featured_image` column (migration `20260930000000`;
the trigger stores `OLD.featured_image`, and `restoreContentRevision` writes it
back instead of `null`) **and** a `published_at` column (migration
`20260930120000`; the rewritten trigger stores `OLD.published_at`, treats a date
change as revision-worthy, and the restore passes it through as `publishedAt`).

The date is the same failure as the hero, in a place nobody was looking.
`saveContent` re-stamps `published_at = now()` whenever a published page is
written without one, so restoring a March revision of a post re-dated it to today
and **jumped it to the top of `/news`** — the exact reordering `setContentStatus`
was written to prevent, three functions away in the same file. A restore must
restore the *document*, not just its text.

Pre-migration rows have `NULL` in both columns and restore as before: no hero, and
the re-dating. `content_revisions` is allowlisted in `scripts/gen-types.mjs`, so
regeneration keeps it.

**`src/types/supabase.ts` will not have either column until the migrations are
applied** — it is generated from the *live* project, not from the files. That is
why both read sites use intersection casts
(`as ContentRevision & { featured_image?: … }`). Do not "fix" a cast by editing
the generated file; run `bun run types:generate` after the push.

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
unsaved work is a URL that can be shared by accident.

It is built on `@radix-ui/react-dialog` rather than a hand-rolled
`role="dialog"`. That version declared `aria-modal="true"` and moved focus to the
close button but **trapped nothing**, so Tab walked out of the preview and into
the editor behind it, and a keyboard user landed in the body of a document they
believed they had left. Radix gives the trap, the focus restore on close, and
Escape — which is why every other modal in this repo already is one. A
`Dialog.Title` is present, so it is announced as a dialog rather than as an
unnamed region. A "Draft preview — not published" banner keeps it from being
mistaken for the live page.

The hero renders in the same 16/9 frame the public page uses, via a plain `<img>`
rather than `next/image` — the frame reserves the space, which is the property
the two layouts actually have to agree on. Broken-image state stores *which URL
failed* rather than a boolean, so picking a different image cannot leave a stale
"broken" marker.

The date it prints is `createdAt`, the same field the public page prints as
"Published". It used to pass `publishedAt` — a different column, and `NULL` for
anything never explicitly published, so the preview showed **no date at all** for
those pages.

- `__tests__/ContentEditor.preview.test.tsx` — modal opens with sanitized body, close button works, prints the created-at date, holds focus inside the dialog, is announced as a dialog
- `src/lib/__tests__/trusted-links-parity.test.ts` — the sanitizer's allowlist and the editor's cannot diverge, for any host
- `src/lib/__tests__/own-media.test.ts` — which hosts may serve an authored image, which may not, and what happens when the env is unconfigured

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

### A status control has to reach the guard, and a snapshot has to match the write

Both halves of this one are the same mistake wearing different clothes: something
looked like it reported what it did, and did not.

The **Status `<select>`** sat next to the Publish button and called `setStatus` —
local state. `status` is part of the document snapshot, so `dirty` flipped and the
autosave effect fired `persist(status)` 2.5 seconds later. Choosing "Draft" on a
live page took it off the site with no confirmation and no toast. It could not
call the guarded path because that path was a no-argument *toggle*, and a toggle
cannot express "the author picked Draft". Hence `handleSetStatus(next)`: two
controls naming one state take one path, and the write is observable at the moment
of the click.

The **snapshot** `persist` adopted recorded `fields`, whose `status` is the value
from before the write. `dirty` therefore stayed true after a successful publish:
toast "Published", indicator contradicting it in red, `beforeunload` warning about
stored work, and 2.5s later a second write of the identical document — a second
`content_revisions` row for a revision that changed nothing, on every publish.
`handleSetStatus` already got this right at its own snapshot; `persist` did not.

Pinned by `__tests__/ContentEditor.safety.test.tsx` (16 tests, 15 of which fail
against the code that shipped with these two bugs).

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

### One trusted-domain rule, in one module

`src/lib/trusted-links.ts` owns `TRUSTED_DOMAINS`, `isTrustedHost`,
`isTrustedLinkHref` and `untrustedLinkReason`. `sanitize.ts` re-exports
`TRUSTED_DOMAINS` from it; `LinkPopover.isLinkableHref` and
`BlockEditor.isSafeHref` are one-line wrappers. **Nothing else may hold its own
list.**

It was three lists, and they had already drifted. The sanitizer allowed twelve
domains, `LinkPopover` allowed one, and `isSafeHref` carried a hardcoded second
copy of that one. So an author could not link to `indivisible.org`,
`actblue.com` or `mobilize.us` — all of which the sanitizer would have kept — and
the editor told them the link "is removed when the page is published", which was
false for eleven of the twelve. The failure mode of a duplicated allowlist is not
a build error; it is a volunteer quietly believing the site is more restrictive
than it is.

Everything in that module is a pure function over a string, so the editor can
import it without pulling `sanitize-html` into a client bundle, and
`untrustedLinkReason` is what the popover shows, so the **wording** cannot drift
from the rule either. `src/lib/__tests__/trusted-links-parity.test.ts` asserts
the two agree for every domain on the list, which is what makes adding one safe.

The predicate rejects lookalike hosts
(`evil-indivisiblefairoaks.org`), protocol-relative `//evil.com`, and
non-http schemes. `mailto:`, `tel:` and `#anchor` are allowed.

### The header button is the master switch, and nothing else

The header's editorial control is one icon button that turns visual editing on
and off. It used to be two controls of two sizes — the icon plus a chevron
opening a menu of regions and per-section switches — which gave one intent two
hit areas and duplicated a section list the overlay already publishes.

Per-section editing was never really in that menu, so removing it loses
nothing. It lives in two places that each own their half: **on the page**,
where every framed section carries its own action pill (frame, jump, edit,
duplicate, move, add below, hide, delete), and **in the drawer**, where
`EditorialDrawerRow` keeps the full editorial card with regions and every
per-section control for the small screens that need it most. The header never
derives a section list of its own — a second list agreed only while nothing had
been sanitized out of the page, and then offered to edit an element that was a
different section.

- `__tests__/EditorialButton.test.tsx` — one button and no menu however many
  sections publish; the drawer keeps regions, CRUD dispatches, Frame-all
  semantics, inert undescribed rows and region-scoped adoption

### A hidden frame is recoverable per section, from the dock

The in-page pill's EyeOff hides a frame, and a hidden frame has no pill — so
the control that hid it cannot bring it back. The only recovery was the
drawer's "Frame all", which reframes every section to recover one.

Every block in the dock's block bar now carries its own frame switch
(Eye/EyeOff with `aria-pressed`), addressing the block by index through the
same `toggleSectionFrame` the pill uses. A block with no measured section —
unpaired with any element — gets no switch rather than a switch that guesses.
The chip names the block with `sectionLabelForBlock`, the same label the pill
and the drawer show, not the raw `block.type`.

### Editor chrome opens on click, never on hover

The dock's Add Block menu was `group-hover:block`: invisible to every keyboard
and touch user, and in no tab order at all. It is a Radix `DropdownMenu` now —
click-to-open, arrows to move, Escape to dismiss — the same primitive and the
same rationale as `NavDropdown`. It opens upward because the dock sits at the
viewport bottom, and its options come from one `ADD_BLOCK_OPTIONS` list so a
creatable block and a convertible block cannot drift apart.

### Editor dialogs follow the reader's palette

The section editor, settings and revisions dialogs were hardcoded light
(`bg-white`, `text-slate-700`, `border-slate-300`), so in dark mode an admin
got a blinding white modal over a dark page. Every light-surface class is now
a token (`bg-surface-card`, `text-foreground`, `border-border`,
`bg-surface-muted`, `text-muted-foreground`) — identical paint in light mode,
adaptive in dark. The dock, pills and frames stay deliberately dark chrome on
opaque `bg-secondary`, like the site header: they are dark because they say so,
not because the reader is in dark mode.

- `__tests__/design-tokens.test.ts` — scans every `.tsx` under
  `components/visual-edit`, `components/admin` and `app/admin` for
  light-surface text, hairlines, fills, slate hovers and bare `bg-white`, with
  the deliberate dark-chrome classes documented as the exception list. Modelled
  on `commerce-no-nzd.test.ts`: a ratchet, not a wall.

### One name per shape, in one module

Cross-domain types live in `src/types/unified.ts`; CRM row types live in
`src/types/crm.ts`. There is no third copy of either: the duplicate
`VISUAL_EDIT_EVENTS` literal, the conflicting `ContentRevision`, the
`VisualSave*` / `MediaTarget` / admin / theme / utility dead weight, the ten
`VisualSection*Detail` aliases and the seven `CRM*` aliases are all gone, and
`src/types/visual-edit.ts` (zero importers) is deleted. The event bus
(`lib/visual-edit-events.ts`) speaks the canonical `ToggleSectionDetail` /
`FocusSectionDetail` / … names, and client components import types from
`@/types/crm` / `@/types/unified` directly — the `'use server'` actions module
no longer re-exports types, so a field added to one side cannot silently stop
reaching the other.

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
tested — a claim that was false for as long as it was written here. The slash
menu, the editor's primary insertion affordance and the one the shortcut table
above advertises, was mouse-only: it autofocused its own search input while
Arrow / Enter / Tab were bound to the block it had been opened **from**, so no key
ever reached a handler and the only way to pick a block was a click. It is now a
combobox with `aria-activedescendant`, the keys on the dialog (plus Home/End and
Tab-as-accept), and options that are `role="option"` at `tabIndex={-1}` so focus
stays in the field.

Two rules generalise it, and both are easy to get wrong again:

- **A menu that moves focus must own its own key handling.** Do not bind the keys
  on the element the menu was opened from. Every key an author needs inside a
  floating surface has to be handled on the surface, or it will not fire.
- **A reveal gated on `group-hover` is invisible on touch.** Tailwind v4's
  `group-hover` *is* `@media (hover: hover)`, so the block chrome — drag, move,
  duplicate, delete — sat at `opacity: 0` on a phone while remaining clickable
  and still in the tab order. Gate with `hover-capable:` and add
  `focus-within:opacity-100`, per AGENTS.md § Reveal-on-hover.

A control that only looks like it works is worse than a visible button — the drag
handle used to be a decorative `<span>`.

## Testing

- `__tests__/BlockEditor.test.tsx` — one editable per block, the type menu, conversion keeps the words, `unsupported` stays read-only and serializable
- `__tests__/BlockEditor.debounce.test.tsx` — **needs two blocks inside one window to fail**; keeps both edits, Enter's new paragraph survives, conversion carries just-typed words, one intent per burst, and the key is order-independent
- `__tests__/ContentImageInput.probe.test.tsx` — a typed URL is measured and re-emitted atomically; no probe for our own uploads, a half-typed URL, or a repeat; a failed probe changes nothing
- `__tests__/BlockEditor.reorder.test.tsx` — drag, keyboard reorder, link entry
- `__tests__/BlockEditor.slash-menu.test.tsx` — opens and focuses; Arrow/Home/End; Enter and Tab accept with no mouse event; Escape and backdrop close; query narrowing; `aria-activedescendant`; the viewport-covering backdrop stays out of the tab order
- `__tests__/ContentEditor.autosave.test.tsx` — the autosave contract
- `__tests__/ContentEditor.undo.test.tsx` — undo grouping, whole-document restore
- `__tests__/ContentEditor.draft.test.tsx` — recovery offered, not applied
- `src/lib/__tests__/editor-history.test.ts`, `draft-recovery.test.ts` — the two modules
- `src/lib/__tests__/content-media.test.ts` — upload rules, reference-safe delete
- `src/lib/__tests__/content-revisions.test.ts` — restore writes the revision hero **and** the revision publish date back
- `src/lib/__tests__/supabase-mock.ts` — the shared row-based builder every action test should use. Not a database: no joins, RLS or transactions. It models the *builder's* semantics, which is where a hand-rolled stub diverges from the API and either fails on correct code or passes on code that would 4xx
- `__tests__/ContentEditor.publish.test.tsx` — unsaved work goes out with the publish; a clean document still takes the status-only path
- `__tests__/ContentEditor.revisions.test.tsx` — row labels, the diff, confirm-only restore, cancel backs out
- `__tests__/ConfirmAction.test.tsx` — the shared destructive-action contract
- `__tests__/ContentEditor.preview.test.tsx` — modal opens with sanitized body, close button works
- `__tests__/ContentEditor.seo.test.tsx` — inputs render, preview shows them, save persists them
- `__tests__/ContentList.publish-state.test.tsx` — View only when live, no draft URL, Preview says why
- `src/lib/__tests__/content-links.test.ts` — `isLinkableHref`
- `src/lib/__tests__/image-size.test.ts` — header parsing against **real encodings** (fixtures produced with `sips` / `cwebp`, expected values taken from the OS decoder, so a hand-written header cannot agree with a mistaken idea of the format), plus the marker walk and the WebP container's rejection paths
- `src/lib/__tests__/blocks.test.ts` — the sanitizer-parity property, and that an image's measured dimensions survive sanitize and parse back
- `src/lib/__tests__/content-concurrency.test.ts` — the `updated_at` precondition: refuses without writing, returns the version the trigger wrote, three consecutive saves all succeed, and a null claim uses `.is()`
- `src/lib/__tests__/content-media.test.ts` — upload rules, reference-safe delete. Row-based, so the **query** is under test: mutating the reference check's column, or removing its filter, fails here

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
- **Scrollable regions have to be told to be focusable, and that is easy to
  forget.** An `overflow-x-auto` container stopped being focusable by default in
  Chrome and Firefox, so one without `tabIndex={0}` cannot be scrolled by a
  keyboard user at all. The directory table and the table block are both
  `<section aria-label="…" tabIndex={0}>` now, per the WAI-ARIA Scrollable
  Region pattern. Biome's `noNoninteractiveTabindex` does not model the pattern;
  it is suppressed per element with the reason, not for the file, because
  `BlockEditor` has thirty blocks and a file-scope suppression would hide a real
  regression on any of them.
- **A large broadcast's progress view gives up after ~30 minutes.** The CRM
  composer's poll is derived from the recipient ceiling rather than a fixed count,
  then stops and says the *view* has stopped updating. That is a statement about
  the tab, not the send. See [`crm-operations.md`](./crm-operations.md) § Recovery.
- **No concurrent-edit detection.** Two organizers on the same page are
  last-write-wins with no warning, and a revision restores cleanly enough that
  the loss is only visible by reading. A `content.updated_at` precondition on
  `saveContent` would catch it; it is not built.
