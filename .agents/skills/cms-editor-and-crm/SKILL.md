---

name: cms-editor-and-crm
description: Project-specific rules for the Indivisible Fair Oaks visual content editor and grassroots CRM. Use when editing anything under src/components/admin/content/, src/components/admin/crm/, src/lib/blocks/, src/lib/actions/content.ts, src/lib/actions/crm.ts, src/lib/sanitize.ts, src/lib/trusted-links.ts, src/lib/own-media.ts, src/lib/image-size.ts, src/lib/__tests__/supabase-mock.ts,
supabase/functions/_shared/broadcast.ts, supabase/functions/crm-broadcast-send/, the
unsubscribe route, a coverage threshold in `vitest.config.ts`,
src/app/admin/layout.tsx, e2e/admin-authenticated.spec.ts, supabase/functions/checkout/,
src/components/layout/Header.tsx, or e2e/mobile-navigation.spec.ts — and
whenever a change could make CMS content vanish on publish, change a page's publish state, lose an
author's keystrokes, lose or re-date a revision, widen who receives an email, disable an email path by
accident, shift an image's layout, strand an editor on an unsaved document, break dialog focus
restoration, or leave a file outside the coverage gate.
---
# CMS editor & CRM

Two admin surfaces with a shared theme: **a control that looks like it works is
worse than a visible button**, and **anything that can email a real person needs
its blast radius stated in the code**.

Read `docs/content-editor.md` and `docs/crm-operations.md` for full context. The
rules below are the ones that are easiest to break by accident.

## Never break these

### 1. The editor's markup must survive the sanitizer

`sanitize(serialize(blocks)) === serialize(blocks)` is a property test. It is
the only thing between a new block type and silently vanishing on publish.

```bash
bun vitest run src/lib/__tests__/blocks.test.ts
```

If it fails, the cause is a sanitizer/serializer disagreement or a missing block
type — not a flaky test. A new block that serializes to markup the sanitizer
strips will look perfect in the editor and be gone on publish.

Do not add a block type without checking what the sanitizer allows first. There
is deliberately **no embed block**: `sanitizeWPContent` strips iframes and oEmbed
markup, so the control would do nothing.

Two sanitizer rules shape every type, and both fail silently:

- **`data-*` is not in the allowlist**, so block identity and variant travel in
  `class` under the `cw-` prefix. Renaming a class orphans every stored block.
- **Three or more directly adjacent anchors are deleted as link spam**, which is
  why every `button` block carries a `BUTTON_WRAPPER_CLASS` wrapper. A row of
  calls to action written without knowing this looks fine and is eaten on
  publish.

Twelve types exist; eleven are insertable. `BLOCK_DEFINITIONS` in
`block-definitions.tsx` is the single inventory — add there, not inline.
`unsupported` is the twelfth and is deliberately *not* insertable: it is markup
the model cannot represent, kept verbatim and read-only so that opening and
saving a page never deletes content it cannot edit.

### 2. Autosave must not change a page's publish state

Autosave persists with the document's *current* `status`.

Passing `'draft'` unconditionally was a live bug: editing a published page and
pausing 2.5s quietly unpublished it. Taking a page down stays a deliberate act,
named through `handleSetStatus`.

**Neither may the Publish button.** `setContentStatus` writes `status` and
`published_at` and nothing else, so toggling it with unsaved edits published the
*last saved* version and dropped the rest — then marked the editor clean, which
short-circuited autosave, stopped the unload warning, and left the indicator
reading "All changes saved". When anything is unsaved, publish the whole document
through `handleSave(next)`, the same guarded path as the button and Cmd+S.

**Neither may the Status `<select>`**, which is the subtler version of the same
trap. It called `setStatus` — local state — but `status` is part of the document
snapshot, so `dirty` flipped and autosave published 2.5s later. It could not call
the guard because the guard was a no-argument *toggle*, and a toggle cannot
express "the author picked Draft". Hence `handleSetStatus(next)`: **if a second
control names the same state, it takes the same path, and the write must be
immediately observable.** A snapshot write with no feedback reads as a broken
control even when it is merely late.

The general rule: **a status-only action must never mark a whole document
saved.** If it writes two fields, it may only re-snapshot two fields.

### 2a. A rejected promise is not a failed result, and only one was handled

`saveContent` returning `{success:false}` is a handled branch — every call site
reports it. A **rejection** means the request never answered: dropped wifi, an
expired session (`requireAdmin` redirects), a socket that closed.

`await persist(...)` followed by `setSaving(false)` on the next line is not a
guaranteed statement, because a rejection skips it. And `saving` is what disables
the Save button — so one unreachable save left the editor permanently unable to
save itself, recoverable only by reloading, which discards the document. The
autosave path was `void persist(...).then(...)` with no `.catch()`: the indicator
sat on "Saving…" for the rest of the session while nothing was written, and
`activeSaveFailure` was never set, so the banner explaining why stayed hidden too.

Both are caught now. Report through the existing `setSaveFailure` + toast path,
and **say the three things a volunteer acts on**: the change is not saved, the
text is still on screen, and to copy it before reloading. The reflex on a failed
save is to reload, and reload is what loses the work.

### 2b. The snapshot a save adopts must be the one the write produced

`persist` snapshotted `fields`, whose `status` is the value from *before* the
write, so `dirty` stayed true after a successful publish: the toast said
"Published", the indicator contradicted it, `beforeunload` warned about stored
work, and autosave rewrote the identical document 2.5s later — a second
`content_revisions` row for a revision that changed nothing, on every publish.
`handleSetStatus` got this right at its own snapshot; `persist` did not.

Snapshot `{...fields, status: nextStatus}` — the document **as written**. Two
snapshots of one document that disagree is a whole class of bug, and the
failure-only branch must not adopt the optimistic snapshot.

### 2c. A shared failure banner must name its write path, and a stale version must not offer retry

A failed Cmd+S is not an autosave failure. Record `via: 'manual' | 'autosave'`
on `saveFailure` and use it in both the status indicator and the banner. The old
shared label named only autosave, so an author who had just pressed Cmd+S was
told the editor had failed on its own.

Recognise an optimistic-concurrency refusal with `STALE_SAVE_CONFLICT_PREFIX`.
Its recovery is reload, not retry: explain that another editor saved first, tell
the author to copy unsaved text before reloading, show **Reload onto their
version**, and do not show **Try again** or a dismiss control that re-arms the
same outdated write. Cover manual and autosave sources separately; the source is
part of the user-visible contract.

### 3. Deleting an image checks every reference first

`deleteContentImage` must refuse when `content.body`, `content.featured_image`
or `content_revisions.body` still points at the object.

An unconditional `storage.remove()` is a data-loss event: the same upload is
routinely used by two blocks, reused as a hero, or referenced by a revision whose
restore would then 404. Prefer leaving an orphan (garbage) over breaking a live
page.

**`featured_image` is a hero and it is on the page.** It renders on
`src/app/[slug]/page.tsx`, feeds the `og:image` and the Article JSON-LD. Which
hosts may serve it is `isOwnImageUrl` in `src/lib/own-media.ts` — derived from
configuration, not a literal. It has to include the Supabase project host,
because the CMS's own uploader writes to the `media` bucket there: validating
against `NEXT_PUBLIC_SITE_URL` alone made the field impossible to set in
production.

### 4. Spam keywords match on word boundaries

Use `containsSpamKeyword()` from `src/lib/sanitize`. Do not call
`SPAM_KEYWORDS.some((kw) => text.includes(kw))` anywhere.

The substring form deleted whole paragraphs, blocks and buttons over ordinary
English — a paragraph about a **judicial** review contains "judi" — and told
residents their contact message was spam. A fourth matcher re-opens the bug.

The list is still aggressive by design: a bare `slot`, `bonus` or `bingo` *is* a
hit. That is a deliberate tradeoff, documented in
`src/lib/__tests__/sanitize-keywords.test.ts`.

### 5. A self-test send cannot be pointed

`sendCRMBroadcastSelfTest` derives its recipient from the session. It must never
accept an address.

The audience narrowing lives in the `crm-broadcast-send` Edge Function: when
`test_only` is set, `test_recipient` is the whole audience and the `target_*`
query is skipped. Keep the guard there. Moving it to the caller means a preview
can be widened by anything written on the client.

**Read the flag on its own.** It used to be
`test_only === true && typeof test_recipient === 'string'`, and that conjunction
*was* the safety property. Both columns are nullable and nothing constrained the
pair, so a `test_only` row with a NULL recipient evaluated false, dropped out of
the branch, and the audience loop mailed **every opted-in contact**. No bad
intent was needed — just a row missing a value.

A one-way door needs a floor. `test_only === true` with no usable address is a
hard 422, never a fallback, and migration `20260930120000` adds
`crm_broadcasts_test_only_needs_recipient` so the shape cannot be written at all.

The same reasoning applies to the recipient ceiling: it is enforced on
*completeness*, not on a count. See invariant 18.

### 6. A new send path must refuse to run in an e2e build

`isE2EMode()` (both `CONTACT_SUBMISSION_TEST_MODE=1` **and** `NEXT_E2E_BUILD=true`)
guards `sendCRMBroadcast`, `sendCRMBroadcastSelfTest` and
`sendCRMDirectEmail`. Copy `sendBlockedInE2E()` into any new one.

The contact form is *not* guarded this way, and the difference is the point. Its
notifier is redirected to a local mock in e2e, and `notifyUrl()` refuses to
fall back to the live URL — so the call is harmless and the suite can still
exercise the delivery-status UI, including its failure branches. Bypassing it
instead would have made those branches untestable, and would have been a change
that looked like a fix while removing coverage.

The CRM paths have no such redirect: they dispatch to a live Edge Function that
talks to Resend, and the audience is a real constituent list. The moment e2e
gains a seeded admin session, a single click in a spec would mail the chapter.

Put the check in the action, not the harness, so the guarantee travels with the
code. Unit tests are not a substitute.

### 7. A `CHECK` constraint that disagrees with the code is a trap

`crm_broadcasts.status` omitted `'queued'`, so the insert failed and **no
broadcast had ever been sent**. Unit tests mock the client and cannot see a
constraint.

When you add a state, update the CHECK in a migration in the same change, and
verify against the real database — not a mock.

### 8. Undo groups by intent, and the stack is snapshots

`src/lib/editor-history.ts`. Handlers declare an intent: `type:<field>` for
typing, `null` for a discrete change. Without grouping, undo removes one
character at a time.

Two traps in the wiring, both of which present as "undo silently does nothing":

- A functional `setState` updater must not read a ref that the same effect then
  mutates. The updater runs during the re-render, sees the advanced value, and
  records no change. Read refs into locals first.
- A snapshot that does not round-trip to an identical string is recorded as a
  edit. Undo, redo and draft restores set `appliedByUs` so the recording effect
  skips them; otherwise one restore looks like two undo steps.

Cmd/Ctrl+Z must be intercepted, not left to the browser: native undo walks the
DOM's own history, which knows nothing about the block model.

**The declaration needs a shape or it is not a rule.** Four typing paths — the
image `src`, table headers, table cells, list items — omitted the argument
entirely, so undo recorded one character per step in exactly those blocks while
every other field behaved. Two requirements:

- **Every `onUpdate` / `setBlocks` call passes an intent or an explicit `null`.**
  Omitting it is the bug, and it reads as tidier code rather than riskier.
- **The key is field- and position-scoped**: `type:cell:${id}:${r}:${c}`, not
  `type:cell:${id}`. Coalescing on the block alone merges edits to two different
  cells into one undo step — quieter than one-per-character and harder to spot.

### 9. Recovered drafts are offered, never applied

`src/lib/draft-recovery.ts`. A local copy silently replacing the page someone
came back to loses an author's trust permanently. Keep the "Restore" / "Discard"
choice, keep the per-content-id key, and keep the freshness checks.

### 10. A revision preserves the document, not just its text

Two columns, and the second was missed for the same reason as the first.
`content_revisions.featured_image` is stored from `OLD.featured_image` and
restored instead of `null`. `content_revisions.published_at` is stored from
`OLD.published_at`, treated as revision-worthy, and passed through as
`publishedAt`.

Both are the same failure as the unconditional `storage.remove()`: a control
labelled "Restore" deleting or re-dating data the author did not ask to change.
The date one is worse and quieter — `saveContent` re-stamps
`published_at = now()` whenever a published page is written without one, so
restoring a March revision re-dated the post to today and **jumped it to the top
of `/news`**, the exact reordering `setContentStatus` exists to prevent.

**Before you trust a restore, ask what the restore would do to state the editor
does not display.** The date was invisible in the diff, invisible in the form,
and obvious only in the feed.

Pre-migration rows have `NULL` in both and restore as before. `src/types/supabase.ts`
is generated from the *live* project, so it will not have either column until the
migrations are applied — which is why the read sites use intersection casts. Do not
fix a cast by hand-editing the generated file.

### 11. A restore is never blind, and never native-confirmed

History rows show status, type, and a field-level diff against the document on
screen, and restore goes through an inline confirm step. Do not put
`window.confirm()` back on this path: it re-asked a blinder question after an
informed one, and it cannot be automated, so the restore path goes untested.
The diff must read from the same `fields` object the dirty check compares.

### 12. Every destructive action uses ConfirmAction

`src/components/admin/ConfirmAction.tsx` is the one shape for delete / merge /
opt-out across both admin surfaces. Idle control → consequence → inline
Confirm/Cancel. Never `window.confirm()`: it asks a blind question and cannot
be automated, so the path behind it goes untested. Keep it unmount-safe (state
in the button, not a portal), use `fieldset`/`legend` not `role="group"`, and
disable the whole step while `busy`.

### 13. A control must name the state it will actually reach

A draft has no public page — `getPublishedContent` filters to published rows, and
under PPR the fallback is an HTTP 200 "Page Not Found". So a row action must
differ by state: **View** (live URL) for published, **Preview** (into the editor)
for a draft. Never render a public-URL link for something unpublished.

This is the "no fake controls" rule in its mildest and nastiest form: nothing
crashed, no console error, the page rendered fine. The only symptom was an
author unable to distinguish a typo from an unpublished draft. Keep the exit
action (Publish) available in the state you are warning about.

### 14. A preview renders through the public page's own sanitizer

`ContentPreview` must use the same `sanitizeWPContent` + `cw`/prose classes as
`src/app/[slug]/page.tsx`. A preview that styled itself differently would be a
lie the author ships on. Keep it a modal, never a route — an unsaved document
must not have a shareable URL.

Build it on `@radix-ui/react-dialog`, not a hand-rolled `role="dialog"`. The
hand-rolled one declared `aria-modal="true"`, moved focus to the close button,
and **trapped nothing** — Tab walked out into the editor behind it. Every other
modal in this repo is Radix for that reason.

Two fidelity rules, each of which was violated while the claim stayed true:

- **The date is `created_at`, not `published_at`.** The public page prints
  `content.created_at`; `published_at` is a different column and is `NULL` for
  anything never explicitly published, so the preview showed no date at all for
  exactly those pages. Pass the field the page prints.
- **Render the same hero, in the same frame.** The preview showed a hero the
  published page did not have, because `featured_image` was read by no public
  route. A preview that displays an element the page will not is worse than one
  that omits it.

Store *which URL failed* for a broken image, not a boolean — a boolean needs a
reset effect keyed on the value, and that dependency is exactly what a lint
autofix will drop.

### 15. SEO meta fields win over derived values

Meta title / description live in `content.metadata` (`meta_title` /
`meta_description`). `generateMetadata` uses them when present, falls back to
the derived title / body excerpt when not. The search preview shows them when
set — that is what Google uses. Character budgets: title ~60, description ~155.

### 16. One rule, one module — never a second copy

`src/lib/trusted-links.ts` owns the outbound-link allowlist. `sanitize.ts`
re-exports it; `LinkPopover.isLinkableHref` and `BlockEditor.isSafeHref` are
one-line wrappers. `src/lib/own-media.ts` owns which hosts may serve an authored
image, derived from configuration.

It was three lists, and they had already drifted: the sanitizer allowed twelve
domains, the editor allowed one, and the editor told authors their `actblue.com`
link "will be removed when the page is published" — for a link the sanitizer
would have kept. **The failure mode of a duplicated allowlist is not a build
error.** It is a volunteer quietly believing the site is more restrictive than
it is.

`src/lib/__tests__/trusted-links-parity.test.ts` asserts the two agree for every
domain on the list, so adding one is safe. Keep the module free of `sanitize-html`
so a client component can import it.

### 17. A menu that takes focus owns its own keys

The slash menu — the editor's primary insertion affordance — was **mouse-only**.
It autofocused its own search input while Arrow / Enter / Tab were bound to the
block it was opened *from*, so no key ever reached a handler. It is now a
combobox: `aria-activedescendant` on the input, all keys on the dialog, options
at `tabIndex={-1}` so focus stays in the field.

Two generalisations:

- **Do not bind a floating surface's keys to the element it was opened from.**
  Opening it moves focus, so the handler never fires.
- **`group-hover` is `@media (hover: hover)`.** A reveal gated on it sits at
  `opacity: 0` on a phone while staying clickable and in the tab order. Use
  `hover-capable:` plus `focus-within:opacity-100`, per AGENTS.md.

`overflow-x-auto` also stopped being focusable by default: a scrollable region
without `tabIndex={0}` cannot be scrolled from the keyboard at all. Use a
`<section aria-label="…">`, and suppress Biome's `noNoninteractiveTabindex`
per element with a reason rather than for the whole file.

### 18. A ceiling is a refusal, enforced on completeness

`resolveBroadcastRecipients` returns `{ recipients, exhausted }`, and
`sendCRMBroadcast` refuses on `!exhausted` before the log row is written.

It used to compare `recipients.length > BROADCAST_RECIPIENT_CEILING` against a
resolver that paged with `offset < CEILING` and could therefore return at most
exactly `CEILING` rows. The branch was **structurally dead**, and a
12,000-recipient audience was cut to 5,000 and reported `sent`.

**The general rule: a loop bounded by a limit cannot tell "this is all of them"
from "this is all I was allowed to look at".** Report exhaustion from inside the
loop. `crm-broadcast-send` applies the same rule independently and answers 422.

The same shape appeared twice more, and the pattern is worth recognising:

- A `created_by` column added "so a blast has an attributable author" was in
  **no threshold and no test** — not in the coverage `include` list at all.
- The email flood guard counted broadcast rows, so a legitimate 2,500-recipient
  campaign lost every timeline entry past recipient 2,000 while the sender
  **discarded the returned error** and finished green.

### 19. A file that cannot be measured is a file that cannot fail

`src/lib/actions/crm.ts` held every mutation, the dispatch, the recipient
resolution, the rate limits and the e2e guard, and was in no coverage threshold
at all. That is how both of the last two bugs shipped.

**When you add a file, add it to `vitest.config.ts`'s `include`, or say why not.**
Coverage thresholds are globs, not a global number, because Vitest checks a bare
`statements: 90` against the *aggregate* — so a stricter file cannot raise it and
a looser one silently lowers it for everything else. The thresholds are floors
that only go up.

**And expect that to turn the gate red.** The same arithmetic is why:
`src/lib/image-size.ts` entered at 86% branches and pulled everything-except-
`crm.ts` from 90.0% to 89.86%, so the run failed on coverage alone with every test
green. **Cover the new file — never widen an exclusion to accommodate it.**

**Current floors, stated on single lines where the gate checks them.**
`src/lib/actions/crm.ts` on an explicit floor of **89 / 84 / 100 / 93**; `src/lib/actions/content.ts` on **58 / 54 / 61 / 65** — both re-derived from
`vitest.config.ts` by `scripts/check-doc-claims.mjs`, which fails on a mismatch.
(The single-line rule matters: that script matches per line, so a guarded number
split across two lines matches nothing and the staleness goes silent. That is
how the previous sentence in this section drifted.) The content file was
the second omission of the same kind: every CMS mutation, in no threshold at
all. Its floor was raised once already, from 53/50/53/59, when the
concurrent-edit and unsubscribe-route suites landed: **a floor that is not moved
when the number moves is a comment, not a ratchet.** If you raise coverage, raise
the floor in the same change.

**54% branches is not a rounding artefact**: most of the image storage paths,
the revision queries, the list/pagination reads
and every failure branch are uncovered. The difference between "we have not
looked" and "we have looked, and here is the number" is the whole point.

**One exclusion glob, not several.** Vitest treats each threshold key as its own
"everything except this" set, so `'!crm.ts'` *includes* `content.ts` and vice
versa, and each set then fails on the other's floor. It has to be a single
`'!src/lib/actions/{crm,content}.ts'`.

**A gate that is sometimes red is not a gate.** The `blocks.test.ts` property
suite (four properties × 300 documents, up to three serialize → parse → sanitize
cycles each) sat at Vitest's 5s default once `v8` was on and failed
*intermittently* — which trains people to re-run until green. It carries an
explicit `PROPERTY_TIMEOUT_MS` with every assertion and the run count untouched.

**And expect that to turn the gate red.** The same arithmetic is why:
`src/lib/image-size.ts` entered at 86% branches and pulled everything-except-
`crm.ts` from 90.0% to 89.86%, so the run failed on coverage alone with every test
green. **Cover the new file — never widen an exclusion to accommodate it.** The
point of naming globs is that a file in the list is a file being measured.

A related habit, from the same pass: every unit test here mocks the Supabase
client, so **a schema-level constraint is invisible to them**. `crm_broadcasts`
once omitted `'queued'` from its CHECK and no test failed while every broadcast
the site had ever sent failed at the insert.

### 20. A config var and a deploy step land together

`crm-broadcast-send` was absent from `.github/workflows/supabase.yml` while
`secrets.manifest.mjs` already marked `RESEND_API_KEY` and `APP_URL` required
*for it*. So `CRM_BROADCAST_FUNCTION_URL` pointed production at a route no
pipeline shipped, and the workflow was asserting secrets for code nothing
deployed.

The `verify` job now probes it with the **publishable** key expecting a 401 — a
404 means absent, a 200 means it stopped requiring the key. When you add a
function: deploy step, required-secrets entry, and probe expectation, or the
`secrets.manifest.mjs` assertion is checking a fiction.

### 21. Between a keystroke and the model there are two documents

A keystroke reaches the DOM instantly and the model on a 120 ms debounce. In that
window `committed` is what the model holds and `pendingHtml` is every keystroke
not yet folded into it. **Only one of those is the model**, and the difference is
silent.

**Every structural operation reads `liveBlocks()`, never the `blocks` prop.** The
old code shared one timer across all blocks and closed over the `blocks` array
captured when the keystroke was rendered, which failed three ways at once: two
blocks in one window lost the first block's text (the shared timer flushed only
the last block); Enter inside the window wrote the pre-Enter array back and
**deleted the paragraph the caret had just moved into**; and convert / duplicate /
split / move read the stale `html` and carried the last *saved* words. Type-then-
Enter is the most common action in a block editor, so this was the most common way
to lose a sentence.

- `structural()` folds pending edits into the base **without a second `onChange`**.
  They are not a separate render — React batches the whole event — and two calls
  share one undo-intent ref, so the last writer would relabel the other's entry.
- One shared timer is correct; flushing only the last block was the bug. The flush
  commits *every* pending block as one transition and one undo step.
- **The undo intent is field-scoped and sorted** (`burstIntent`). A single block
  must still yield the byte-identical `type:<id>`, or a run of typing splits into
  many steps.
- A pending flush is cancelled on unmount, never committed — calling `onChange`
  on a parent that dropped the document could resurrect a deleted block.

**The regression test needs two blocks inside one window.** With one block, one
timer and one flush, the stale closure is correct *by accident*, which is why this
shipped with a green suite. A single-block test cannot see it.

### 22. An image is measured, or the frame is fixed — never neither

`width` / `height` were in the block model and the serializer from the start and
populated by nothing, so every content image shipped with no intrinsic size: a
guaranteed layout shift, and a direct violation of `AGENTS.md` coding rule 5.

**Measure from the bytes.** `measureImageSize` (`src/lib/image-size.ts`) reads the
header each format stores its size in — PNG IHDR, GIF screen, WebP first chunk,
JPEG SOFn — from the bytes just written, and returns `null` rather than guessing.
A wrong dimension is *worse* than none: the browser reserves the wrong box, so the
shift remains and the image is now distorted too. Never accept an author-supplied
size; never trust a browser's report at render time.

- **Where no measurement is possible, reserve a fixed frame.** Never neither.
- **Emit no attribute at all for an unmeasured image** — `width="0"` reserves
  nothing and renders nothing.
- **A URL typed by hand is probed client-side** (`ContentImageInput`), after a
  600 ms settle, and **re-emits the same `src` with the dimensions attached** so
  the pair is one update and one undo step. It skips our own hosts (already
  measured server-side) and a failed probe writes nothing, because the block
  already holds `null` and re-emitting it is a no-op the author has to undo.
- **The sanitizer's `img` allowlist is load-bearing.** Those attributes reach the
  reader only because `img: [... 'width', 'height' ...]` permits them. Narrowing
  it fails the round-trip property test at the boundary instead of as a slow
  invisible regression.

Test fixtures for the parsers are **real encodings** with expected values from the
OS decoder, not hand-built headers — a hand-written header only proves the reader
agrees with your idea of the format, and it caught a wrong VP8L bit-packing during
development. Include a landscape, a portrait and an odd width, so a transposed
reader cannot pass.

### 23. A save carries the version it was based on

`saveContent` takes an optional `expectedUpdatedAt` and makes it a precondition
on the UPDATE. Before it, two organizers on one page were last-write-wins with no
signal — the default outcome of the one surface whose purpose is to look after
written work.

Four things, each silent when wrong:

- **The precondition rides on the UPDATE**, not a SELECT-then-UPDATE. Checking
  first leaves a window in which a colleague's save lands and is then overwritten.
- **The write asks the row back with `.select(...)`.** An UPDATE matching no rows
  returns `error: null, data: null` — indistinguishable from success. Without the
  select, a conflict is reported as a success.
- **The returned version is the trigger's**, not a JS timestamp. A second clock
  disagrees with the database's, and the author's next autosave conflicts with
  their own work. A guard that fails the second save is worse than no guard.
- **A null claim uses `.is()`, never `.eq()`.** `content.updated_at` is nullable,
  and `.eq(col, null)` is `col=eq.null` — matches nothing, so the guard fires
  against a page nobody touched. Omitted / `null` / string are three states.

Only a *write* moves the version. The editor keeps it in a ref (not state — it
changes every autosave and must not re-render). A revision restore adopts the
version it re-reads; undo, redo and draft recovery do not. Re-seed from props
only when `initial.id` changes: `router.refresh()` runs after each save, so
adopting every render would agree with a colleague's newer timestamp and then
overwrite it.

### 24. Use the shared Supabase mock, and make it a *filtering* mock

`src/lib/__tests__/supabase-mock.ts`. Five suites hand-rolled their own
`adminClient`, each modelling the smallest slice it needed, and the divergence
cuts both ways:

- a mock **narrower** than the real client fails on correct code — `saveContent`
  legitimately calls `.update().eq().select().maybeSingle()`, which
  `content-revisions`' `update()` did not have, and the suite was green;
- a mock **wider** than the real client passes on code that would 4xx.

Worse, a stub that returns whatever a test put under `table:like` cannot tell
"matched the right row" from "matched a row". `content-media.test.ts` asserted
"keeps a referenced file" while the reference query could have checked nothing at
all, and deleting its `.like` still passed. **Row-based mocks close that**, but
only if the suite has a *negative* case: rows that exist and do **not** mention
the file. Without one, an unfiltered query matches them and the guard still
"passes".

Three CRM suites assert on call *arguments* rather than rows. That is a
legitimate style for testing the shape of a call — but it cannot catch a query
naming the wrong column, and converting them is a rewrite of their assertions,
not a swap of a helper.

### 25. A guard that fails closed on legitimate input is still broken

`isDeliverableAddress` was `[^@[:space:],]` — a **POSIX** character class, in a
**JavaScript** regex. There is no such thing inside `[...]`: it is the literal
run `[ : s p a c e :]`, so the negated set forbade the letters `s p a c e` along
with the separators. `alice@example.com` was rejected.

Two separate lessons, and the second is the one that generalises:

- **A pattern that rejects the wrong characters is worse than no pattern**, because
  it looks like a control. It stopped a self-test resolving to several recipients
  by refusing to resolve to any.
- **It lived only in the Edge Function, which no test runner can reach.** That is
  why the editor and the CRM are covered and the code deciding who actually
  receives email was not. **Anything a `crm-broadcast-send` guard must be right
  about belongs in `_shared`**, which `crm-broadcast-parity.test.ts` can import —
  `commerce-parity.test.ts` already imports `_shared/commerce` this way.

Test it with **real addresses**. A synthetic fixture would not have caught this:
the regression is precisely that ordinary addresses were refused.

### 26. Offset paging needs a total order

Both audience resolvers called `.range(offset, …)` with no `.order()`. PostgREST
emits no `order` parameter when none is given, and offset paging is coherent only
against an order that does not change *between statements*. A contact who opted
out, or a CSV import that landed, between page 3 and page 4 shifts every later row
by one: the boundary contact is **mailed twice** and `recipient_count` is wrong. A
concurrent insert silently skips someone.

Order by the **primary key**. A non-unique column still ties and re-opens the
hole. `getCRMExistingTags` in the same file already did this — when one function
in a file is right about something, that is your evidence it is an oversight and
not a decision.

Related, and a one-line class of bug: a loop bounded by `offset < CEILING` cannot
distinguish "the list ended exactly at the ceiling" from "it continued past it",
because it stops one page short of the boundary. An audience of exactly the
ceiling is not over the limit. Use `<=` **and** break explicitly on
`collected > CEILING`, so the work stays bounded.

### 27. A GET must never change state on a public link

`GET /api/crm/unsubscribe?token=…` wrote `do_not_email = true` and only *then*
branched on the method to choose what to render — while the route's docblock said
GET only rendered a confirmation.

**Corporate mail security products fetch every URL in an inbound message**
(Proofpoint, Barracuda, Microsoft Safe Links), and web and chat clients prefetch
links on hover. Any of them turns "the recipient clicked unsubscribe" into "the
recipient's mail gateway clicked unsubscribe". The blast radius is the entire
subscriber list, and the failure is invisible: every recipient still believes
they are subscribed.

- **GET writes nothing.** It may look the row up and render a form.
- **POST performs the change**, and the two POST shapes are told apart by the
  **body** (`confirm=1` from a browser form, empty from an RFC 8058
  `List-Unsubscribe-Post`), never by sniffing `Accept` or a user-agent. Header
  sniffing is how you end up returning an empty `204` to a real person when a
  mail client changes a header, and both possible outcomes are bad.
- Say *why* on the confirmation page. People complete a step they understand.

The same rule applies to any route whose URL appears in an email.

### 28. Sanitizing a container is a pre-pass, and the position is load-bearing

`disallowedTagsMode: 'discard'` keeps a disallowed tag's children, which is wrong
for a container. Two plausible options do **nothing**:

- `nonTextTags` sets `skipText`, which suppresses *raw text* directly inside a
  tag. Children are elements.
- `exclusiveFilter` is never consulted for a tag that is already disallowed —
  sanitize-html returns from its close handler first.

And the pre-pass that works has an ordering constraint: the pass stripping
active-content tags already deletes the opening and closing tags of `form`,
`object`, `select` and `marquee`, so a subtree removal placed *after* it matches
nothing. You get a fix that compiles, ships, and changes no behaviour — which is
how two wrong fixes got applied here before the ordering was found.

Any sweep that runs to the end of the input (unclosed tags) must be scoped to the
tags where that actually happened, or one unclosed `<form>` deletes a page.

### 29. Every tag write boundary normalises, and the UI must not care

Tags compare with `contains()` against stored values, so `Choir` and `choir` are
two different tags in the database and the filter chips show both. `Choir` was
stored as written from the contact editor until every write path ran through
`normalizeTags` (trim, lowercase, dedupe, cap):

- contact schema (`contactSchema.tags` transform),
- **segment schema** — it took `z.array(z.string())` and normalised nothing, so
  a saved segment could filter on a tag string that matched no contact,
- **broadcast audiences** — `saveCRMBroadcastDraft`, `sendCRMBroadcast`,
  `getBroadcastRecipientCount`, and `resolveBroadcastRecipients` (which
  normalises its own argument because it is also reached from the draft preview),
- **`mergeCRMContacts`** — the union of two rows' tags, which is a re-derivation
  rather than user input but lands in the same column,
- the **directory filter parser**, so a `?tag=Choir` link matches what the chips
  show.

A new path that accepts tags must normalise. The one-time `UPDATE … lower(tags)`
for rows written before the fix is a chapter data change, deliberately not a
deploy.

### 30. An e2e build announces itself; the flags never reach Vercel

`isE2EMode()` needs **both** `CONTACT_SUBMISSION_TEST_MODE` and
`NEXT_E2E_BUILD`, and Playwright sets both only on the server process it spawns.
If either reaches a Vercel env var, the deployment quietly becomes a site where
`sendCRMBroadcast` returns "Sending is disabled in test builds" and the contact
form posts to the mock URL — which reads as a broken CRM, and an admin who does
not know the stack reports it as one.

So the admin layout renders an amber banner whenever `isE2EMode()` is true. Keep
it. If you ever see that banner in an environment you did not intend to be an e2e
build, the fix is removing the variable from the Vercel project, not deleting the
banner — the banner is the only signal that the failure mode has.

The mirror-image guard is that a guard which fails closed on a legitimate action
looks exactly like an outage. That is why the suppression is one banner plus one
error string, and why the CRM send paths refuse *before* doing any work.

### 31. An Edge Function needs a rate limit that survives isolates

`supabase/functions/checkout` accepted the publishable key (public by
construction), so `verify_jwt` was not an access control and CORS `origin` is
inert for any non-browser client: every anonymous POST created a real Stripe
session. It now writes a row into the shared `search_rate_limit` rolling-window
table under a `checkout:` ip prefix and counts the last 60 seconds — 10/min,
the same limit the Next route carries.

An in-memory window (`src/lib/rate-limit.ts` for the route, `@hono` middleware
for the function) is **not** enough: isolates are per-instance, so the limit
becomes N × the intended limit. The table is shared; rows are never cleaned up,
same as the existing uses.

### 32. A dialog that does not restore focus strands a keyboard user at the top of the page

The mobile nav drawer is a Radix `Dialog` whose trigger — the hamburger — lives
outside the portal. The code comment claimed Radix supplied "focus restoration
to the hamburger on close". Measured: opening the drawer and pressing Escape
left `document.activeElement` on `<body>`, not the button. Radix restores onto
the node it recorded at open, but the modal un-hides everything behind it on
close, so the restore lands nowhere and focus falls through. A keyboard user
lost their place entirely.

**Restore explicitly.** `menuButtonRef` on the trigger plus `onCloseAutoFocus`
with `preventDefault()` and an explicit `.focus()`. `e2e/mobile-navigation.spec.ts`
fails if this regresses — `await expect(trigger).toBeFocused()` after Escape —
and that test is the only thing standing between this and silently re-breaking,
because nothing about the drawer looks wrong when focus is lost.

Two test-shape lessons from the same spec, both worth reusing anywhere a dialog
or a computed style is asserted:

- **Assert the contract, not a particular child.** Radix autofocuses the *first
  tabbable node*, which here is the close button. The first version of the spec
  asserted the logo link and failed for that reason alone, while proving nothing
  about the trap. It now asserts focus is *inside* the dialog and that six Tab
  presses stay there — stronger than the single assertion it replaced, because a
  trap that leaks after the first cycle still fails it.
- **Never assert unresolved CSS text.** `getComputedStyle().getPropertyValue()`
  resolves `var()` and `env()` before anything is readable, so the clearance
  assertion demanding the literal `var(--safe-area-top)` could never pass — the
  CSSOM always returns `calc(6.5rem + 0px)`. Assert the resolved value is built
  from the inputs instead (`--header-clearance` contains `--header-h`), which
  still fails if the derivation is dropped.

## Before you finish

```bash
bun run lint:check
bunx tsc --noEmit
bun run test:coverage
```

`test:coverage`, not `test` — the thresholds are per-glob and only the coverage run
applies them, so `bun vitest run` passing tells you nothing about the gate.

For migrations, `bun run types:generate` reads the **live** project, not the
migration files. A committed-but-unapplied migration leaves the generated types
missing its columns, and the read sites use intersection casts until it lands.
Never hand-edit `src/types/supabase.ts`; the next regeneration will show a phantom
diff and quietly undo the fix.

`lefthook` enforces a suppression baseline (currently 22 across `src/`) and
`no-new-hardcoded-ref`. Both are ratchets, not walls: raising one is a `chore:`
commit that says why, and a migration file cannot be edited once committed —
add another one.

## Reporting

State what you verified and how. "Tests pass" means you ran them. A guard
verified against the live Edge Function is worth more than a unit test that
mocks the client, and the difference is the whole reason bug 7 got shipped.

**The failure mode of this whole area is a comment that asserts the opposite of
what the code does.** Nearly every bug these two surfaces shipped was introduced
alongside a comment explaining why it was correct. When you fix one, delete or
rewrite the comment: leaving it is how the next reader trusts the wrong thing,
and leaving the *doc* wrong is how the next agent reintroduces the bug.

Prefer a test that fails against the old code over a note describing why the new
code is right. A comment has no failure mode; a test does.
